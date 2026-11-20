export const FRECUENCIA_OBJETIVO_HZ = 16000;

/**
 * Concatena múltiples bloques PCM Float32 en un único arreglo continuo.
 */
export function concatenarBloquesAudio(bloques: readonly Float32Array[]): Float32Array {
  let longitudTotal = 0;
  for (const bloque of bloques) {
    longitudTotal += bloque.length;
  }

  const combinado = new Float32Array(longitudTotal);
  let desplazamiento = 0;
  for (const bloque of bloques) {
    combinado.set(bloque, desplazamiento);
    desplazamiento += bloque.length;
  }
  return combinado;
}

/**
 * Remuestrea una señal mono PCM desde `frecuenciaOrigen` Hz hacia 16000 Hz mediante interpolación lineal.
 */
export function remuestrearA16kHz(
  muestras: Float32Array,
  frecuenciaOrigen: number,
  frecuenciaDestino: number = FRECUENCIA_OBJETIVO_HZ
): Float32Array {
  if (muestras.length === 0 || frecuenciaOrigen <= 0) {
    return new Float32Array(0);
  }
  if (frecuenciaOrigen === frecuenciaDestino) {
    return new Float32Array(muestras);
  }

  const proporcion = frecuenciaOrigen / frecuenciaDestino;
  const longitudDestino = Math.max(1, Math.round(muestras.length / proporcion));
  const salida = new Float32Array(longitudDestino);

  for (let i = 0; i < longitudDestino; i += 1) {
    const posicionOrigen = i * proporcion;
    const indiceInferior = Math.floor(posicionOrigen);
    const indiceSuperior = Math.min(indiceInferior + 1, muestras.length - 1);
    const fraccion = posicionOrigen - indiceInferior;
    salida[i] =
      muestras[indiceInferior] * (1 - fraccion) + muestras[indiceSuperior] * fraccion;
  }

  return salida;
}

/**
 * Calcula un nivel visual de volumen (0 a 100) a partir de muestras de audio.
 */
export function calcularNivelVisualVoz(muestras: Float32Array): number {
  if (muestras.length === 0) {
    return 0;
  }
  let sumaCuadrados = 0;
  for (let i = 0; i < muestras.length; i += 1) {
    sumaCuadrados += muestras[i] * muestras[i];
  }
  const rms = Math.sqrt(sumaCuadrados / muestras.length);
  return Math.min(100, Math.round(rms * 420));
}

function traducirErrorMicrofono(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Permiso de micrófono denegado. Habilítalo en la configuración del sistema o usa entrada por texto.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No se detectó ningún micrófono conectado en este equipo.';
    }
    if (error.name === 'NotReadableError') {
      return 'El micrófono está siendo utilizado por otra aplicación.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'No se pudo acceder al micrófono.';
}

/**
 * Grabadora de voz para navegador/Electron Renderer basada en Web Audio API (mono 16 kHz).
 */
export class GrabadoraVozCabina {
  private flujoMedia: MediaStream | null = null;
  private contextoAudio: AudioContext | null = null;
  private fuenteMedia: MediaStreamAudioSourceNode | null = null;
  private procesadorNodo: ScriptProcessorNode | null = null;
  private gananciaSilencio: GainNode | null = null;
  private bloquesCapturados: Float32Array[] = [];
  private grabando = false;

  public estaGrabando(): boolean {
    return this.grabando;
  }

  /**
   * Solicita acceso al micrófono e inicia la captura de audio con medidor de nivel en vivo.
   */
  public async iniciar(alCambiarNivel: (nivel: number) => void): Promise<void> {
    if (this.grabando) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      navigator.mediaDevices === undefined ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new Error('Este entorno no soporta captura de micrófono (getUserMedia).');
    }

    try {
      const flujo = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const contexto = new AudioContext();
      if (contexto.state === 'suspended') {
        await contexto.resume();
      }

      const fuente = contexto.createMediaStreamSource(flujo);
      const procesador = contexto.createScriptProcessor(4096, 1, 1);
      const gananciaCero = contexto.createGain();
      gananciaCero.gain.value = 0;

      this.bloquesCapturados = [];
      procesador.onaudioprocess = (eventoAudio: AudioProcessingEvent) => {
        if (!this.grabando) {
          return;
        }
        const canal = eventoAudio.inputBuffer.getChannelData(0);
        this.bloquesCapturados.push(new Float32Array(canal));
        alCambiarNivel(calcularNivelVisualVoz(canal));
      };

      fuente.connect(procesador);
      procesador.connect(gananciaCero);
      gananciaCero.connect(contexto.destination);

      this.flujoMedia = flujo;
      this.contextoAudio = contexto;
      this.fuenteMedia = fuente;
      this.procesadorNodo = procesador;
      this.gananciaSilencio = gananciaCero;
      this.grabando = true;
    } catch (error: unknown) {
      await this.liberarRecursos();
      throw new Error(traducirErrorMicrofono(error));
    }
  }

  /**
   * Detiene la captura, libera el hardware del micrófono y devuelve PCM mono a 16000 Hz.
   */
  public async detener(): Promise<Float32Array> {
    this.grabando = false;
    const frecuenciaOrigen = this.contextoAudio?.sampleRate ?? FRECUENCIA_OBJETIVO_HZ;
    const combinado = concatenarBloquesAudio(this.bloquesCapturados);
    this.bloquesCapturados = [];

    await this.liberarRecursos();
    return remuestrearA16kHz(combinado, frecuenciaOrigen, FRECUENCIA_OBJETIVO_HZ);
  }

  public async cancelar(): Promise<void> {
    this.grabando = false;
    this.bloquesCapturados = [];
    await this.liberarRecursos();
  }

  private async liberarRecursos(): Promise<void> {
    try {
      this.procesadorNodo?.disconnect();
      this.fuenteMedia?.disconnect();
      this.gananciaSilencio?.disconnect();
    } catch {
      // Ignora desconexiones ya liberadas
    }

    if (this.flujoMedia !== null) {
      for (const pista of this.flujoMedia.getTracks()) {
        pista.stop();
      }
    }

    if (this.contextoAudio !== null && this.contextoAudio.state !== 'closed') {
      try {
        await this.contextoAudio.close();
      } catch {
        // Ignora errores de cierre del contexto
      }
    }

    this.procesadorNodo = null;
    this.fuenteMedia = null;
    this.gananciaSilencio = null;
    this.flujoMedia = null;
    this.contextoAudio = null;
  }
}
