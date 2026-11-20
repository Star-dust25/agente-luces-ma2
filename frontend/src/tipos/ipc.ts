/**
 * Acciones soportadas entre el Frontend (Renderer) y el Backend (Main Process).
 */
export type TipoAccionLuz =
  | 'encender'
  | 'apagar'
  | 'ajustar'
  | 'color'
  | 'siguiente'
  | 'anterior'
  | 'ir_cue'
  | 'detener';

/**
 * Parámetros de control soportados por GrandMA2.
 */
export type TipoParametroLuz = 'intensidad' | 'color' | 'cue';

/**
 * Contrato JSON de comandos enviados al proceso principal por IPC.
 */
export interface ComandoLuces {
  readonly accion: TipoAccionLuz;
  readonly grupo: string;
  readonly valor: string;
  readonly tipo: TipoParametroLuz;
  readonly executor?: string;
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

export type TemaInterfaz = 'cabina' | 'dia';

export interface ConfiguracionConexionTelnet {
  readonly host: string;
  readonly puerto: number;
  readonly usuario: string;
  readonly contrasena: string;
}

export interface ConfiguracionGrupoMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly sinonimos: readonly string[];
}

export interface ConfiguracionColorMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly preset: string;
  readonly hex: string;
  readonly sinonimos: readonly string[];
}

export interface ConfiguracionInterfazMA2 {
  readonly tema: TemaInterfaz;
  readonly autoEjecutarVoz: boolean;
}

export interface ConfiguracionSistemaMA2 {
  readonly conexion: ConfiguracionConexionTelnet;
  readonly executorPorDefecto: number;
  readonly grupos: readonly ConfiguracionGrupoMA2[];
  readonly colores: readonly ConfiguracionColorMA2[];
  readonly interfaz: ConfiguracionInterfazMA2;
}

export interface RespuestaGuardarConfigIPC {
  readonly exito: boolean;
  readonly configuracion: ConfiguracionSistemaMA2;
  readonly mensaje: string;
}

export interface ResultadoTranscripcionVoz {
  readonly exito: boolean;
  readonly texto: string;
  readonly mensaje: string;
  readonly duracionMs: number;
  readonly estadoModelo?: 'LISTO' | 'DESCARGANDO' | 'ERROR';
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
  readonly obtenerConfiguracion: () => Promise<ConfiguracionSistemaMA2>;
  readonly guardarConfiguracion: (
    config: ConfiguracionSistemaMA2
  ) => Promise<RespuestaGuardarConfigIPC>;
  readonly transcribirAudio: (
    muestrasPCM16k: Float32Array
  ) => Promise<ResultadoTranscripcionVoz>;
}

declare global {
  interface Window {
    api?: ApiPuenteMA2;
  }
}
