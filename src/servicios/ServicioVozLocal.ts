import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ResultadoTranscripcionVoz } from '../interfaces/ComandoLuces';

export type FuncionTranscriptorASR = (
  audioPCM16k: Float32Array,
  opciones: { readonly language: string; readonly task: string }
) => Promise<{ readonly text?: string } | string>;

export type ObservadorProgresoVoz = (mensajeEstado: string) => void;

/**
 * Contrato del servicio local de reconocimiento de voz sin dependencia de nube (RF-06).
 */
export interface IServicioVozLocal {
  transcribirAudioPCM(datosAudio: unknown): Promise<ResultadoTranscripcionVoz>;
}

const UMBRAL_SILENCIO_RMS = 0.004;
const MINIMO_MUESTRAS_AUDIO = 4000;
const MODELO_ASR_POR_DEFECTO = 'Xenova/whisper-tiny';
const TAREA_ASR = 'automatic-speech-recognition';
const DTYPE_ASR = 'q8';
// ModelRegistry detecta tokenizer/procesador por estos metadatos. Si faltan, no
// consultarlo: la versión 4.3.2 memoriza la ausencia y una descarga posterior
// podría omitir esos componentes. Los ONNX se derivan del registro, no de esta lista.
const METADATOS_BASE_WHISPER = [
  { file: 'config.json', cached: true },
  { file: 'tokenizer_config.json', cached: true },
  { file: 'preprocessor_config.json', cached: true },
] as const;

interface EstadoArchivoCache {
  readonly file: string;
  readonly cached: boolean;
}

function estaDentroDe(directorio: string, candidato: string): boolean {
  const relativo = path.relative(directorio, candidato);
  return relativo.length > 0 && relativo !== '..' && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo);
}

/** Comprueba los archivos que la versión instalada de Transformers declara necesarios. */
export async function archivosCacheVozLegibles(
  rutaCacheModelos: string,
  archivos: readonly EstadoArchivoCache[]
): Promise<boolean> {
  if (archivos.length === 0 || archivos.some((archivo) => !archivo.cached)) return false;

  try {
    const raizCache = await fs.realpath(rutaCacheModelos);
    const rutaModelo = path.resolve(raizCache, ...MODELO_ASR_POR_DEFECTO.split('/'));
    const raizModelo = await fs.realpath(rutaModelo);
    if (!estaDentroDe(raizCache, raizModelo)) return false;

    for (const archivo of archivos) {
      const partes = archivo.file.split('/');
      if (partes.some((parte) => parte.length === 0 || parte === '.' || parte === '..' || parte.includes('\\') || parte.includes(':'))) {
        return false;
      }
      const rutaArchivo = path.resolve(raizModelo, ...partes);
      if (!estaDentroDe(raizModelo, rutaArchivo)) return false;
      const rutaReal = await fs.realpath(rutaArchivo);
      if (!estaDentroDe(raizModelo, rutaReal)) return false;

      const manejador = await fs.open(rutaReal, 'r');
      try {
        const datos = await manejador.stat();
        if (!datos.isFile() || datos.size === 0) return false;
        if (archivo.file.endsWith('.json')) {
          JSON.parse(await manejador.readFile({ encoding: 'utf8' }));
        } else {
          const primerByte = Buffer.alloc(1);
          const { bytesRead } = await manejador.read(primerByte, 0, 1, 0);
          if (bytesRead !== 1) return false;
        }
      } finally {
        await manejador.close();
      }
    }
    return true;
  } catch {
    // Ausencia, permisos, JSON truncado o ruta inválida: nunca declarar completa.
    return false;
  }
}

/**
 * Calcula el nivel RMS (Root Mean Square) de una señal PCM Float32.
 */
export function calcularNivelRMS(muestras: Float32Array): number {
  if (muestras.length === 0) {
    return 0;
  }

  let sumaCuadrados = 0;
  for (let i = 0; i < muestras.length; i += 1) {
    const muestra = muestras[i];
    if (Number.isFinite(muestra)) {
      sumaCuadrados += muestra * muestra;
    }
  }

  return Math.sqrt(sumaCuadrados / muestras.length);
}

/**
 * Normaliza la ganancia de la señal PCM al pico objetivo (0.95) para mejorar precisión ASR.
 */
export function normalizarAudioPCM(muestras: Float32Array): Float32Array {
  const resultado = new Float32Array(muestras.length);
  let picoMaximo = 0;

  for (let i = 0; i < muestras.length; i += 1) {
    const muestra = Number.isFinite(muestras[i]) ? muestras[i] : 0;
    const absoluto = Math.abs(muestra);
    if (absoluto > picoMaximo) {
      picoMaximo = absoluto;
    }
    resultado[i] = muestra;
  }

  if (picoMaximo <= 0) {
    return resultado;
  }

  const factorEscala = Math.min(12, 0.95 / picoMaximo);
  for (let i = 0; i < resultado.length; i += 1) {
    resultado[i] = resultado[i] * factorEscala;
  }

  return resultado;
}

/**
 * Limpia espacios múltiples, signos redundantes y alucinaciones comunes de silencio en Whisper.
 */
export function limpiarTextoTranscrito(textoCrudo: string): string {
  const limpio = textoCrudo
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(?:subtitulos|gracias por ver|musica)\.?$/i.test(limpio)) {
    return '';
  }

  return limpio;
}

/**
 * Convierte de manera segura datos PCM transferidos por IPC a Float32Array.
 */
export function convertirAudioAFloat32(datosAudio: unknown): Float32Array | null {
  if (datosAudio instanceof Float32Array) {
    return datosAudio;
  }

  if (datosAudio instanceof ArrayBuffer) {
    if (datosAudio.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
      return null;
    }
    return new Float32Array(datosAudio);
  }

  if (ArrayBuffer.isView(datosAudio)) {
    const vistaBytes = new Uint8Array(
      datosAudio.buffer,
      datosAudio.byteOffset,
      datosAudio.byteLength
    );
    if (vistaBytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
      return null;
    }
    const copiaBuffer = vistaBytes.slice().buffer;
    return new Float32Array(copiaBuffer);
  }

  if (Array.isArray(datosAudio) && datosAudio.every((v) => typeof v === 'number')) {
    return new Float32Array(datosAudio);
  }

  return null;
}

/**
 * Servicio de transcripción de voz en español 100% local usando ONNX (@huggingface/transformers).
 */
export class ServicioVozLocal implements IServicioVozLocal {
  private static colaCargaModelo: Promise<void> = Promise.resolve();
  private readonly rutaCacheModelos: string;
  private readonly transcriptorInyectado: FuncionTranscriptorASR | null;
  private readonly observadorProgreso: ObservadorProgresoVoz | null;
  private promesaTranscriptor: Promise<FuncionTranscriptorASR> | null = null;

  constructor(
    rutaCacheModelos: string,
    transcriptorInyectado: FuncionTranscriptorASR | null = null,
    observadorProgreso: ObservadorProgresoVoz | null = null
  ) {
    this.rutaCacheModelos = rutaCacheModelos;
    this.transcriptorInyectado = transcriptorInyectado;
    this.observadorProgreso = observadorProgreso;
  }

  /**
   * Transcribe un buffer PCM mono a 16000 Hz en español sin bloquear ni crashear Electron.
   */
  public async transcribirAudioPCM(datosAudio: unknown): Promise<ResultadoTranscripcionVoz> {
    const inicioMs = Date.now();
    const muestras = convertirAudioAFloat32(datosAudio);

    if (muestras === null || muestras.length < MINIMO_MUESTRAS_AUDIO) {
      return {
        exito: false,
        texto: '',
        mensaje: 'Grabación demasiado corta. Mantén presionado al menos medio segundo al hablar.',
        duracionMs: Date.now() - inicioMs,
        estadoModelo: 'LISTO',
      };
    }

    const nivelRms = calcularNivelRMS(muestras);
    if (nivelRms < UMBRAL_SILENCIO_RMS) {
      return {
        exito: false,
        texto: '',
        mensaje: 'No se detectó voz suficiente en el micrófono.',
        duracionMs: Date.now() - inicioMs,
        estadoModelo: 'LISTO',
      };
    }

    const muestrasNormalizadas = normalizarAudioPCM(muestras);

    try {
      const transcriptor = await this.obtenerTranscriptor();
      const resultado = await transcriptor(muestrasNormalizadas, {
        language: 'spanish',
        task: 'transcribe',
      });

      const textoBruto =
        typeof resultado === 'string' ? resultado : typeof resultado?.text === 'string' ? resultado.text : '';
      const textoLimpio = limpiarTextoTranscrito(textoBruto);

      if (textoLimpio.length === 0) {
        return {
          exito: false,
          texto: '',
          mensaje: 'No se pudo reconocer ninguna palabra clara en la grabación.',
          duracionMs: Date.now() - inicioMs,
          estadoModelo: 'LISTO',
        };
      }

      return {
        exito: true,
        texto: textoLimpio,
        mensaje: 'Transcripción completada en modo local.',
        duracionMs: Date.now() - inicioMs,
        estadoModelo: 'LISTO',
      };
    } catch (error: unknown) {
      this.promesaTranscriptor = null;
      const detalle = error instanceof Error ? error.message : String(error);
      console.error(`[ServicioVozLocal] Error en transcripción local: ${detalle}`);

      const esFalloRed = /ENOTFOUND|ECONNREFUSED|fetch failed|network|offline|local_files_only|allowRemoteModels=false|file was not found locally/i.test(detalle);
      const mensajeUsuario = esFalloRed
        ? 'Faltan recursos del modelo de voz en caché y no se pudieron obtener. Revisa la conexión a internet para la primera descarga; puedes seguir operando por texto.'
        : `No se pudo transcribir el audio en modo local (${detalle}).`;

      return {
        exito: false,
        texto: '',
        mensaje: mensajeUsuario,
        duracionMs: Date.now() - inicioMs,
        estadoModelo: 'ERROR',
      };
    }
  }

  private async obtenerTranscriptor(): Promise<FuncionTranscriptorASR> {
    if (this.transcriptorInyectado !== null) {
      return this.transcriptorInyectado;
    }

    if (this.promesaTranscriptor === null) {
      this.promesaTranscriptor = this.cargarPipelineWhisper();
    }

    return this.promesaTranscriptor;
  }

  private async cargarPipelineWhisper(): Promise<FuncionTranscriptorASR> {
    // env es global en Transformers: serializar inicializaciones y restaurar sus valores.
    const cargaAnterior = ServicioVozLocal.colaCargaModelo;
    let liberarTurno = () => {};
    ServicioVozLocal.colaCargaModelo = new Promise<void>((resolver) => {
      liberarTurno = () => resolver();
    });
    await cargaAnterior;
    try {
      return await this.crearPipelineWhisper();
    } finally {
      liberarTurno();
    }
  }

  private async crearPipelineWhisper(): Promise<FuncionTranscriptorASR> {
    const modulo = await import('@huggingface/transformers');
    const entornoAnterior = {
      cacheDir: modulo.env.cacheDir,
      allowLocalModels: modulo.env.allowLocalModels,
      allowRemoteModels: modulo.env.allowRemoteModels,
      useFSCache: modulo.env.useFSCache,
    };
    modulo.env.cacheDir = this.rutaCacheModelos;
    modulo.env.allowLocalModels = true;
    modulo.env.useFSCache = true;
    // La inspección del registro también consulta metadatos; prohibir red durante ella.
    modulo.env.allowRemoteModels = false;
    try {
      let cacheCompleta = false;
      try {
        if (await archivosCacheVozLegibles(this.rutaCacheModelos, METADATOS_BASE_WHISPER)) {
          const estado = await modulo.ModelRegistry.is_pipeline_cached_files(
            TAREA_ASR,
            MODELO_ASR_POR_DEFECTO,
            { cache_dir: this.rutaCacheModelos, dtype: DTYPE_ASR }
          );
          cacheCompleta = estado.allCached && await archivosCacheVozLegibles(this.rutaCacheModelos, estado.files);
        }
      } catch (error: unknown) {
        const detalle = error instanceof Error ? error.message : String(error);
        console.warn(`[ServicioVozLocal] No se pudo verificar toda la caché local: ${detalle}`);
      }

      modulo.env.allowRemoteModels = cacheCompleta ? false : entornoAnterior.allowRemoteModels;
      if (cacheCompleta) {
        this.notificarProgreso('Cargando modelo local desde caché (Whisper Tiny español)...');
      } else if (modulo.env.allowRemoteModels) {
        this.notificarProgreso('La caché de voz está incompleta o no se pudo verificar; se intentará obtener lo necesario si hay internet.');
      } else {
        this.notificarProgreso('La caché de voz está incompleta o no se pudo verificar y el acceso remoto está deshabilitado.');
      }

      let ultimoPorcentajeReportado = -1;
      const asr = await modulo.pipeline(TAREA_ASR, MODELO_ASR_POR_DEFECTO, {
        dtype: DTYPE_ASR,
        cache_dir: this.rutaCacheModelos,
        local_files_only: cacheCompleta || !entornoAnterior.allowRemoteModels,
        progress_callback: (info) => {
          if (info.status === 'progress') {
            const porcentaje = Math.round(info.progress);
            if (porcentaje >= ultimoPorcentajeReportado + 15 || porcentaje === 100) {
              ultimoPorcentajeReportado = porcentaje;
              this.notificarProgreso(`Cargando recurso del modelo (${info.file}): ${porcentaje}%`);
            }
          } else if (info.status === 'ready') {
            this.notificarProgreso('Modelo de voz local listo y en caché.');
          }
        },
      });

      return async (audioPCM16k, opciones) => {
        const salida = await asr(audioPCM16k, {
          language: opciones.language,
          task: opciones.task,
        });
        if (Array.isArray(salida)) {
          return { text: salida[0]?.text ?? '' };
        }
        return { text: salida.text };
      };
    } finally {
      modulo.env.cacheDir = entornoAnterior.cacheDir;
      modulo.env.allowLocalModels = entornoAnterior.allowLocalModels;
      modulo.env.allowRemoteModels = entornoAnterior.allowRemoteModels;
      modulo.env.useFSCache = entornoAnterior.useFSCache;
    }
  }

  private notificarProgreso(mensaje: string): void {
    console.info(`[ServicioVozLocal] ${mensaje}`);
    if (this.observadorProgreso !== null) {
      try {
        this.observadorProgreso(mensaje);
      } catch {
        // Ignora errores de notificación UI
      }
    }
  }
}
