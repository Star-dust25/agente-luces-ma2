import type { ComandoLuces, TipoAccionLuz } from '../tipos/ipc';

/**
 * Definición de un grupo o zona de iluminación en la consola GrandMA2.
 */
export interface DefinicionGrupoMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly sinonimos: readonly string[];
}

/**
 * Definición de un preset cromático del Pool 4 (Color) en GrandMA2.
 */
export interface DefinicionColorMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly preset: string;
  readonly hex: string;
  readonly sinonimos: readonly string[];
}

/**
 * Resultado estructurado de interpretar una orden en lenguaje natural.
 */
export interface ResultadoInterpretacion {
  readonly exito: boolean;
  readonly textoOriginal: string;
  readonly textoNormalizado: string;
  readonly comandoPayload: ComandoLuces | null;
  readonly sintaxisMA2: string | null;
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
const PALABRAS_APAGAR = ['apagar', 'apaga', 'apagado', 'apagon', 'blackout', 'cerrar', 'off'] as const;
const PALABRAS_ENCENDER = ['encender', 'enciende', 'prender', 'prende', 'activar', 'activa', 'on', 'full', 'maximo'] as const;
const PALABRAS_AJUSTAR = ['ajustar', 'ajusta', 'subir', 'sube', 'bajar', 'baja', 'poner', 'pon', 'dejar', 'cambiar', 'atenuar', 'dimmer'] as const;

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
 * Traductor de lenguaje natural en español a payloads tipados para GrandMA2 (RF-03 y RF-05).
 */
export class TraductorLuces {
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
   * Interpreta una instrucción en lenguaje natural y devuelve el comando estructurado
   * junto con su vista previa en sintaxis GrandMA2.
   */
  public static interpretarOrden(instruccionUsuario: string): ResultadoInterpretacion {
    const textoOriginal = instruccionUsuario.trim();
    const textoNormalizado = TraductorLuces.normalizarTexto(textoOriginal);

    if (textoNormalizado.length === 0) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: '—',
        etiquetaAccion: '—',
        etiquetaValor: '—',
        mensajeError: 'Escribe una orden de iluminación antes de interpretar.',
      };
    }

    const palabras = textoNormalizado.split(' ');

    // 1. Detección de acciones contradictorias: encender y apagar a la vez
    const tieneApagar = PALABRAS_APAGAR.some((p) => palabras.includes(p));
    const tieneEncender = PALABRAS_ENCENDER.some((p) => palabras.includes(p));

    if (tieneApagar && tieneEncender) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: '—',
        etiquetaAccion: 'Contradictoria',
        etiquetaValor: '—',
        mensajeError: 'Orden contradictoria: no se puede encender y apagar a la vez.',
      };
    }

    // 2. Detección de ambigüedad por múltiples colores
    const coloresDetectados = CATALOGO_COLORES.filter((color) =>
      color.sinonimos.some((sinonimo) => palabras.includes(sinonimo))
    );

    if (coloresDetectados.length > 1) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: '—',
        etiquetaAccion: 'Ambigua',
        etiquetaValor: '—',
        mensajeError: 'Orden ambigua: se detectaron múltiples colores en la misma instrucción.',
      };
    }

    const esBlackout = palabras.some((p) => p === 'apagon' || p === 'blackout');

    // 3. Resolución y validación de grupos (ambigüedad y catálogo)
    const grupoResuelto = TraductorLuces.resolverGrupo(textoNormalizado, palabras, esBlackout);

    if (!grupoResuelto.exito || grupoResuelto.id === undefined || grupoResuelto.nombre === undefined) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: grupoResuelto.esAmbiguo ? 'Ambigua' : 'No identificado',
        etiquetaAccion: 'Pendiente',
        etiquetaValor: '—',
        mensajeError:
          grupoResuelto.error ??
          'No se identificó el grupo o zona. Prueba indicando: frontales, contraluz, laterales, wash, móviles, público o "grupo 1".',
      };
    }

    // 4. Si se detectó un color único y no es blackout, se aplica la acción de color
    const colorResuelto = coloresDetectados.length === 1 ? coloresDetectados[0] : null;
    if (colorResuelto !== null && !esBlackout) {
      const payloadColor: ComandoLuces = {
        accion: 'color',
        grupo: grupoResuelto.id,
        valor: colorResuelto.preset,
        tipo: 'color',
      };

      return {
        exito: true,
        textoOriginal,
        textoNormalizado,
        comandoPayload: payloadColor,
        sintaxisMA2: `Group ${grupoResuelto.id} At Preset ${colorResuelto.preset}`,
        etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
        etiquetaAccion: 'Aplicar Color',
        etiquetaValor: `${colorResuelto.nombre} (Preset ${colorResuelto.preset})`,
        colorHex: colorResuelto.hex,
      };
    }

    // 5. Resolución y validación de intensidad
    const intensidadResuelta = TraductorLuces.resolverIntensidad(
      grupoResuelto.textoSinGrupo ?? textoNormalizado,
      palabras,
      esBlackout
    );

    if (!intensidadResuelta.exito || intensidadResuelta.accion === undefined || intensidadResuelta.valor === undefined) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
        etiquetaAccion: 'Pendiente',
        etiquetaValor: '—',
        mensajeError:
          intensidadResuelta.error ??
          'Indica una acción o intensidad (ej. "encender", "apagar", "al 50%") o un color (ej. "rojo", "azul", "ámbar").',
      };
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

    return {
      exito: true,
      textoOriginal,
      textoNormalizado,
      comandoPayload: payloadIntensidad,
      sintaxisMA2: `Group ${grupoResuelto.id} At ${intensidadResuelta.valor}`,
      etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
      etiquetaAccion,
      etiquetaValor: `${intensidadResuelta.valor}%`,
    };
  }

  private static resolverGrupo(
    textoNormalizado: string,
    palabras: readonly string[],
    esBlackout: boolean
  ): ResolucionGrupoInterna {
    // A. Detectar grupos del catálogo mencionados por sinónimo
    const gruposCatalogoCoincidentes = CATALOGO_GRUPOS.filter((grupo) =>
      grupo.sinonimos.some((sinonimo) => palabras.includes(sinonimo))
    );

    // B. Detectar rangos numéricos: "grupos 1 al 3", "grupos 1 a 6", etc. (sin consumir porcentaje)
    const coincidenciaRango = /\bgrupos?\s+(\d+)\s*(?:al|a|hasta|thru|-)\s*(\d+)(?!\s*%)\b/.exec(
      textoNormalizado
    );

    // C. Detectar grupos numéricos individuales o enumerados: "grupo 1", "grupos 1 y 2"
    const regexGrupoIndividual = /\bgrupos?\s+(\d+)\b/g;
    const gruposNumericos: string[] = [];
    let matchGrupo: RegExpExecArray | null;
    while ((matchGrupo = regexGrupoIndividual.exec(textoNormalizado)) !== null) {
      gruposNumericos.push(matchGrupo[1]);
    }

    const tieneGruposEnumerados = /\bgrupos?\s+(\d+)\s*(?:y|,|e)\s*(\d+)\b/.test(textoNormalizado);

    // D. Detectar palabras generales ("todos", "general", etc.)
    const tienePalabraGeneral = PALABRAS_GENERAL.some((palabra) => palabras.includes(palabra));

    // Detección de ambigüedad por múltiples grupos
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

    // Resolución de Rango
    if (coincidenciaRango !== null) {
      const inicio = Number(coincidenciaRango[1]);
      const fin = Number(coincidenciaRango[2]);
      if (!Number.isInteger(inicio) || !Number.isInteger(fin) || inicio < 1 || fin < inicio) {
        return {
          exito: false,
          error: 'El rango de grupos no es válido: el grupo inicial debe ser menor o igual al final.',
        };
      }
      if (fin > CATALOGO_GRUPOS.length) {
        return {
          exito: false,
          error: `El rango de grupos excede el catálogo configurado (grupos 1 al ${CATALOGO_GRUPOS.length}).`,
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

    // Resolución de Grupo Numérico Individual
    if (coincidenciaRango === null && gruposNumericos.length === 1) {
      const idGrupo = gruposNumericos[0];
      const grupoConocido = CATALOGO_GRUPOS.find((g) => g.id === idGrupo);
      if (grupoConocido === undefined) {
        return {
          exito: false,
          error: `El grupo ${idGrupo} no existe en el catálogo configurado (grupos válidos: 1 al ${CATALOGO_GRUPOS.length}).`,
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

    // Resolución de Grupo por Sinónimo
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

    // Resolución de Modo General / Blackout
    if (esBlackout || tienePalabraGeneral) {
      return {
        exito: true,
        id: '1 thru 6',
        nombre: 'General (Todos)',
        textoSinGrupo: textoNormalizado,
      };
    }

    return {
      exito: false,
      error: 'No se identificó el grupo o zona. Prueba indicando: frontales, contraluz, laterales, wash, móviles, público o "grupo 1".',
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

    // A. Detección de números malformados (múltiples puntos decimales, etc.)
    if (/\d+\.\d+\.\d+/.test(textoSinGrupo) || /\d+\.\./.test(textoSinGrupo) || /\.\.\d+/.test(textoSinGrupo)) {
      return {
        exito: false,
        error: 'El valor de intensidad contiene un formato numérico malformado.',
      };
    }

    // B. Búsqueda de valores numéricos de intensidad o porcentaje
    const matchPorcentaje = /(-?\d+(?:\.\d+)?)\s*%/.exec(textoSinGrupo);
    const matchNumero = /(?:^|\s)(-?\d+(?:\.\d+)?)(?:\s|$)/.exec(textoSinGrupo);
    const numeroCandidatoStr = matchPorcentaje ? matchPorcentaje[1] : matchNumero ? matchNumero[1] : null;

    if (numeroCandidatoStr !== null) {
      const numero = Number(numeroCandidatoStr);
      if (!Number.isFinite(numero) || isNaN(numero)) {
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

      // Si se intentó apagar indicando un valor numérico superior a 0
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

    // C. Si tiene intención explícita de apagar
    if (tieneApagar) {
      return { exito: true, accion: 'apagar', valor: '0' };
    }

    // D. Valores semánticos reconocidos ("mitad" / "medio")
    if (palabras.includes('mitad') || palabras.includes('medio')) {
      return { exito: true, accion: 'ajustar', valor: '50' };
    }

    // E. Encender sin número explícito implica 100%
    if (tieneEncender) {
      return { exito: true, accion: 'encender', valor: '100' };
    }

    // F. Órdenes relativas de ajuste (subir, bajar, etc.) SIN intensidad: NO asumir 50%
    if (tieneAjustar) {
      return {
        exito: false,
        error: 'Especifica el nivel o porcentaje de intensidad para ajustar (ej. "subir frontales al 70%").',
      };
    }

    return {
      exito: false,
      error: 'Indica una acción o intensidad (ej. "encender", "apagar", "al 50%") o un color (ej. "rojo", "azul", "ámbar").',
    };
  }
}
