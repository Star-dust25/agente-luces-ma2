import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  ComandoLuces,
  ConfiguracionSistemaMA2,
  EstadoConexionMA2,
  RespuestaComandoIPC,
  RespuestaGuardarConfigIPC,
  ResultadoTranscripcionVoz,
} from './interfaces/ComandoLuces';

/**
 * Contrato de la API segura expuesta al Proceso de Renderizado mediante contextBridge.
 */
export interface ApiPuenteMA2 {
  readonly enviarComandoLuces: (cargaUtil: ComandoLuces) => Promise<RespuestaComandoIPC>;
  readonly obtenerEstadoConexion: () => Promise<EstadoConexionMA2>;
  readonly suscribirEstadoConexion: (
    observador: (estado: EstadoConexionMA2) => void
  ) => () => void;
  readonly suscribirProgresoVoz: (observador: (mensaje: string) => void) => () => void;
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

const puenteApi: ApiPuenteMA2 = {
  enviarComandoLuces: (cargaUtil: ComandoLuces): Promise<RespuestaComandoIPC> => {
    return ipcRenderer.invoke('ma2:enviar-comando', cargaUtil);
  },
  obtenerEstadoConexion: (): Promise<EstadoConexionMA2> => {
    return ipcRenderer.invoke('ma2:obtener-estado');
  },
  suscribirEstadoConexion: (
    observador: (estado: EstadoConexionMA2) => void
  ): (() => void) => {
    const manejador = (_evento: IpcRendererEvent, estado: EstadoConexionMA2): void => {
      observador(estado);
    };
    ipcRenderer.on('ma2:estado-conexion', manejador);
    return () => {
      ipcRenderer.removeListener('ma2:estado-conexion', manejador);
    };
  },
  suscribirProgresoVoz: (observador: (mensaje: string) => void): (() => void) => {
    const manejador = (_evento: IpcRendererEvent, mensaje: string): void => {
      observador(mensaje);
    };
    ipcRenderer.on('ma2:progreso-voz', manejador);
    return () => {
      ipcRenderer.removeListener('ma2:progreso-voz', manejador);
    };
  },
  obtenerConfiguracion: (): Promise<ConfiguracionSistemaMA2> => {
    return ipcRenderer.invoke('ma2:obtener-config');
  },
  guardarConfiguracion: (
    config: ConfiguracionSistemaMA2
  ): Promise<RespuestaGuardarConfigIPC> => {
    return ipcRenderer.invoke('ma2:guardar-config', config);
  },
  transcribirAudio: (muestrasPCM16k: Float32Array): Promise<ResultadoTranscripcionVoz> => {
    return ipcRenderer.invoke('ma2:transcribir-audio', muestrasPCM16k);
  },
};

contextBridge.exposeInMainWorld('api', puenteApi);
