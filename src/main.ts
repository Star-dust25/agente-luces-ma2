import {
  app,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
import {
  esComandoLucesValido,
  EstadoConexionMA2,
  RespuestaComandoIPC,
} from './interfaces/ComandoLuces';
import { ClienteTelnetMA2, IClienteTelnetMA2 } from './red/ClienteTelnetMA2';
import {
  ConstructorComandosMA2,
  IConstructorComandosMA2,
} from './servicios/ConstructorComandosMA2';

/**
 * Canales IPC acordados entre el Proceso Principal (Backend) y el Proceso de Renderizado (Frontend).
 */
export const CANALES_IPC = {
  INVOCAR_COMANDO: 'ma2:enviar-comando',
  EVENTO_COMANDO_LUCES: 'comando-luces',
  RESPUESTA_COMANDO: 'ma2:respuesta-comando',
  OBTENER_ESTADO: 'ma2:obtener-estado',
  CAMBIO_ESTADO: 'ma2:estado-conexion',
} as const;

/**
 * Orquestador del Proceso Principal de Electron.
 * Conecta los listeners de ipcMain con el constructor de comandos y el cliente Telnet.
 */
class ControladorPrincipalMA2 {
  private readonly clienteTelnet: IClienteTelnetMA2;
  private readonly constructorComandos: IConstructorComandosMA2;
  private ventanaPrincipal: BrowserWindow | null = null;
  private cancelarObservadorEstado: (() => void) | null = null;

  constructor(
    clienteTelnet: IClienteTelnetMA2,
    constructorComandos: IConstructorComandosMA2
  ) {
    this.clienteTelnet = clienteTelnet;
    this.constructorComandos = constructorComandos;
  }

  /**
   * Inicializa la conexión Telnet, registra los canales IPC y crea la ventana de Electron.
   */
  public iniciar(): void {
    this.registrarListenersIPC();
    this.cancelarObservadorEstado = this.clienteTelnet.registrarObservadorEstado(
      (nuevoEstado: EstadoConexionMA2) => {
        this.notificarEstadoAlFrontend(nuevoEstado);
      }
    );

    this.clienteTelnet.conectar();
    this.crearVentanaPrincipal();
  }

  /**
   * Crea o restaura la ventana principal si aún no existe (útil en macOS).
   */
  public asegurarVentanaPrincipal(): void {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.crearVentanaPrincipal();
    }
  }

  /**
   * Libera recursos, remueve handlers IPC y cierra la conexión TCP antes de salir.
   */
  public detener(): void {
    this.eliminarListenersIPC();

    if (this.cancelarObservadorEstado !== null) {
      this.cancelarObservadorEstado();
      this.cancelarObservadorEstado = null;
    }

    this.clienteTelnet.desconectar();
  }

  private crearVentanaPrincipal(): void {
    this.ventanaPrincipal = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true,
      title: 'Agente de Control de Luces - GrandMA2',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.ventanaPrincipal.on('closed', () => {
      this.ventanaPrincipal = null;
    });

    const rutaHtmlFrontend = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    void this.ventanaPrincipal.loadFile(rutaHtmlFrontend).catch((error: unknown) => {
      const detalle = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Main] No se pudo cargar la vista inicial en "${rutaHtmlFrontend}" (${detalle}). El backend IPC continúa operativo.`
      );
    });
  }

  private registrarListenersIPC(): void {
    ipcMain.handle(
      CANALES_IPC.INVOCAR_COMANDO,
      async (_evento: IpcMainInvokeEvent, cargaUtil: unknown): Promise<RespuestaComandoIPC> => {
        return this.procesarCargaUtilIPC(cargaUtil);
      }
    );

    ipcMain.on(
      CANALES_IPC.EVENTO_COMANDO_LUCES,
      (evento: IpcMainEvent, cargaUtil: unknown): void => {
        void this.procesarCargaUtilIPC(cargaUtil).then((respuesta) => {
          if (!evento.sender.isDestroyed()) {
            evento.sender.send(CANALES_IPC.RESPUESTA_COMANDO, respuesta);
          }
        });
      }
    );

    ipcMain.handle(CANALES_IPC.OBTENER_ESTADO, (): EstadoConexionMA2 => {
      return this.clienteTelnet.obtenerEstado();
    });
  }

  private eliminarListenersIPC(): void {
    ipcMain.removeHandler(CANALES_IPC.INVOCAR_COMANDO);
    ipcMain.removeHandler(CANALES_IPC.OBTENER_ESTADO);
    ipcMain.removeAllListeners(CANALES_IPC.EVENTO_COMANDO_LUCES);
  }

  /**
   * Valida la carga útil recibida mediante Type Guard, construye el comando MA2
   * y lo envía por el cliente Telnet garantizando que nunca se lancen excepciones no capturadas.
   */
  private async procesarCargaUtilIPC(cargaUtil: unknown): Promise<RespuestaComandoIPC> {
    if (!esComandoLucesValido(cargaUtil)) {
      const mensajeError =
        'Carga útil IPC inválida. Se requiere: { accion: "encender" | "apagar" | "ajustar" | "color", grupo: string, valor: string, tipo: "intensidad" | "color" }.';
      console.warn(`[Main] ${mensajeError}`, cargaUtil);
      return this.crearRespuesta(false, null, mensajeError);
    }

    try {
      const comandoMA2 = this.constructorComandos.construirComando(cargaUtil);
      const enviado = await this.clienteTelnet.enviarComando(comandoMA2);

      if (!enviado) {
        return this.crearRespuesta(
          false,
          comandoMA2,
          'No fue posible entregar el comando a GrandMA2 en este momento.'
        );
      }

      console.info(`[Main -> MA2] Comando ejecutado: ${comandoMA2.trim()}`);
      return this.crearRespuesta(true, comandoMA2, 'Comando enviado correctamente a GrandMA2.');
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      console.error(`[Main] Error al procesar comando IPC: ${detalle}`);
      return this.crearRespuesta(false, null, detalle);
    }
  }

  private crearRespuesta(
    exito: boolean,
    comandoGenerado: string | null,
    mensaje: string
  ): RespuestaComandoIPC {
    return {
      exito,
      comandoGenerado,
      mensaje,
      estadoConexion: this.clienteTelnet.obtenerEstado(),
      marcaTiempo: new Date().toISOString(),
    };
  }

  private notificarEstadoAlFrontend(estado: EstadoConexionMA2): void {
    if (this.ventanaPrincipal !== null && !this.ventanaPrincipal.isDestroyed()) {
      this.ventanaPrincipal.webContents.send(CANALES_IPC.CAMBIO_ESTADO, estado);
    }
  }
}

/**
 * Protege el proceso principal de Electron ante errores no controlados para evitar caídas en vivo.
 */
function registrarManejadoresGlobalesDeErrores(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('[Main] Excepción no capturada contenida:', error);
  });

  process.on('unhandledRejection', (razon: unknown) => {
    console.error('[Main] Promesa rechazada sin manejador contenida:', razon);
  });
}

function arrancarAplicacion(): void {
  registrarManejadoresGlobalesDeErrores();

  const constructorComandos = new ConstructorComandosMA2();
  const clienteTelnet = new ClienteTelnetMA2(constructorComandos, {
    host: '127.0.0.1',
    puerto: 30000,
  });
  const controladorPrincipal = new ControladorPrincipalMA2(
    clienteTelnet,
    constructorComandos
  );

  void app
    .whenReady()
    .then(() => {
      controladorPrincipal.iniciar();

      app.on('activate', () => {
        controladorPrincipal.asegurarVentanaPrincipal();
      });
    })
    .catch((error: unknown) => {
      console.error('[Main] Error crítico durante el arranque de Electron:', error);
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    controladorPrincipal.detener();
  });
}

arrancarAplicacion();
