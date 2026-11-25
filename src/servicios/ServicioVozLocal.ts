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
const ANTIGUEDAD_TEMPORAL_MS = 24 * 60 * 60 * 1000;
const ERROR_CACHE_DANADA = /Protobuf parsing failed|Unexpected token|not valid JSON|JSON.parse|parse.*ONNX|ONNX.*pars|invalid.*model|Failed to load model/i;

class ErrorRecuperacionVoz extends Error {
  constructor(causa: unknown) {
    super('La caché de voz dañada no se pudo reparar. Conéctate a internet y vuelve a intentar la transcripción.', { cause: causa });
  }
}

interface EstadoArchivoCache {
  readonly file: string;
  readonly cached: boolean;
}

function estaDentroDe(directorio: string, candidato: string): boolean {
  const relativo = path.relative(directorio, candidato);
  return relativo.length > 0 && relativo !== '..' && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo);
}

/** Rechaza enlaces simbólicos en la raíz y en cada componente del modelo. */
async function rutaModeloSegura(rutaCacheModelos: string): Promise<string | null> {
  const raiz = path.resolve(rutaCacheModelos);
  try {
    if ((await fs.lstat(raiz)).isSymbolicLink() || (await fs.realpath(raiz)) !== raiz) {
      throw new Error('La ruta raíz de la caché de voz contiene un enlace simbólico.');
    }
    let actual = raiz;
    for (const parte of MODELO_ASR_POR_DEFECTO.split('/')) {
      actual = path.join(actual, parte);
      const estado = await fs.lstat(actual);
      if (!estado.isDirectory() || estado.isSymbolicLink() || !estaDentroDe(raiz, await fs.realpath(actual))) {
        throw new Error('La ruta del modelo de voz contiene un enlace simbólico o un archivo inesperado.');
      }
    }
    return actual;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function listarArchivosModelo(rutaModelo: string): Promise<string[]> {
  const encontrados: string[] = [];
  async function recorrer(directorio: string): Promise<void> {
    for (const entrada of await fs.readdir(directorio, { withFileTypes: true })) {
      if (entrada.isSymbolicLink()) continue;
      const ruta = path.join(directorio, entrada.name);
      if (!estaDentroDe(rutaModelo, ruta)) continue;
      if (entrada.isDirectory()) await recorrer(ruta);
      else if (entrada.isFile()) encontrados.push(ruta);
    }
  }
  await recorrer(rutaModelo);
  return encontrados;
}

async function cuarentenarArchivo(rutaModelo: string, rutaArchivo: string): Promise<boolean> {
  if (!estaDentroDe(rutaModelo, rutaArchivo)) return false;
  const estado = await fs.lstat(rutaArchivo);
  if (!estado.isFile() || estado.isSymbolicLink() || !estaDentroDe(rutaModelo, await fs.realpath(rutaArchivo))) return false;
  const destino = `${rutaArchivo}.corrupt.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  await fs.rename(rutaArchivo, destino);
  return true;
}

/** Inspecciona solo el modelo activo; deja las descargas recientes intactas. */
async function inspeccionarCacheDanada(rutaModelo: string): Promise<string[]> {
  const danados: string[] = [];
  for (const ruta of await listarArchivosModelo(rutaModelo)) {
    if (/\.tmp\.[^\\/]+$/.test(ruta) && !/\.corrupt\./.test(path.basename(ruta))) {
      if (Date.now() - (await fs.stat(ruta)).mtimeMs > ANTIGUEDAD_TEMPORAL_MS) {
        await cuarentenarArchivo(rutaModelo, ruta);
      }
    } else if (ruta.endsWith('.json')) {
      const contenido = await fs.readFile(ruta, 'utf8');
      try {
        JSON.parse(contenido);
      } catch {
        danados.push(ruta);
      }
    }
  }
  return danados;
}

/** Comprueba los archivos que la versión instalada de Transformers declara necesarios. */
export async function archivosCacheVozLegibles(
  rutaCacheModelos: string,
  archivos: readonly EstadoArchivoCache[]
): Promise<boolean> {
  if (archivos.length === 0 || archivos.some((archivo) => !archivo.cached)) return false;

  try {
    const raizModelo = await rutaModeloSegura(rutaCacheModelos);
    if (raizModelo === null) return false;

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
  private promesaRecuperacion: Promise<FuncionTranscriptorASR> | null = null;

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
      let transcriptor = await this.obtenerTranscriptor();
      let resultado: Awaited<ReturnType<FuncionTranscriptorASR>>;
      try {
        resultado = await transcriptor(muestrasNormalizadas, { language: 'spanish', task: 'transcribe' });
      } catch (error: unknown) {
        if (this.transcriptorInyectado !== null || !ERROR_CACHE_DANADA.test(String(error))) throw error;
        const vigente = await this.promesaTranscriptor?.catch(() => null);
        if (vigente !== undefined && vigente !== null && vigente !== transcriptor) {
          transcriptor = vigente;
        } else {
          if (this.promesaRecuperacion === null) this.promesaRecuperacion = this.cargarPipelineWhisper(error);
          const recuperacion = this.promesaRecuperacion;
          try {
            transcriptor = await recuperacion;
            this.promesaTranscriptor = Promise.resolve(transcriptor);
          } finally {
            if (this.promesaRecuperacion === recuperacion) this.promesaRecuperacion = null;
          }
        }
        try {
          resultado = await transcriptor(muestrasNormalizadas, { language: 'spanish', task: 'transcribe' });
        } catch (errorReintento: unknown) {
          throw new ErrorRecuperacionVoz(errorReintento);
        }
      }

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

  private async cargarPipelineWhisper(errorCacheInicial?: unknown): Promise<FuncionTranscriptorASR> {
    // env es global en Transformers: serializar inicializaciones y restaurar sus valores.
    const cargaAnterior = ServicioVozLocal.colaCargaModelo;
    let liberarTurno = () => {};
    ServicioVozLocal.colaCargaModelo = new Promise<void>((resolver) => {
      liberarTurno = () => resolver();
    });
    await cargaAnterior;
    try {
      return await this.crearPipelineWhisper(errorCacheInicial);
    } finally {
      liberarTurno();
    }
  }

  private async crearPipelineWhisper(errorCacheInicial?: unknown): Promise<FuncionTranscriptorASR> {
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
      const rutaModelo = await rutaModeloSegura(this.rutaCacheModelos);
      let reparacionIntentada = errorCacheInicial !== undefined;
      if (rutaModelo !== null) {
        const jsonDanados = await inspeccionarCacheDanada(rutaModelo);
        if (jsonDanados.length > 0 || errorCacheInicial !== undefined) {
          this.notificarProgreso('Caché de voz dañada detectada; reparando y descargando modelo...');
          for (const archivo of jsonDanados) await cuarentenarArchivo(rutaModelo, archivo);
          if (errorCacheInicial !== undefined) await this.cuarentenarOnnxDanado(rutaModelo, errorCacheInicial);
          reparacionIntentada = true;
        }
      }
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

      modulo.env.allowRemoteModels = reparacionIntentada ? true : cacheCompleta ? false : entornoAnterior.allowRemoteModels;
      if (cacheCompleta) {
        this.notificarProgreso('Cargando modelo local desde caché (Whisper Tiny español)...');
      } else if (modulo.env.allowRemoteModels) {
        this.notificarProgreso('La caché de voz está incompleta o no se pudo verificar; se intentará obtener lo necesario si hay internet.');
      } else {
        this.notificarProgreso('La caché de voz está incompleta o no se pudo verificar y el acceso remoto está deshabilitado.');
      }

      let ultimoPorcentajeReportado = -1;
      const opcionesPipeline = (soloLocal: boolean) => ({
        dtype: DTYPE_ASR,
        cache_dir: this.rutaCacheModelos,
        local_files_only: soloLocal,
        progress_callback: (info: { status: string; progress?: number; file?: string }) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            const porcentaje = Math.round(info.progress);
            if (porcentaje >= ultimoPorcentajeReportado + 15 || porcentaje === 100) {
              ultimoPorcentajeReportado = porcentaje;
              this.notificarProgreso(`Cargando recurso del modelo (${info.file}): ${porcentaje}%`);
            }
          } else if (info.status === 'ready') {
            this.notificarProgreso('Modelo de voz local listo y en caché.');
          }
        },
      } as const);
      let asr: Awaited<ReturnType<typeof modulo.pipeline>>;
      try {
        asr = await modulo.pipeline(TAREA_ASR, MODELO_ASR_POR_DEFECTO, opcionesPipeline(!reparacionIntentada && (cacheCompleta || !entornoAnterior.allowRemoteModels)));
      } catch (error: unknown) {
        if (reparacionIntentada || !ERROR_CACHE_DANADA.test(String(error)) || rutaModelo === null) {
          if (reparacionIntentada) throw new ErrorRecuperacionVoz(error);
          throw error;
        }
        this.notificarProgreso('Caché de voz dañada detectada; reparando y descargando modelo...');
        const jsonDanados = await inspeccionarCacheDanada(rutaModelo);
        for (const archivo of jsonDanados) await cuarentenarArchivo(rutaModelo, archivo);
        if (jsonDanados.length === 0) await this.cuarentenarOnnxDanado(rutaModelo, error);
        modulo.env.allowRemoteModels = true;
        try {
          asr = await modulo.pipeline(TAREA_ASR, MODELO_ASR_POR_DEFECTO, opcionesPipeline(false));
        } catch (errorReintento: unknown) {
          throw new ErrorRecuperacionVoz(errorReintento);
        }
      }

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

  private async cuarentenarOnnxDanado(rutaModelo: string, error: unknown): Promise<void> {
    const archivos = (await listarArchivosModelo(rutaModelo)).filter((ruta) => ruta.endsWith('.onnx'));
    const detalle = String(error);
    const mencionados = archivos.filter((ruta) => detalle.includes(path.basename(ruta)));
    if (mencionados.length > 0) {
      for (const ruta of mencionados) await cuarentenarArchivo(rutaModelo, ruta);
      return;
    }
    if (!/Protobuf parsing failed|parse.*ONNX|ONNX.*pars|invalid.*model|Failed to load model/i.test(detalle)) return;
    const runtime = await import('onnxruntime-node');
    for (const ruta of archivos) {
      try {
        const sesion = await runtime.InferenceSession.create(ruta);
        await sesion.release();
      } catch {
        await cuarentenarArchivo(rutaModelo, ruta);
      }
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
