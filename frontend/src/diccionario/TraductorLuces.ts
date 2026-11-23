import type {
  ComandoLuces,
  ConfiguracionColorMA2,
  ConfiguracionGrupoMA2,
  TipoAccionLuz,
} from '../tipos/ipc';

/**
 * Definición de un grupo o zona de iluminación en la consola GrandMA2.
 */
export type DefinicionGrupoMA2 = ConfiguracionGrupoMA2;

/**
 * Definición de un preset cromático del Pool 4 (Color) en GrandMA2.
 */
export type DefinicionColorMA2 = ConfiguracionColorMA2;

/**
 * Resultado estructurado de interpretar una orden simple o compuesta en lenguaje natural.
 */
export interface ResultadoInterpretacion {
  readonly exito: boolean;
  readonly textoOriginal: string;
  readonly textoNormalizado: string;
  readonly comandoPayload: ComandoLuces | null;
  readonly comandosPayload: readonly ComandoLuces[];
  readonly sintaxisMA2: string | null;
  readonly sintaxisListaMA2: readonly string[];
  readonly resumenesComandos: readonly string[];
  readonly etiquetaGrupo: string;
  readonly etiquetaAccion: string;
  readonly etiquetaValor: string;
  readonly colorHex?: string;
  readonly mensajeError?: string;
}

export const CATALOGO_GRUPOS: readonly DefinicionGrupoMA2[] = [
  {
    id: '1',
    nombre: 'Frontales',
    descripcion: 'Luz clave y rostro de escenario',
    sinonimos: ['frontales', 'frontal', 'frente', 'rostro', 'cara'],
  },
  {
    id: '2',
    nombre: 'Contraluz',
    descripcion: 'Recorte trasero y silueta',
    sinonimos: ['contraluz', 'contraluces', 'contra', 'contras', 'trasera', 'traseras', 'back'],
  },
  {
    id: '3',
    nombre: 'Laterales',
    descripcion: 'Calles y barras laterales',
    sinonimos: ['laterales', 'lateral', 'calles', 'calle', 'side', 'costados'],
  },
  {
    id: '4',
    nombre: 'Wash Escenario',
    descripcion: 'Baño general y ambiente de piso',
    sinonimos: ['wash', 'ambiente', 'piso', 'bano', 'fondo', 'ciclorama'],
  },
  {
    id: '5',
    nombre: 'Cabezas Móviles',
    descripcion: 'Beams, spots y efectos aéreos',
    sinonimos: ['moviles', 'movil', 'cabezas', 'cabeza', 'beams', 'beam', 'spots', 'spot'],
  },
  {
    id: '6',
    nombre: 'Público / Blinders',
    descripcion: 'Cegadoras e iluminación de audiencia',
    sinonimos: ['publico', 'audiencia', 'blinders', 'blinder', 'cegadoras', 'cegadora'],
  },
] as const;

export const CATALOGO_COLORES: readonly DefinicionColorMA2[] = [
  {
    id: 'blanco',
    nombre: 'Blanco Frío',
    preset: '4.1',
    hex: '#f8fafc',
    sinonimos: ['blanco', 'blanca', 'blancos', 'blancas', 'frio', 'white', 'neutro'],
  },
  {
    id: 'rojo',
    nombre: 'Rojo Carmesí',
    preset: '4.2',
    hex: '#ef4444',
    sinonimos: ['rojo', 'roja', 'rojos', 'rojas', 'red', 'carmesi'],
  },
  {
    id: 'ambar',
    nombre: 'Ámbar Cálido',
    preset: '4.3',
    hex: '#f59e0b',
    sinonimos: ['ambar', 'calido', 'calida', 'naranja', 'oro', 'dorado'],
  },
  {
    id: 'amarillo',
    nombre: 'Amarillo Sol',
    preset: '4.4',
    hex: '#eab308',
    sinonimos: ['amarillo', 'amarilla', 'sol'],
  },
  {
    id: 'verde',
    nombre: 'Verde Esmeralda',
    preset: '4.5',
    hex: '#10b981',
    sinonimos: ['verde', 'verdes', 'esmeralda', 'green'],
  },
  {
    id: 'cian',
    nombre: 'Cian Turquesa',
    preset: '4.6',
    hex: '#06b6d4',
    sinonimos: ['cian', 'celeste', 'turquesa', 'agua', 'cyan'],
  },
  {
    id: 'azul',
    nombre: 'Azul Cobalto',
    preset: '4.7',
    hex: '#3b82f6',
    sinonimos: ['azul', 'azules', 'blue', 'marino', 'cobalto'],
  },
  {
    id: 'magenta',
    nombre: 'Magenta Neón',
    preset: '4.8',
    hex: '#ec4899',
    sinonimos: ['magenta', 'rosa', 'fucsia', 'neon', 'pink'],
  },
  {
    id: 'violeta',
    nombre: 'Violeta Escénico',
    preset: '4.9',
    hex: '#a855f7',
    sinonimos: ['violeta', 'morado', 'morada', 'purpura', 'lila'],
  },
] as const;

const PALABRAS_GENERAL = ['todos', 'todas', 'todo', 'general', 'escenario', 'master'] as const;
const PALABRAS_APAGAR = [
  'apagar',
  'apaga',
  'apagado',
  'apagada',
  'apagados',
  'apagadas',
  'apagon',
  'blackout',
  'cerrar',
  'off',
] as const;
const PALABRAS_ENCENDER = [
  'encender',
  'enciende',
  'encendido',
  'encendida',
  'encendidos',
  'encendidas',
  'prender',
  'prende',
  'activar',
  'activa',
  'on',
  'full',
  'maximo',
] as const;
const PALABRAS_AJUSTAR = [
  'ajustar',
  'ajusta',
  'subir',
  'sube',
  'bajar',
  'baja',
  'poner',
  'pon',
  'dejar',
  'cambiar',
  'atenuar',
  'dimmer',
] as const;

const PALABRAS_CUE_ENTIDAD = ['escena', 'escenas', 'cue', 'cues', 'secuencia', 'executor', 'ejecutor'] as const;
const PALABRAS_CUE_SIGUIENTE = ['siguiente', 'proxima', 'proximo', 'avanzar', 'avanza', 'adelante', 'go'] as const;
const PALABRAS_CUE_ANTERIOR = ['anterior', 'previa', 'previo', 'volver', 'vuelve', 'retroceder', 'retrocede', 'atras', 'goback'] as const;
const PALABRAS_CUE_DETENER = ['detener', 'deten', 'parar', 'para', 'apagar', 'apaga', 'off', 'stop'] as const;

const CARACTERES_INYECCION = /[\r\n;\x00-\x1f]/;

const PLANTILLAS_AUTOCOMPLETADO: readonly string[] = [
  'Frontales al 50%',
  'Frontales al 70% en azul',
  'Frontales al 100% y contras apagadas',
  'Frontales al 50%, contras en rojo',
  'Siguiente escena',
  'Escena anterior',
  'Ir a escena 3',
  'Detener escena',
  'Encender contras en blanco',
  'Contraluz en rojo',
  'Laterales al 75%',
  'Wash en ámbar',
  'Cabezas móviles en azul',
  'Público al 100%',
  'Apagar frontales',
  'Apagón general',
];

interface ResolucionGrupoInterna {
  readonly exito: boolean;
  readonly id?: string;
  readonly nombre?: string;
  readonly textoSinGrupo?: string;
  readonly error?: string;
  readonly esAmbiguo?: boolean;
}

interface ResolucionIntensidadInterna {
  readonly exito: boolean;
  readonly accion?: TipoAccionLuz;
  readonly valor?: string;
  readonly error?: string;
}

/**
 * Traductor de lenguaje natural en español a payloads tipados para GrandMA2 (RF-03, RF-04, RF-05 y RF-07).
 */
export class TraductorLuces {
  private static gruposActivos: readonly DefinicionGrupoMA2[] = CATALOGO_GRUPOS;
  private static coloresActivos: readonly DefinicionColorMA2[] = CATALOGO_COLORES;
  private static executorPorDefectoActivo = 1;

  /**
   * Actualiza en tiempo real el catálogo de grupos, colores y executor por defecto desde config.json.
   */
  public static configurarCatalogoDinamico(configuracion: {
    readonly grupos?: readonly DefinicionGrupoMA2[];
    readonly colores?: readonly DefinicionColorMA2[];
    readonly executorPorDefecto?: number;
  }): void {
    if (configuracion.grupos !== undefined && configuracion.grupos.length > 0) {
      TraductorLuces.gruposActivos = configuracion.grupos;
    }
    if (configuracion.colores !== undefined) {
      TraductorLuces.coloresActivos = configuracion.colores;
    }
    if (
      configuracion.executorPorDefecto !== undefined &&
      Number.isInteger(configuracion.executorPorDefecto) &&
      configuracion.executorPorDefecto >= 1
    ) {
      TraductorLuces.executorPorDefectoActivo = configuracion.executorPorDefecto;
    }
  }

  public static restablecerCatalogoPorDefecto(): void {
    TraductorLuces.gruposActivos = CATALOGO_GRUPOS;
    TraductorLuces.coloresActivos = CATALOGO_COLORES;
    TraductorLuces.executorPorDefectoActivo = 1;
  }

  public static obtenerGruposActivos(): readonly DefinicionGrupoMA2[] {
    return TraductorLuces.gruposActivos;
  }

  public static obtenerColoresActivos(): readonly DefinicionColorMA2[] {
    return TraductorLuces.coloresActivos;
  }

  public static obtenerExecutorPorDefecto(): number {
    return TraductorLuces.executorPorDefectoActivo;
  }

  /**
   * Normaliza la entrada eliminando tildes/diacríticos, pasando a minúsculas
   * y limpiando signos de puntuación innecesarios.
   */
  public static normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9.%+\-\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Genera hasta `limite` sugerencias offline relevantes según lo que el operador escribe.
   */
  public static generarSugerencias(textoParcial: string, limite = 3): readonly string[] {
    const consulta = TraductorLuces.normalizarTexto(textoParcial);
    if (consulta.length === 0) {
      return [];
    }

    const tokens = consulta.split(' ').filter((t) => t.length > 0);
    const coincidencias = PLANTILLAS_AUTOCOMPLETADO.filter((plantilla) => {
      const plantillaNorm = TraductorLuces.normalizarTexto(plantilla);
      if (plantillaNorm === consulta) {
        return false;
      }
      return tokens.every((token) => plantillaNorm.includes(token));
    });

    if (coincidencias.length >= limite) {
      return coincidencias.slice(0, limite);
    }

    const dinamicas: string[] = [...coincidencias];
    const grupoMencionado = TraductorLuces.gruposActivos.find((g) =>
      g.sinonimos.some((s) => tokens.some((t) => s.startsWith(t) || t === s))
    );

    if (grupoMencionado !== undefined) {
      const nombreBase = grupoMencionado.nombre;
      const propuestas = [
        `${nombreBase} al 50%`,
        `${nombreBase} al 70% en azul`,
        `Apagar ${nombreBase.toLowerCase()}`,
      ];
      for (const propuesta of propuestas) {
        if (
          dinamicas.length < limite &&
          !dinamicas.includes(propuesta) &&
          TraductorLuces.normalizarTexto(propuesta) !== consulta
        ) {
          dinamicas.push(propuesta);
        }
      }
    }

    return dinamicas.slice(0, limite);
  }

  /**
   * Interpreta una instrucción simple o compuesta en lenguaje natural y devuelve
   * la lista ordenada de comandos estructurados junto con su vista previa en sintaxis GrandMA2.
   */
  public static interpretarOrden(instruccionUsuario: string): ResultadoInterpretacion {
    const textoOriginal = instruccionUsuario.trim();

    if (CARACTERES_INYECCION.test(instruccionUsuario)) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        TraductorLuces.normalizarTexto(textoOriginal),
        '—',
        'Bloqueada',
        'Caracteres no permitidos detectados por seguridad.'
      );
    }

    const textoNormalizado = TraductorLuces.normalizarTexto(textoOriginal);
    if (textoNormalizado.length === 0) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        '—',
        '—',
        'Escribe una orden de iluminación antes de interpretar.'
      );
    }

    const clausulas = TraductorLuces.dividirEnClausulas(textoOriginal);
    if (clausulas.length === 0) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        '—',
        'Inválida',
        'Una de las cláusulas de la orden está vacía.'
      );
    }

    if (clausulas.length === 1) {
      return TraductorLuces.interpretarClausulaSimple(clausulas[0]);
    }

    const comandosAcumulados: ComandoLuces[] = [];
    const sintaxisAcumulada: string[] = [];
    const resumenesAcumulados: string[] = [];

    for (let indice = 0; indice < clausulas.length; indice += 1) {
      const clausula = clausulas[indice];
      const resultadoParcial = TraductorLuces.interpretarClausulaSimple(clausula);

      if (!resultadoParcial.exito || resultadoParcial.comandosPayload.length === 0) {
        return TraductorLuces.crearResultadoError(
          textoOriginal,
          textoNormalizado,
          resultadoParcial.etiquetaGrupo,
          resultadoParcial.etiquetaAccion,
          `Cláusula ${indice + 1} ("${clausula}"): ${resultadoParcial.mensajeError ?? 'No válida.'}`
        );
      }

      comandosAcumulados.push(...resultadoParcial.comandosPayload);
      sintaxisAcumulada.push(...resultadoParcial.sintaxisListaMA2);
      resumenesAcumulados.push(...resultadoParcial.resumenesComandos);
    }

    return {
      exito: true,
      textoOriginal,
      textoNormalizado,
      comandoPayload: comandosAcumulados[0],
      comandosPayload: comandosAcumulados,
      sintaxisMA2: sintaxisAcumulada.join('  ·  '),
      sintaxisListaMA2: sintaxisAcumulada,
      resumenesComandos: resumenesAcumulados,
      etiquetaGrupo: `${clausulas.length} cláusulas`,
      etiquetaAccion: `Orden Compuesta (${comandosAcumulados.length})`,
      etiquetaValor: sintaxisAcumulada.join(' · '),
    };
  }

  private static dividirEnClausulas(textoOriginal: string): readonly string[] {
    if (textoOriginal.includes(',')) {
      const segmentosComa = textoOriginal.split(',').map((s) => s.trim());
      if (segmentosComa.some((s) => s.length === 0)) {
        return [];
      }
      const resultado: string[] = [];
      for (const segmento of segmentosComa) {
        resultado.push(...TraductorLuces.dividirSegmentoPorConectorY(segmento));
      }
      return resultado;
    }

    return TraductorLuces.dividirSegmentoPorConectorY(textoOriginal);
  }

  private static dividirSegmentoPorConectorY(segmento: string): readonly string[] {
    const partes = segmento.split(/\s+y\s+/i).map((p) => p.trim());
    if (partes.length < 2) {
      return [segmento.trim()];
    }

    const todasIndependientes = partes.every((parte) =>
      TraductorLuces.esSubordenIndependiente(parte)
    );

    return todasIndependientes ? partes : [segmento.trim()];
  }

  private static esSubordenIndependiente(fragmento: string): boolean {
    const norm = TraductorLuces.normalizarTexto(fragmento);
    if (norm.length === 0) {
      return false;
    }

    const palabras = norm.split(' ');
    if (TraductorLuces.esOrdenDeCue(norm, palabras)) {
      return true;
    }

    const tieneGrupoCatalogo = TraductorLuces.gruposActivos.some((g) =>
      g.sinonimos.some((s) => palabras.includes(s))
    );
    const tieneGrupoNumerico = /\bgrupos?\s+\d+/.test(norm);
    const tienePalabraGeneral = PALABRAS_GENERAL.some((p) => palabras.includes(p));
    const esBlackout = palabras.some((p) => p === 'apagon' || p === 'blackout');

    if (esBlackout) {
      return true;
    }

    const tieneGrupo = tieneGrupoCatalogo || tieneGrupoNumerico || tienePalabraGeneral;
    if (!tieneGrupo) {
      return false;
    }

    const sinGrupo = norm
      .replace(/\bgrupos?\s+\d+(?:\s*(?:al|a|hasta|thru|-)\s*\d+)?/g, ' ')
      .trim();
    const tieneColor = TraductorLuces.coloresActivos.some((c) =>
      c.sinonimos.some((s) => palabras.includes(s))
    );
    const tieneAccionOValor =
      /\d/.test(sinGrupo) ||
      palabras.includes('mitad') ||
      palabras.includes('medio') ||
      PALABRAS_APAGAR.some((p) => palabras.includes(p)) ||
      PALABRAS_ENCENDER.some((p) => palabras.includes(p)) ||
      PALABRAS_AJUSTAR.some((p) => palabras.includes(p));

    return tieneColor || tieneAccionOValor;
  }

  private static esOrdenDeCue(textoNormalizado: string, palabras: readonly string[]): boolean {
    const tieneEntidadCue = PALABRAS_CUE_ENTIDAD.some((p) => palabras.includes(p));
    if (!tieneEntidadCue) {
      return /\b(?:goback)\b/.test(textoNormalizado);
    }

    // Evita confundir "escenario" (palabra de grupo general) con "escena"
    const tieneCueExplicita = palabras.some((p) =>
      ['escena', 'escenas', 'cue', 'cues', 'secuencia', 'executor', 'ejecutor'].includes(p)
    );
    return tieneCueExplicita;
  }

  private static interpretarCue(
    textoOriginal: string,
    textoNormalizado: string,
    palabras: readonly string[]
  ): ResultadoInterpretacion {
    let executor = String(TraductorLuces.executorPorDefectoActivo);
    let textoSinExecutor = textoNormalizado;

    const matchExecutor = /\b(?:en\s+(?:el\s+)?)?(?:executor|ejecutor|exec)\s+(-?\d+)\b/.exec(
      textoNormalizado
    );
    if (matchExecutor !== null) {
      const execNum = Number(matchExecutor[1]);
      if (!Number.isInteger(execNum) || execNum < 1 || execNum > 999) {
        return TraductorLuces.crearResultadoError(
          textoOriginal,
          textoNormalizado,
          'Executor inválido',
          'Cue',
          'El número de executor debe ser un entero entre 1 y 999.'
        );
      }
      executor = String(execNum);
      textoSinExecutor = textoNormalizado.replace(matchExecutor[0], ' ').trim();
    }

    // 1. Detección de "ir a escena X" / "cue 2.5" / "goto cue X"
    if (/\d+\.\d+\.\d+|\d+\.\./.test(textoSinExecutor)) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        `Executor ${executor}`,
        'Cue',
        'El número de cue tiene un formato decimal inválido.'
      );
    }

    const matchIrCue = /\b(?:escena|escenas|cue|cues)\s+(-?\d+(?:\.\d+)?)\b/.exec(
      textoSinExecutor
    );
    if (matchIrCue !== null) {
      const cueStr = matchIrCue[1];
      const cueNum = Number(cueStr);
      if (!/^\d+(?:\.\d{1,3})?$/.test(cueStr) || !Number.isFinite(cueNum) || cueNum <= 0) {
        return TraductorLuces.crearResultadoError(
          textoOriginal,
          textoNormalizado,
          `Executor ${executor}`,
          'Ir a Cue',
          'El número de cue debe ser positivo con máximo 3 decimales (ej. "3" o "2.5").'
        );
      }

      const payload: ComandoLuces = {
        accion: 'ir_cue',
        grupo: executor,
        executor,
        valor: cueStr,
        tipo: 'cue',
      };
      const sintaxis = `Goto Cue ${cueStr} Executor ${executor}`;

      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payload,
        comandosPayload: [payload],
        sintaxisMA2: sintaxis,
        sintaxisListaMA2: [sintaxis],
        resumenesComandos: [`Ir al Cue ${cueStr} (Exec ${executor})`],
        etiquetaGrupo: `Executor ${executor}`,
        etiquetaAccion: `Ir a Cue ${cueStr}`,
        etiquetaValor: cueStr,
      };
    }

    const esSiguiente = PALABRAS_CUE_SIGUIENTE.some((p) => palabras.includes(p));
    const esAnterior = PALABRAS_CUE_ANTERIOR.some((p) => palabras.includes(p));
    const esDetener = PALABRAS_CUE_DETENER.some((p) => palabras.includes(p));

    if ((esSiguiente && esAnterior) || ((esSiguiente || esAnterior) && esDetener)) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        `Executor ${executor}`,
        'Contradictoria',
        'Orden de escena contradictoria: especifica solo avanzar, retroceder o detener.'
      );
    }

    if (esSiguiente) {
      const payload: ComandoLuces = {
        accion: 'siguiente',
        grupo: executor,
        executor,
        valor: '',
        tipo: 'cue',
      };
      const sintaxis = `Go Executor ${executor}`;
      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payload,
        comandosPayload: [payload],
        sintaxisMA2: sintaxis,
        sintaxisListaMA2: [sintaxis],
        resumenesComandos: [`Siguiente escena (Exec ${executor})`],
        etiquetaGrupo: `Executor ${executor}`,
        etiquetaAccion: 'Siguiente Escena',
        etiquetaValor: `Exec ${executor}`,
      };
    }

    if (esAnterior) {
      const payload: ComandoLuces = {
        accion: 'anterior',
        grupo: executor,
        executor,
        valor: '',
        tipo: 'cue',
      };
      const sintaxis = `GoBack Executor ${executor}`;
      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payload,
        comandosPayload: [payload],
        sintaxisMA2: sintaxis,
        sintaxisListaMA2: [sintaxis],
        resumenesComandos: [`Escena anterior (Exec ${executor})`],
        etiquetaGrupo: `Executor ${executor}`,
        etiquetaAccion: 'Escena Anterior',
        etiquetaValor: `Exec ${executor}`,
      };
    }

    if (esDetener) {
      const payload: ComandoLuces = {
        accion: 'detener',
        grupo: executor,
        executor,
        valor: '',
        tipo: 'cue',
      };
      const sintaxis = `Off Executor ${executor}`;
      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payload,
        comandosPayload: [payload],
        sintaxisMA2: sintaxis,
        sintaxisListaMA2: [sintaxis],
        resumenesComandos: [`Detener secuencia (Exec ${executor})`],
        etiquetaGrupo: `Executor ${executor}`,
        etiquetaAccion: 'Detener Escena',
        etiquetaValor: `Exec ${executor}`,
      };
    }

    return TraductorLuces.crearResultadoError(
      textoOriginal,
      textoNormalizado,
      `Executor ${executor}`,
      'Cue',
      'Indica la acción de escena: "siguiente escena", "escena anterior", "ir a escena 3" o "detener escena".'
    );
  }

  private static interpretarClausulaSimple(clausulaOriginal: string): ResultadoInterpretacion {
    const textoOriginal = clausulaOriginal.trim();
    const textoNormalizado = TraductorLuces.normalizarTexto(textoOriginal);

    if (textoNormalizado.length === 0) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        '—',
        '—',
        'Escribe una orden de iluminación antes de interpretar.'
      );
    }

    const palabras = textoNormalizado.split(' ');

    // 0. Prioridad: órdenes de Cues / Escenas (RF-07)
    if (TraductorLuces.esOrdenDeCue(textoNormalizado, palabras)) {
      return TraductorLuces.interpretarCue(textoOriginal, textoNormalizado, palabras);
    }

    // 1. Detección de acciones contradictorias: encender y apagar a la vez
    const tieneApagar = PALABRAS_APAGAR.some((p) => palabras.includes(p));
    const tieneEncender = PALABRAS_ENCENDER.some((p) => palabras.includes(p));

    if (tieneApagar && tieneEncender) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        '—',
        'Contradictoria',
        'Orden contradictoria: no se puede encender y apagar a la vez.'
      );
    }

    // 2. Detección de ambigüedad por múltiples colores
    const coloresDetectados = TraductorLuces.coloresActivos.filter((color) =>
      color.sinonimos.some((sinonimo) => palabras.includes(sinonimo))
    );

    if (coloresDetectados.length > 1) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        '—',
        'Ambigua',
        'Orden ambigua: se detectaron múltiples colores en la misma instrucción.'
      );
    }

    const esBlackout = palabras.some((p) => p === 'apagon' || p === 'blackout');

    // 3. Resolución y validación de grupos (ambigüedad y catálogo)
    const grupoResuelto = TraductorLuces.resolverGrupo(textoNormalizado, palabras, esBlackout);

    if (!grupoResuelto.exito || grupoResuelto.id === undefined || grupoResuelto.nombre === undefined) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        grupoResuelto.esAmbiguo ? 'Ambigua' : 'No identificado',
        'Pendiente',
        grupoResuelto.error ??
          'No se identificó el grupo o zona. Prueba indicando: frontales, contraluz, laterales, wash, móviles, público o "grupo 1".'
      );
    }

    const textoSinGrupo = grupoResuelto.textoSinGrupo ?? textoNormalizado;

    // 4. Color único: puede venir solo o combinado con intensidad (ej. "frontales al 70% en azul")
    const colorResuelto = coloresDetectados.length === 1 ? coloresDetectados[0] : null;
    if (colorResuelto !== null && !esBlackout) {
      const tieneIndicacionIntensidad =
        /\d/.test(textoSinGrupo) ||
        palabras.includes('mitad') ||
        palabras.includes('medio') ||
        tieneEncender ||
        tieneApagar;

      if (tieneIndicacionIntensidad) {
        if (tieneApagar) {
          return TraductorLuces.crearResultadoError(
            textoOriginal,
            textoNormalizado,
            `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
            'Contradictoria',
            'Orden contradictoria: no se puede aplicar un color al mismo tiempo que se apaga el grupo.'
          );
        }

        const intensidadAsociada = TraductorLuces.resolverIntensidad(
          textoSinGrupo,
          palabras,
          false
        );

        if (
          !intensidadAsociada.exito ||
          intensidadAsociada.accion === undefined ||
          intensidadAsociada.valor === undefined
        ) {
          return TraductorLuces.crearResultadoError(
            textoOriginal,
            textoNormalizado,
            `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
            'Pendiente',
            intensidadAsociada.error ?? 'No se pudo resolver la intensidad junto al color.'
          );
        }

        if (Number(intensidadAsociada.valor) === 0) {
          return TraductorLuces.crearResultadoError(
            textoOriginal,
            textoNormalizado,
            `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
            'Contradictoria',
            'No se puede aplicar un color con intensidad 0%.'
          );
        }

        const payloadIntensidad: ComandoLuces = {
          accion: intensidadAsociada.accion,
          grupo: grupoResuelto.id,
          valor: intensidadAsociada.valor,
          tipo: 'intensidad',
        };
        const payloadColor: ComandoLuces = {
          accion: 'color',
          grupo: grupoResuelto.id,
          valor: colorResuelto.preset,
          tipo: 'color',
        };

        const sintaxisIntensidad = `Group ${grupoResuelto.id} At ${intensidadAsociada.valor}`;
        const sintaxisColor = `Group ${grupoResuelto.id} At Preset ${colorResuelto.preset}`;

        return {
          exito: true,
          textoOriginal,
          textoNormalizado,
          comandoPayload: payloadIntensidad,
          comandosPayload: [payloadIntensidad, payloadColor],
          sintaxisMA2: `${sintaxisIntensidad}  ·  ${sintaxisColor}`,
          sintaxisListaMA2: [sintaxisIntensidad, sintaxisColor],
          resumenesComandos: [
            `${grupoResuelto.nombre} al ${intensidadAsociada.valor}%`,
            `${grupoResuelto.nombre} · ${colorResuelto.nombre}`,
          ],
          etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
          etiquetaAccion: 'Intensidad + Color',
          etiquetaValor: `${intensidadAsociada.valor}% · ${colorResuelto.nombre} (${colorResuelto.preset})`,
          colorHex: colorResuelto.hex,
        };
      }

      const payloadColor: ComandoLuces = {
        accion: 'color',
        grupo: grupoResuelto.id,
        valor: colorResuelto.preset,
        tipo: 'color',
      };
      const sintaxisColor = `Group ${grupoResuelto.id} At Preset ${colorResuelto.preset}`;

      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payloadColor,
        comandosPayload: [payloadColor],
        sintaxisMA2: sintaxisColor,
        sintaxisListaMA2: [sintaxisColor],
        resumenesComandos: [`${grupoResuelto.nombre} · ${colorResuelto.nombre}`],
        etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
        etiquetaAccion: 'Aplicar Color',
        etiquetaValor: `${colorResuelto.nombre} (Preset ${colorResuelto.preset})`,
        colorHex: colorResuelto.hex,
      };
    }

    // 5. Resolución y validación de intensidad pura
    const intensidadResuelta = TraductorLuces.resolverIntensidad(
      textoSinGrupo,
      palabras,
      esBlackout
    );

    if (
      !intensidadResuelta.exito ||
      intensidadResuelta.accion === undefined ||
      intensidadResuelta.valor === undefined
    ) {
      return TraductorLuces.crearResultadoError(
        textoOriginal,
        textoNormalizado,
        `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
        'Pendiente',
        intensidadResuelta.error ??
          'Indica una acción o intensidad (ej. "encender", "apagar", "al 50%") o un color (ej. "rojo", "azul", "ámbar").'
      );
    }

    const payloadIntensidad: ComandoLuces = {
      accion: intensidadResuelta.accion,
      grupo: grupoResuelto.id,
      valor: intensidadResuelta.valor,
      tipo: 'intensidad',
    };

    const etiquetaAccion =
      intensidadResuelta.accion === 'apagar'
        ? 'Apagar'
        : intensidadResuelta.accion === 'encender'
          ? 'Encender'
          : 'Ajustar Intensidad';

    const sintaxisMA2 = `Group ${grupoResuelto.id} At ${intensidadResuelta.valor}`;

    return {
      exito: true,
      textoOriginal,
      textoNormalizado,
      comandoPayload: payloadIntensidad,
      comandosPayload: [payloadIntensidad],
      sintaxisMA2,
      sintaxisListaMA2: [sintaxisMA2],
      resumenesComandos: [`${grupoResuelto.nombre} al ${intensidadResuelta.valor}%`],
      etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
      etiquetaAccion,
      etiquetaValor: `${intensidadResuelta.valor}%`,
    };
  }

  private static crearResultadoError(
    textoOriginal: string,
    textoNormalizado: string,
    etiquetaGrupo: string,
    etiquetaAccion: string,
    mensajeError: string
  ): ResultadoInterpretacion {
    return {
      exito: false,
      textoOriginal,
      textoNormalizado,
      comandoPayload: null,
      comandosPayload: [],
      sintaxisMA2: null,
      sintaxisListaMA2: [],
      resumenesComandos: [],
      etiquetaGrupo,
      etiquetaAccion,
      etiquetaValor: '—',
      mensajeError,
    };
  }

  private static resolverGrupo(
    textoNormalizado: string,
    palabras: readonly string[],
    esBlackout: boolean
  ): ResolucionGrupoInterna {
    const gruposCatalogoCoincidentes = TraductorLuces.gruposActivos.filter((grupo) =>
      grupo.sinonimos.some((sinonimo) => palabras.includes(sinonimo))
    );

    const coincidenciaRango = /\bgrupos?\s+(\d+)\s*(?:al|a|hasta|thru|-)\s*(\d+)(?!\s*%)\b/.exec(
      textoNormalizado
    );

    const regexGrupoIndividual = /\bgrupos?\s+(\d+)\b/g;
    const gruposNumericos: string[] = [];
    let matchGrupo: RegExpExecArray | null;
    while ((matchGrupo = regexGrupoIndividual.exec(textoNormalizado)) !== null) {
      gruposNumericos.push(matchGrupo[1]);
    }

    const tieneGruposEnumerados = /\bgrupos?\s+(\d+)\s*(?:y|,|e)\s*(\d+)\b/.test(textoNormalizado);
    const tienePalabraGeneral = PALABRAS_GENERAL.some((palabra) => palabras.includes(palabra));

    if (gruposCatalogoCoincidentes.length > 1 || tieneGruposEnumerados) {
      return {
        exito: false,
        esAmbiguo: true,
        error: 'Orden ambigua: se detectaron múltiples grupos o zonas en la misma instrucción.',
      };
    }

    if (coincidenciaRango !== null && gruposCatalogoCoincidentes.length > 0) {
      return {
        exito: false,
        esAmbiguo: true,
        error: 'Orden ambigua: se detectaron múltiples grupos o zonas en la misma instrucción.',
      };
    }

    if (coincidenciaRango === null && gruposNumericos.length > 1) {
      return {
        exito: false,
        esAmbiguo: true,
        error: 'Orden ambigua: se detectaron múltiples grupos o zonas en la misma instrucción.',
      };
    }

    if (
      coincidenciaRango === null &&
      gruposNumericos.length === 1 &&
      gruposCatalogoCoincidentes.length > 0 &&
      gruposCatalogoCoincidentes[0].id !== gruposNumericos[0]
    ) {
      return {
        exito: false,
        esAmbiguo: true,
        error: 'Orden ambigua: se detectaron múltiples grupos o zonas en la misma instrucción.',
      };
    }

    if (tienePalabraGeneral && (gruposCatalogoCoincidentes.length > 0 || gruposNumericos.length > 0)) {
      return {
        exito: false,
        esAmbiguo: true,
        error: 'Orden ambigua: se detectaron múltiples grupos o zonas en la misma instrucción.',
      };
    }

    if (coincidenciaRango !== null) {
      const inicio = Number(coincidenciaRango[1]);
      const fin = Number(coincidenciaRango[2]);
      if (!Number.isInteger(inicio) || !Number.isInteger(fin) || inicio < 1 || fin < inicio) {
        return {
          exito: false,
          error: 'El rango de grupos no es válido: el grupo inicial debe ser menor o igual al final.',
        };
      }
      if (fin > TraductorLuces.gruposActivos.length) {
        return {
          exito: false,
          error: `El rango de grupos excede el catálogo configurado (grupos 1 al ${TraductorLuces.gruposActivos.length}).`,
        };
      }
      const idRango = `${inicio} thru ${fin}`;
      return {
        exito: true,
        id: idRango,
        nombre: `Grupos ${inicio}–${fin}`,
        textoSinGrupo: textoNormalizado.replace(coincidenciaRango[0], ' ').trim(),
      };
    }

    if (coincidenciaRango === null && gruposNumericos.length === 1) {
      const idGrupo = gruposNumericos[0];
      const grupoConocido = TraductorLuces.gruposActivos.find((g) => g.id === idGrupo);
      if (grupoConocido === undefined) {
        return {
          exito: false,
          error: `El grupo ${idGrupo} no existe en el catálogo configurado (grupos válidos: 1 al ${TraductorLuces.gruposActivos.length}).`,
        };
      }
      const matchTexto = `grupo ${idGrupo}`;
      const matchPlural = `grupos ${idGrupo}`;
      let textoLimpio = textoNormalizado.replace(matchTexto, ' ');
      textoLimpio = textoLimpio.replace(matchPlural, ' ').trim();
      return {
        exito: true,
        id: idGrupo,
        nombre: grupoConocido.nombre,
        textoSinGrupo: textoLimpio,
      };
    }

    if (gruposCatalogoCoincidentes.length === 1) {
      const grupo = gruposCatalogoCoincidentes[0];
      let textoLimpio = textoNormalizado;
      for (const s of grupo.sinonimos) {
        if (palabras.includes(s)) {
          textoLimpio = textoLimpio.replace(new RegExp(`\\b${s}\\b`, 'g'), ' ');
        }
      }
      return {
        exito: true,
        id: grupo.id,
        nombre: grupo.nombre,
        textoSinGrupo: textoLimpio.trim(),
      };
    }

    if (esBlackout || tienePalabraGeneral) {
      return {
        exito: true,
        id: `1 thru ${TraductorLuces.gruposActivos.length}`,
        nombre: 'General (Todos)',
        textoSinGrupo: textoNormalizado,
      };
    }

    return {
      exito: false,
      error:
        'No se identificó el grupo o zona. Prueba indicando: frontales, contraluz, laterales, wash, móviles, público o "grupo 1".',
    };
  }

  private static resolverIntensidad(
    textoSinGrupo: string,
    palabras: readonly string[],
    esBlackout: boolean
  ): ResolucionIntensidadInterna {
    const tieneApagar = esBlackout || PALABRAS_APAGAR.some((palabra) => palabras.includes(palabra));
    const tieneEncender = PALABRAS_ENCENDER.some((palabra) => palabras.includes(palabra));
    const tieneAjustar = PALABRAS_AJUSTAR.some((palabra) => palabras.includes(palabra));

    if (/\d+\.\d+\.\d+/.test(textoSinGrupo) || /\d+\.\./.test(textoSinGrupo) || /\.\.\d+/.test(textoSinGrupo)) {
      return {
        exito: false,
        error: 'El valor de intensidad contiene un formato numérico malformado.',
      };
    }

    const matchPorcentaje = /(-?\d+(?:\.\d+)?)\s*%/.exec(textoSinGrupo);
    const matchNumero = /(?:^|\s)(-?\d+(?:\.\d+)?)(?:\s|$)/.exec(textoSinGrupo);
    const numeroCandidatoStr = matchPorcentaje ? matchPorcentaje[1] : matchNumero ? matchNumero[1] : null;

    if (numeroCandidatoStr !== null) {
      const numero = Number(numeroCandidatoStr);
      if (!Number.isFinite(numero) || Number.isNaN(numero)) {
        return {
          exito: false,
          error: 'El valor de intensidad contiene un formato numérico malformado.',
        };
      }

      if (numero < 0 || numero > 100) {
        return {
          exito: false,
          error: 'El valor de intensidad debe estar entre 0 y 100%.',
        };
      }

      if (tieneApagar && numero > 0) {
        return {
          exito: false,
          error: 'Orden contradictoria: no se puede apagar con un valor de intensidad mayor a 0%.',
        };
      }

      const valorRedondeado = Number.isInteger(numero)
        ? String(numero)
        : String(Math.round(numero * 100) / 100);

      if (numero === 0) {
        return { exito: true, accion: 'apagar', valor: '0' };
      }
      if (tieneEncender) {
        return { exito: true, accion: 'encender', valor: valorRedondeado };
      }
      return { exito: true, accion: 'ajustar', valor: valorRedondeado };
    }

    if (tieneApagar) {
      return { exito: true, accion: 'apagar', valor: '0' };
    }

    if (palabras.includes('mitad') || palabras.includes('medio')) {
      return { exito: true, accion: 'ajustar', valor: '50' };
    }

    if (tieneEncender) {
      return { exito: true, accion: 'encender', valor: '100' };
    }

    if (tieneAjustar) {
      return {
        exito: false,
        error:
          'Especifica el nivel o porcentaje de intensidad para ajustar (ej. "subir frontales al 70%").',
      };
    }

    return {
      exito: false,
      error:
        'Indica una acción o intensidad (ej. "encender", "apagar", "al 50%") o un color (ej. "rojo", "azul", "ámbar").',
    };
  }
}
