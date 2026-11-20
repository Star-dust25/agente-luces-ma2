import { TraductorLuces } from './diccionario/TraductorLuces';
import type { ComandoLuces, TipoAccionLuz, TipoParametroLuz } from './tipos/ipc';

export const MAX_GRUPOS_EN_RANGO = 6;

export const ACCIONES_PERMITIDAS: ReadonlySet<TipoAccionLuz> = new Set<TipoAccionLuz>([
  'encender',
  'apagar',
  'ajustar',
  'color',
]);

export const TIPOS_PARAMETRO_PERMITIDOS: ReadonlySet<TipoParametroLuz> = new Set<TipoParametroLuz>([
  'intensidad',
  'color',
]);

const CARACTERES_CONTROL_O_INYECCION = /[\r\n;\x00-\x1f]/;
const REGEX_RANGO_TEXTO = /\bgrupos?\s+(\d+)\s*(?:al|a|hasta|thru|-)\s*(\d+)(?!\s*%)\b/i;
const REGEX_RANGO_GRUPO = /^(\d+)\s+thru\s+(\d+)$/i;
const REGEX_GRUPO_INDIVIDUAL = /^0*([1-9]\d*)$/;
const REGEX_VALOR_NUMERICO = /^\d+(?:\.\d+)?$/;
const REGEX_PRESET_COLOR = /^(?:4\.)?[1-9]\d?$/;

/**
 * Valida que un rango numérico de grupos sea consistente y esté dentro del catálogo configurado.
 */
export function validarRangoGrupos(inicioNum: number, finNum: number): string | null {
  if (
    !Number.isSafeInteger(inicioNum) ||
    !Number.isSafeInteger(finNum) ||
    inicioNum < 1 ||
    finNum < inicioNum
  ) {
    return 'El rango de grupos no es válido.';
  }
  if (finNum - inicioNum + 1 > MAX_GRUPOS_EN_RANGO) {
    return `Los rangos de más de ${MAX_GRUPOS_EN_RANGO} grupos están bloqueados por seguridad.`;
  }
  if (inicioNum > MAX_GRUPOS_EN_RANGO || finNum > MAX_GRUPOS_EN_RANGO) {
    return `El rango de grupos excede el catálogo configurado (grupos 1 al ${MAX_GRUPOS_EN_RANGO}).`;
  }
  return null;
}

/**
 * Valida que el valor de intensidad sea numérico y se encuentre en el rango [0, 100].
 */
export function validarValorIntensidad(valor: string | number): string | null {
  const valorStr = String(valor).trim();
  if (!REGEX_VALOR_NUMERICO.test(valorStr)) {
    return 'El valor de intensidad debe ser un número válido entre 0 y 100%.';
  }
  const numero = Number(valorStr);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    return 'El valor de intensidad debe estar entre 0 y 100%.';
  }
  return null;
}

/**
 * Valida que el identificador de preset de color cumpla con la convención de GrandMA2 (Pool 4).
 */
export function validarPresetColor(preset: string): string | null {
  const presetLimpio = preset.trim();
  if (!REGEX_PRESET_COLOR.test(presetLimpio)) {
    return 'El preset de color no es válido para la simulación.';
  }
  return null;
}

/**
 * Evalúa las restricciones de seguridad tanto para la vista previa en vivo como para
 * todas las vías de envío hacia la consola GrandMA2.
 *
 * Retorna null si el comando es seguro, o un mensaje explicativo si debe ser bloqueado.
 */
export function bloqueoDeSeguridad(
  comando: ComandoLuces,
  ordenOriginal: string | null = null
): string | null {
  if (!comando || typeof comando !== 'object') {
    return 'El comando de luces no es válido.';
  }

  // Prevenir inyección de saltos de línea o concatenación de comandos
  if (
    (ordenOriginal !== null && CARACTERES_CONTROL_O_INYECCION.test(ordenOriginal)) ||
    CARACTERES_CONTROL_O_INYECCION.test(comando.grupo ?? '') ||
    CARACTERES_CONTROL_O_INYECCION.test(comando.valor ?? '')
  ) {
    return 'Caracteres no permitidos detectados por seguridad.';
  }

  // Validar acciones y tipos soportados
  if (!TIPOS_PARAMETRO_PERMITIDOS.has(comando.tipo)) {
    return 'El tipo de parámetro no es válido.';
  }
  if (!ACCIONES_PERMITIDAS.has(comando.accion)) {
    return 'La acción solicitada no es válida.';
  }
  if (comando.tipo === 'color' && comando.accion !== 'color') {
    return 'La acción no es compatible con el tipo de parámetro color.';
  }
  if (comando.tipo === 'intensidad' && comando.accion === 'color') {
    return 'La acción color no es compatible con el parámetro de intensidad.';
  }

  // Normalización del texto para validar rangos solicitados en la orden
  const orden = TraductorLuces.normalizarTexto(ordenOriginal ?? '');

  // Validación de rangos en el texto de la orden
  const rangoSolicitado = REGEX_RANGO_TEXTO.exec(orden);
  if (rangoSolicitado !== null) {
    const errorRangoTexto = validarRangoGrupos(
      Number(rangoSolicitado[1]),
      Number(rangoSolicitado[2])
    );
    if (errorRangoTexto !== null) return errorRangoTexto;
  }

  // Validación del grupo o rango de grupos en el comando (incluyendo Blackout 1 thru 6)
  const grupo = (comando.grupo ?? '').trim().toLowerCase();
  const coincidenciaRango = REGEX_RANGO_GRUPO.exec(grupo);
  if (coincidenciaRango !== null) {
    const inicio = Number(coincidenciaRango[1]);
    const fin = Number(coincidenciaRango[2]);
    const errorRango = validarRangoGrupos(inicio, fin);
    if (errorRango !== null) return errorRango;
  } else {
    const coincidenciaIndividual = REGEX_GRUPO_INDIVIDUAL.exec(grupo);
    if (coincidenciaIndividual === null) {
      return 'El grupo indicado no es válido para la consola.';
    }
    const numeroGrupo = Number(coincidenciaIndividual[1]);
    if (!Number.isSafeInteger(numeroGrupo) || numeroGrupo < 1) {
      return 'El grupo indicado no es válido para la consola.';
    }
    if (numeroGrupo > MAX_GRUPOS_EN_RANGO) {
      return `El grupo indicado no pertenece al catálogo configurado (grupos 1 al ${MAX_GRUPOS_EN_RANGO}).`;
    }
  }

  // Validación de valores según el tipo de parámetro
  if (comando.tipo === 'intensidad') {
    const errorIntensidad = validarValorIntensidad(comando.valor);
    if (errorIntensidad !== null) return errorIntensidad;
  } else if (comando.tipo === 'color') {
    const errorColor = validarPresetColor(comando.valor);
    if (errorColor !== null) return errorColor;
  }

  return null;
}

/**
 * Función utilitaria para verificar si un comando cumple con todas las políticas de seguridad.
 */
export function esComandoSeguro(
  comando: ComandoLuces,
  ordenOriginal: string | null = null
): boolean {
  return bloqueoDeSeguridad(comando, ordenOriginal) === null;
}
