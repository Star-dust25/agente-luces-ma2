/**
 * Acciones soportadas entre el Frontend (Renderer) y el Backend (Main Process).
 */
export type TipoAccionLuz = 'encender' | 'apagar' | 'ajustar' | 'color';

/**
 * Parámetros de control soportados por GrandMA2.
 */
export type TipoParametroLuz = 'intensidad' | 'color';

/**
 * Contrato JSON de comandos enviados al proceso principal por IPC.
 */
export interface ComandoLuces {
  readonly accion: TipoAccionLuz;
  readonly grupo: string;
  readonly valor: string;
  readonly tipo: TipoParametroLuz;
}

/**
 * Estados del ciclo de vida de la conexión TCP/Telnet con GrandMA2.
 */
export type EstadoConexionMA2 =
  | 'DESCONECTADO'
  | 'CONECTANDO'
  | 'CONECTADO'
  | 'AUTENTICADO'
  | 'RECONECTANDO'
  | 'ERROR';

/**
 * Respuesta devuelta por el proceso principal de Electron tras procesar un comando.
 */
export interface RespuestaComandoIPC {
  readonly exito: boolean;
  readonly comandoGenerado: string | null;
  readonly mensaje: string;
  readonly estadoConexion: EstadoConexionMA2;
  readonly marcaTiempo: string;
}

/**
 * Contrato de la API expuesta de forma segura mediante contextBridge en preload.ts.
 */
export interface ApiPuenteMA2 {
  readonly enviarComandoLuces: (cargaUtil: ComandoLuces) => Promise<RespuestaComandoIPC>;
  readonly obtenerEstadoConexion: () => Promise<EstadoConexionMA2>;
  readonly suscribirEstadoConexion: (
    observador: (estado: EstadoConexionMA2) => void
  ) => () => void;
}

declare global {
  interface Window {
    api?: ApiPuenteMA2;
  }
}
