import * as net from 'net';
import {
  ConfiguracionTelnetMA2,
  EstadoConexionMA2,
} from '../interfaces/ComandoLuces';
import { IConstructorComandosMA2 } from '../servicios/ConstructorComandosMA2';

/**
 * Contrato público del cliente Telnet para desacoplar la capa de red del proceso principal.
 */
export interface IClienteTelnetMA2 {
  conectar(): void;
  desconectar(): void;
  enviarComando(comandoRaw: string): Promise<boolean>;
  actualizarConfiguracionConexion(nuevaConfig: Partial<ConfiguracionTelnetMA2>): void;
  obtenerEstado(): EstadoConexionMA2;
  estaListoParaEnviar(): boolean;
  registrarObservadorEstado(observador: ObservadorEstadoConexion): () => void;
}

export type ObservadorEstadoConexion = (estado: EstadoConexionMA2) => void;

interface ComandoPendiente {
  readonly comandoRaw: string;
  readonly resolver: (enviado: boolean) => void;
}

const CONFIGURACION_POR_DEFECTO: ConfiguracionTelnetMA2 = {
  host: '127.0.0.1',
  puerto: 30000,
  usuario: 'administrator',
  contrasena: 'admin',
  tiempoEsperaSocketMs: 10000,
  retrasoBaseReconexionMs: 1000,
  retrasoMaximoReconexionMs: 30000,
  factorBackoff: 2,
  maximoComandosEnCola: 50,
};

/**
 * Cliente TCP/Telnet tolerante a fallos para comunicarse con GrandMA2 / grandMA2 onPC (RF-02).
 * Gestiona login automático, cola de resiliencia y reconexión con Exponential Backoff.
 */
export class ClienteTelnetMA2 implements IClienteTelnetMA2 {
  private static readonly TIEMPO_ESPERA_AUTENTICACION_MS = 6000;

  private configuracion: ConfiguracionTelnetMA2;
  private readonly constructorComandos: IConstructorComandosMA2;
  private readonly observadoresEstado: Set<ObservadorEstadoConexion> = new Set();
  private readonly colaPendientes: ComandoPendiente[] = [];

  private socket: net.Socket | null = null;
  private estadoActual: EstadoConexionMA2 = 'DESCONECTADO';
  private intentosReconexion = 0;
  private temporizadorReconexion: NodeJS.Timeout | null = null;
  private temporizadorAutenticacion: NodeJS.Timeout | null = null;
  private cierreIntencional = false;
  private loginEnviado = false;

  constructor(
    constructorComandos: IConstructorComandosMA2,
    configuracionParcial: Partial<ConfiguracionTelnetMA2> = {}
  ) {
    this.constructorComandos = constructorComandos;
    this.configuracion = {
      ...CONFIGURACION_POR_DEFECTO,
      ...configuracionParcial,
    };
  }

  /**
   * Inicia la conexión TCP hacia el puerto Telnet de la consola GrandMA2.
   */
  public conectar(): void {
    this.cierreIntencional = false;

    if (
      this.estadoActual === 'CONECTANDO' ||
      this.estadoActual === 'CONECTADO' ||
      this.estadoActual === 'AUTENTICADO'
    ) {
      return;
    }

    this.cancelarTemporizadorReconexion();
    this.limpiarSocketActual();
    this.actualizarEstado('CONECTANDO');

    const nuevoSocket = new net.Socket();
    this.socket = nuevoSocket;

    try {
      nuevoSocket.setEncoding('utf8');
      nuevoSocket.setNoDelay(true);
      nuevoSocket.setKeepAlive(true, 5000);
      nuevoSocket.setTimeout(this.configuracion.tiempoEsperaSocketMs);

      this.registrarEventosSocket(nuevoSocket);

      console.info(
        `[ClienteTelnetMA2] Conectando a GrandMA2 en ${this.configuracion.host}:${this.configuracion.puerto}...`
      );
      nuevoSocket.connect(this.configuracion.puerto, this.configuracion.host);
    } catch (error: unknown) {
      const detalle = this.extraerMensajeError(error);
      console.error(`[ClienteTelnetMA2] Error al iniciar la conexión TCP: ${detalle}`);
      this.actualizarEstado('ERROR');
      this.programarReconexion();
    }
  }

  /**
   * Cierra la conexión de forma ordenada y detiene los reintentos automáticos.
   */
  public desconectar(): void {
    this.cierreIntencional = true;
    this.cancelarTemporizadorReconexion();
    this.cancelarTemporizadorAutenticacion();
    this.vaciarColaConFallo();
    this.limpiarSocketActual();
    this.loginEnviado = false;
    this.actualizarEstado('DESCONECTADO');
    console.info('[ClienteTelnetMA2] Conexión Telnet cerrada de forma controlada.');
  }

  /**
   * Actualiza los parámetros de red/credenciales en caliente y reconecta sin reiniciar Electron.
   */
  public actualizarConfiguracionConexion(nuevaConfig: Partial<ConfiguracionTelnetMA2>): void {
    const cambioCritico =
      (nuevaConfig.host !== undefined && nuevaConfig.host !== this.configuracion.host) ||
      (nuevaConfig.puerto !== undefined && nuevaConfig.puerto !== this.configuracion.puerto) ||
      (nuevaConfig.usuario !== undefined && nuevaConfig.usuario !== this.configuracion.usuario) ||
      (nuevaConfig.contrasena !== undefined &&
        nuevaConfig.contrasena !== this.configuracion.contrasena);

    this.configuracion = {
      ...this.configuracion,
      ...nuevaConfig,
    };

    if (!cambioCritico && this.estaListoParaEnviar()) {
      return;
    }

    console.info(
      `[ClienteTelnetMA2] Aplicando nueva configuración (${this.configuracion.host}:${this.configuracion.puerto}) y reconectando...`
    );

    this.cancelarTemporizadorReconexion();
    this.cancelarTemporizadorAutenticacion();
    // Una orden pendiente para la sesión anterior no debe llegar a otro destino tras reconectar.
    this.vaciarColaConFallo();
    this.limpiarSocketActual();
    this.intentosReconexion = 0;
    this.loginEnviado = false;
    this.actualizarEstado('DESCONECTADO');
    this.conectar();
  }

  /**
   * Envía un comando en sintaxis MA2 por el socket TCP.
   * Si la sesión aún no está autenticada, encola el comando temporalmente y dispara la conexión.
   */
  public async enviarComando(comandoRaw: string): Promise<boolean> {
    const comandoNormalizado = this.normalizarTerminacionLinea(comandoRaw);
    if (comandoNormalizado.length === 0) {
      console.warn('[ClienteTelnetMA2] Se intentó enviar un comando vacío; operación ignorada.');
      return false;
    }

    if (this.estaListoParaEnviar() && this.socket !== null) {
      return this.escribirEnSocket(this.socket, comandoNormalizado);
    }

    if (!this.cierreIntencional && this.estadoActual === 'DESCONECTADO') {
      this.conectar();
    }

    return this.encolarComandoPendiente(comandoNormalizado);
  }

  /**
   * Retorna el estado actual de la conexión Telnet.
   */
  public obtenerEstado(): EstadoConexionMA2 {
    return this.estadoActual;
  }

  /**
   * Indica si el socket está abierto, escribible y autenticado en GrandMA2.
   */
  public estaListoParaEnviar(): boolean {
    return (
      this.socket !== null &&
      !this.socket.destroyed &&
      this.socket.writable &&
      this.estadoActual === 'AUTENTICADO'
    );
  }

  /**
   * Suscribe un observador para reaccionar a cambios de estado de conexión.
   * Devuelve una función para cancelar la suscripción.
   */
  public registrarObservadorEstado(observador: ObservadorEstadoConexion): () => void {
    this.observadoresEstado.add(observador);
    return () => {
      this.observadoresEstado.delete(observador);
    };
  }

  private registrarEventosSocket(socketActivo: net.Socket): void {
    socketActivo.on('connect', () => {
      if (this.socket !== socketActivo) {
        return;
      }
      this.manejarConexionExitosa(socketActivo);
    });

    socketActivo.on('data', (datos: Buffer | string) => {
      if (this.socket !== socketActivo) {
        return;
      }
      this.manejarDatosRecibidos(socketActivo, datos);
    });

    socketActivo.on('timeout', () => {
      if (this.socket !== socketActivo) {
        return;
      }
      this.manejarTimeoutSocket(socketActivo);
    });

    socketActivo.on('error', (error: Error) => {
      if (this.socket !== socketActivo) {
        return;
      }
      this.manejarErrorSocket(error);
    });

    socketActivo.on('close', (huboError: boolean) => {
      if (this.socket !== socketActivo) {
        return;
      }
      this.manejarCierreSocket(huboError);
    });
  }

  private manejarConexionExitosa(socketActivo: net.Socket): void {
    this.intentosReconexion = 0;
    this.loginEnviado = false;
    this.cancelarTemporizadorAutenticacion();
    // Desactiva el timeout de lectura tras completar el handshake TCP para no cortar shows en pausa;
    // TCP KeepAlive sigue monitoreando caídas silenciosas del enlace.
    socketActivo.setTimeout(0);
    this.actualizarEstado('CONECTADO');

    console.info(
      `[ClienteTelnetMA2] Conectado a GrandMA2 (${this.configuracion.host}:${this.configuracion.puerto}). Esperando confirmación de login...`
    );

    void this.enviarCredencialesLogin(socketActivo).then((enviado) => {
      if (this.socket !== socketActivo || this.cierreIntencional) {
        return;
      }

      if (!enviado) {
        console.error('[ClienteTelnetMA2] No se pudieron enviar las credenciales de login.');
        this.actualizarEstado('ERROR');
        socketActivo.destroy();
        return;
      }

      if (this.estadoActual !== 'AUTENTICADO') {
        this.iniciarTemporizadorAutenticacion(socketActivo);
      }
    });
  }

  private async enviarCredencialesLogin(socketActivo: net.Socket): Promise<boolean> {
    if (this.loginEnviado) {
      return true;
    }

    try {
      const comandoLogin = this.constructorComandos.construirComandoLogin(
        this.configuracion.usuario,
        this.configuracion.contrasena
      );
      const enviado = await this.escribirEnSocket(socketActivo, comandoLogin);
      if (enviado) {
        this.loginEnviado = true;
        console.info(
          `[ClienteTelnetMA2] Login automático enviado para usuario "${this.configuracion.usuario}".`
        );
      }
      return enviado;
    } catch (error: unknown) {
      const detalle = this.extraerMensajeError(error);
      console.error(`[ClienteTelnetMA2] Error al construir o enviar el login: ${detalle}`);
      return false;
    }
  }

  private manejarDatosRecibidos(socketActivo: net.Socket, datos: Buffer | string): void {
    const respuestaTexto = typeof datos === 'string' ? datos : datos.toString('utf8');
    const textoLimpio = respuestaTexto.trim();
    if (textoLimpio.length === 0) {
      return;
    }

    console.debug(`[GrandMA2 <-] ${textoLimpio}`);

    if (/login incorrect/i.test(textoLimpio)) {
      this.cancelarTemporizadorAutenticacion();
      console.error(
        '[ClienteTelnetMA2] Credenciales rechazadas por GrandMA2. Verifica usuario y contraseña.'
      );
      this.actualizarEstado('ERROR');
      socketActivo.destroy();
      return;
    }

    if (/error\s*#\d+|illegal object|unknown command|syntax error/i.test(textoLimpio)) {
      console.error(`[ClienteTelnetMA2] Error de comando devuelto por GrandMA2: ${textoLimpio}`);
    }

    if (/please login|login:/i.test(textoLimpio) && !this.loginEnviado) {
      void this.enviarCredencialesLogin(socketActivo);
      return;
    }

    // Confirma autenticación real únicamente con un usuario distinto al invitado inicial ('guest').
    if (
      /logged in as\s+(?:user\s+)?'?(?!guest\b)[\w.-]+'?/i.test(textoLimpio) &&
      this.estadoActual !== 'AUTENTICADO'
    ) {
      this.cancelarTemporizadorAutenticacion();
      this.actualizarEstado('AUTENTICADO');
      console.info('[ClienteTelnetMA2] Sesión autenticada y confirmada por GrandMA2.');
      void this.procesarColaPendientes();
    }
  }

  private manejarTimeoutSocket(socketActivo: net.Socket): void {
    if (this.estadoActual === 'CONECTANDO') {
      console.warn(
        `[ClienteTelnetMA2] Tiempo de espera agotado (${this.configuracion.tiempoEsperaSocketMs} ms) al conectar con GrandMA2.`
      );
      this.actualizarEstado('ERROR');
      socketActivo.destroy();
    }
  }

  private manejarErrorSocket(error: Error): void {
    console.error(
      `[ClienteTelnetMA2] Error en socket TCP (${this.configuracion.host}:${this.configuracion.puerto}): ${error.message}`
    );
    if (!this.cierreIntencional) {
      this.actualizarEstado('ERROR');
    }
  }

  private manejarCierreSocket(huboError: boolean): void {
    this.cancelarTemporizadorAutenticacion();
    this.socket = null;
    this.loginEnviado = false;
    // Descarta órdenes aceptadas antes del corte para evitar ejecución tardía inesperada.
    this.vaciarColaConFallo();

    if (this.cierreIntencional) {
      this.actualizarEstado('DESCONECTADO');
      return;
    }

    console.warn(
      `[ClienteTelnetMA2] Conexión cerrada inesperadamente${huboError ? ' debido a un error de red' : ''}.`
    );
    this.programarReconexion();
  }

  /**
   * Programa el siguiente intento de reconexión aplicando Exponential Backoff con jitter.
   */
  private programarReconexion(): void {
    if (this.cierreIntencional || this.temporizadorReconexion !== null) {
      return;
    }

    const exponente = Math.min(this.intentosReconexion, 10);
    const retrasoExponencial =
      this.configuracion.retrasoBaseReconexionMs *
      Math.pow(this.configuracion.factorBackoff, exponente);
    const retrasoTopeado = Math.min(
      retrasoExponencial,
      this.configuracion.retrasoMaximoReconexionMs
    );
    const jitterMs = Math.floor(Math.random() * Math.min(500, retrasoTopeado * 0.2));
    const retrasoFinalMs = Math.min(
      retrasoTopeado + jitterMs,
      this.configuracion.retrasoMaximoReconexionMs
    );

    this.intentosReconexion += 1;
    this.actualizarEstado('RECONECTANDO');

    console.info(
      `[ClienteTelnetMA2] Reintento de conexión #${this.intentosReconexion} programado en ${retrasoFinalMs} ms.`
    );

    this.temporizadorReconexion = setTimeout(() => {
      this.temporizadorReconexion = null;
      if (!this.cierreIntencional) {
        this.conectar();
      }
    }, retrasoFinalMs);
  }

  private iniciarTemporizadorAutenticacion(socketActivo: net.Socket): void {
    this.cancelarTemporizadorAutenticacion();

    this.temporizadorAutenticacion = setTimeout(() => {
      this.temporizadorAutenticacion = null;

      if (
        this.socket !== socketActivo ||
        this.estadoActual === 'AUTENTICADO' ||
        this.cierreIntencional
      ) {
        return;
      }

      console.error(
        `[ClienteTelnetMA2] Tiempo de espera de autenticación agotado (${ClienteTelnetMA2.TIEMPO_ESPERA_AUTENTICACION_MS} ms) sin confirmación de GrandMA2.`
      );
      this.actualizarEstado('ERROR');
      socketActivo.destroy();
    }, ClienteTelnetMA2.TIEMPO_ESPERA_AUTENTICACION_MS);
  }

  private cancelarTemporizadorAutenticacion(): void {
    if (this.temporizadorAutenticacion !== null) {
      clearTimeout(this.temporizadorAutenticacion);
      this.temporizadorAutenticacion = null;
    }
  }

  private cancelarTemporizadorReconexion(): void {
    if (this.temporizadorReconexion !== null) {
      clearTimeout(this.temporizadorReconexion);
      this.temporizadorReconexion = null;
    }
  }

  private limpiarSocketActual(): void {
    this.cancelarTemporizadorAutenticacion();
    if (this.socket === null) {
      return;
    }

    const socketParaCerrar = this.socket;
    this.socket = null;

    try {
      socketParaCerrar.removeAllListeners();
      socketParaCerrar.destroy();
    } catch (error: unknown) {
      console.warn(
        `[ClienteTelnetMA2] Advertencia al destruir socket previo: ${this.extraerMensajeError(error)}`
      );
    }
  }

  private escribirEnSocket(socketActivo: net.Socket, datos: string): Promise<boolean> {
    return new Promise<boolean>((resolver) => {
      if (socketActivo.destroyed || !socketActivo.writable) {
        resolver(false);
        return;
      }

      try {
        socketActivo.write(datos, 'utf8', (error?: Error | null) => {
          if (error !== undefined && error !== null) {
            console.error(`[ClienteTelnetMA2] Fallo al escribir en el socket: ${error.message}`);
            resolver(false);
            return;
          }
          resolver(true);
        });
      } catch (error: unknown) {
        console.error(
          `[ClienteTelnetMA2] Excepción controlada al escribir en el socket: ${this.extraerMensajeError(error)}`
        );
        resolver(false);
      }
    });
  }

  private encolarComandoPendiente(comandoRaw: string): Promise<boolean> {
    return new Promise<boolean>((resolver) => {
      if (this.colaPendientes.length >= this.configuracion.maximoComandosEnCola) {
        const comandoDescartado = this.colaPendientes.shift();
        if (comandoDescartado !== undefined) {
          console.warn(
            `[ClienteTelnetMA2] Cola de comandos llena (${this.configuracion.maximoComandosEnCola}). Se descartó el comando más antiguo.`
          );
          comandoDescartado.resolver(false);
        }
      }

      this.colaPendientes.push({ comandoRaw, resolver });
    });
  }

  private async procesarColaPendientes(): Promise<void> {
    while (this.colaPendientes.length > 0 && this.estaListoParaEnviar() && this.socket !== null) {
      const pendiente = this.colaPendientes.shift();
      if (pendiente === undefined) {
        continue;
      }

      const enviado = await this.escribirEnSocket(this.socket, pendiente.comandoRaw);
      pendiente.resolver(enviado);
    }
  }

  private vaciarColaConFallo(): void {
    while (this.colaPendientes.length > 0) {
      const pendiente = this.colaPendientes.shift();
      if (pendiente !== undefined) {
        pendiente.resolver(false);
      }
    }
  }

  private normalizarTerminacionLinea(comandoRaw: string): string {
    const comandoLimpio = comandoRaw.trim();
    if (comandoLimpio.length === 0) {
      return '';
    }
    return `${comandoLimpio}\r\n`;
  }

  private actualizarEstado(nuevoEstado: EstadoConexionMA2): void {
    if (this.estadoActual === nuevoEstado) {
      return;
    }

    this.estadoActual = nuevoEstado;
    for (const observador of this.observadoresEstado) {
      try {
        observador(nuevoEstado);
      } catch (error: unknown) {
        console.error(
          `[ClienteTelnetMA2] Error en observador de estado: ${this.extraerMensajeError(error)}`
        );
      }
    }
  }

  private extraerMensajeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
