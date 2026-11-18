import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  ComandoLuces,
  EstadoConexionMA2,
  RespuestaComandoIPC,
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
};

contextBridge.exposeInMainWorld('api', puenteApi);
