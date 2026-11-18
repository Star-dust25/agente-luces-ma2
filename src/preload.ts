import { contextBridge, ipcRenderer } from 'electron';
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
}

declare global {
  interface Window {
    api: ApiPuenteMA2;
  }
}

const puenteApi: ApiPuenteMA2 = {
  enviarComandoLuces: (cargaUtil: ComandoLuces): Promise<RespuestaComandoIPC> => {
    return ipcRenderer.invoke('ma2:enviar-comando', cargaUtil);
  },
  obtenerEstadoConexion: (): Promise<EstadoConexionMA2> => {
    return ipcRenderer.invoke('ma2:obtener-estado');
  },
};

contextBridge.exposeInMainWorld('api', puenteApi);
