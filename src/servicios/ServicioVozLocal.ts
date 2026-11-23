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

      const esFalloRed = /ENOTFOUND|ECONNREFUSED|fetch failed|network|offline/i.test(detalle);
      const mensajeUsuario = esFalloRed
        ? 'El modelo de voz local aún no está en caché y no hay conexión a internet para descargarlo por primera vez. Puedes seguir operando por texto sin interrupciones.'
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
    this.notificarProgreso('Cargando modelo de voz local (Whisper Tiny español)...');
    const modulo = await import('@huggingface/transformers');
    modulo.env.cacheDir = this.rutaCacheModelos;
    modulo.env.allowLocalModels = true;
    modulo.env.useFSCache = true;

    let ultimoPorcentajeReportado = -1;
    const asr = await modulo.pipeline('automatic-speech-recognition', MODELO_ASR_POR_DEFECTO, {
      dtype: 'q8',
      cache_dir: this.rutaCacheModelos,
      progress_callback: (info) => {
        if (info.status === 'progress') {
          const porcentaje = Math.round(info.progress);
          if (porcentaje >= ultimoPorcentajeReportado + 15 || porcentaje === 100) {
            ultimoPorcentajeReportado = porcentaje;
            this.notificarProgreso(
              `Cargando recurso del modelo (${info.file}): ${porcentaje}%`
            );
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
