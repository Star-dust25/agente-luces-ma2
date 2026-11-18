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
    const esBlackout = palabras.some((p) => p === 'apagon' || p === 'blackout');
    const grupoResuelto = TraductorLuces.resolverGrupo(textoNormalizado, palabras, esBlackout);

    if (grupoResuelto === null) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: 'No identificado',
        etiquetaAccion: 'Pendiente',
        etiquetaValor: '—',
        mensajeError:
          'No se identificó el grupo o zona. Prueba indicando: frontales, contraluz, laterales, wash, móviles, público o "grupo 1".',
      };
    }

    const colorResuelto = TraductorLuces.resolverColor(palabras);
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

    const intensidadResuelta = TraductorLuces.resolverIntensidad(
      grupoResuelto.textoSinGrupo,
      palabras,
      esBlackout
    );

    if (intensidadResuelta === null) {
      return {
        exito: false,
        textoOriginal,
        textoNormalizado,
        comandoPayload: null,
        sintaxisMA2: null,
        etiquetaGrupo: `${grupoResuelto.nombre} (Grp ${grupoResuelto.id})`,
        etiquetaAccion: 'Ambigua',
        etiquetaValor: '—',
        mensajeError:
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
  ): { id: string; nombre: string; textoSinGrupo: string } | null {
    const coincidenciaRango = /\bgrupos?\s+(\d+)\s*(?:al|a|hasta|thru|-)\s*(\d+)\b/.exec(
      textoNormalizado
    );
    if (coincidenciaRango !== null) {
      const inicio = Number(coincidenciaRango[1]);
      const fin = Number(coincidenciaRango[2]);
      if (Number.isInteger(inicio) && Number.isInteger(fin) && inicio > 0 && fin >= inicio) {
        const idRango = `${inicio} thru ${fin}`;
        return {
          id: idRango,
          nombre: `Grupos ${inicio}–${fin}`,
          textoSinGrupo: textoNormalizado.replace(coincidenciaRango[0], ' ').trim(),
        };
      }
    }

    const coincidenciaGrupoUnico = /\bgrupos?\s+(\d+)\b/.exec(textoNormalizado);
    if (coincidenciaGrupoUnico !== null) {
      const idGrupo = coincidenciaGrupoUnico[1];
      const grupoConocido = CATALOGO_GRUPOS.find((g) => g.id === idGrupo);
      return {
        id: idGrupo,
        nombre: grupoConocido !== undefined ? grupoConocido.nombre : `Grupo ${idGrupo}`,
        textoSinGrupo: textoNormalizado.replace(coincidenciaGrupoUnico[0], ' ').trim(),
      };
    }

    for (const grupo of CATALOGO_GRUPOS) {
      const coincide = grupo.sinonimos.some((sinonimo) => palabras.includes(sinonimo));
      if (coincide) {
        return {
          id: grupo.id,
          nombre: grupo.nombre,
          textoSinGrupo: textoNormalizado,
        };
      }
    }

    if (esBlackout || PALABRAS_GENERAL.some((palabra) => palabras.includes(palabra))) {
      return {
        id: '1 thru 6',
        nombre: 'General (Todos)',
        textoSinGrupo: textoNormalizado,
      };
    }

    return null;
  }

  private static resolverColor(palabras: readonly string[]): DefinicionColorMA2 | null {
    for (const color of CATALOGO_COLORES) {
      if (color.sinonimos.some((sinonimo) => palabras.includes(sinonimo))) {
        return color;
      }
    }
    return null;
  }

  private static resolverIntensidad(
    textoSinGrupo: string,
    palabras: readonly string[],
    esBlackout: boolean
  ): { accion: TipoAccionLuz; valor: string } | null {
    if (esBlackout || PALABRAS_APAGAR.some((palabra) => palabras.includes(palabra))) {
      return { accion: 'apagar', valor: '0' };
    }

    const coincidenciaPorcentaje = /\b(\d+(?:\.\d+)?)\s*%?/.exec(textoSinGrupo);
    const tieneEncender = PALABRAS_ENCENDER.some((palabra) => palabras.includes(palabra));
    const tieneAjustar = PALABRAS_AJUSTAR.some((palabra) => palabras.includes(palabra));

    if (coincidenciaPorcentaje !== null) {
      const numero = Number(coincidenciaPorcentaje[1]);
      if (Number.isFinite(numero) && numero >= 0 && numero <= 100) {
        const valorRedondeado = Number.isInteger(numero)
          ? String(numero)
          : String(Math.round(numero * 100) / 100);

        if (numero === 0) {
          return { accion: 'apagar', valor: '0' };
        }
        if (tieneEncender) {
          return { accion: 'encender', valor: valorRedondeado };
        }
        return { accion: 'ajustar', valor: valorRedondeado };
      }
    }

    if (palabras.includes('mitad') || palabras.includes('medio')) {
      return { accion: 'ajustar', valor: '50' };
    }

    if (tieneEncender) {
      return { accion: 'encender', valor: '100' };
    }

    if (tieneAjustar) {
      return { accion: 'ajustar', valor: '50' };
    }

    return null;
  }
}
