import { TraductorLuces } from './diccionario/TraductorLuces';
import type { ComandoLuces, TipoAccionLuz, TipoParametroLuz } from './tipos/ipc';

export const MAX_GRUPOS_EN_RANGO = 6;

export const ACCIONES_PERMITIDAS: ReadonlySet<TipoAccionLuz> = new Set<TipoAccionLuz>([
  'encender',
  'apagar',
  'ajustar',
  'color',
  'siguiente',
  'anterior',
  'ir_cue',
  'detener',
]);

export const ACCIONES_CUE: ReadonlySet<TipoAccionLuz> = new Set<TipoAccionLuz>([
  'siguiente',
  'anterior',
  'ir_cue',
  'detener',
]);

export const TIPOS_PARAMETRO_PERMITIDOS: ReadonlySet<TipoParametroLuz> = new Set<TipoParametroLuz>([
  'intensidad',
  'color',
  'cue',
]);

const CARACTERES_CONTROL_O_INYECCION = /[\r\n;\x00-\x1f]/;
const REGEX_RANGO_TEXTO = /\bgrupos?\s+(\d+)\s*(?:al|a|hasta|thru|-)\s*(\d+)(?!\s*%)\b/i;
const REGEX_RANGO_GRUPO = /^(\d+)\s+thru\s+(\d+)$/i;
const REGEX_GRUPO_INDIVIDUAL = /^0*([1-9]\d*)$/;
const REGEX_VALOR_NUMERICO = /^\d+(?:\.\d+)?$/;
const REGEX_PRESET_COLOR = /^(?:4\.)?[1-9]\d?$/;
const REGEX_EXECUTOR_VALIDO = /^[1-9]\d{0,2}$/;
const REGEX_NUMERO_CUE_VALIDO = /^\d+(?:\.\d{1,3})?$/;

/**
 * Valida que un rango numérico de grupos sea consistente y esté dentro del catálogo configurado.
 */
export function validarRangoGrupos(
  inicioNum: number,
  finNum: number,
  maxGrupos: number = MAX_GRUPOS_EN_RANGO
): string | null {
  if (
    !Number.isSafeInteger(inicioNum) ||
    !Number.isSafeInteger(finNum) ||
    inicioNum < 1 ||
    finNum < inicioNum
  ) {
    return 'El rango de grupos no es válido.';
  }
  if (finNum - inicioNum + 1 > maxGrupos) {
    return `Los rangos de más de ${maxGrupos} grupos están bloqueados por seguridad.`;
  }
  if (inicioNum > maxGrupos || finNum > maxGrupos) {
    return `El rango de grupos excede el catálogo configurado (grupos 1 al ${maxGrupos}).`;
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
 * Valida que el número de executor sea un entero positivo entre 1 y 999 (RF-07).
 */
export function validarExecutor(executor: string): string | null {
  const limpio = executor.trim();
  if (!REGEX_EXECUTOR_VALIDO.test(limpio)) {
    return 'El executor debe ser un número entero entre 1 y 999.';
  }
  return null;
}

/**
 * Valida que el número de Cue cumpla con el formato positivo de GrandMA2 (ej. "3" o "2.5").
 */
export function validarNumeroCue(numeroCue: string): string | null {
  const limpio = numeroCue.trim();
  if (!REGEX_NUMERO_CUE_VALIDO.test(limpio)) {
    return 'El número de Cue no es válido (usa un entero o hasta 3 decimales, ej. "3" o "2.5").';
  }
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero <= 0) {
    return 'El número de Cue debe ser mayor a 0.';
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
    CARACTERES_CONTROL_O_INYECCION.test(comando.valor ?? '') ||
    CARACTERES_CONTROL_O_INYECCION.test(comando.executor ?? '')
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

  // Reglas estrictas para Cues / Escenas (RF-07)
  if (comando.tipo === 'cue') {
    if (!ACCIONES_CUE.has(comando.accion)) {
      return 'La acción no es compatible con el tipo cue.';
    }
    const executorSolicitado = comando.executor ?? comando.grupo;
    const errorExec = validarExecutor(executorSolicitado);
    if (errorExec !== null) {
      return errorExec;
    }
    if (comando.accion === 'ir_cue') {
      const errorCue = validarNumeroCue(comando.valor ?? '');
      if (errorCue !== null) {
        return errorCue;
      }
    }
    return null;
  }

  if (ACCIONES_CUE.has(comando.accion)) {
    return 'Las acciones de escena solo son compatibles con el parámetro cue.';
  }

  if (comando.tipo === 'color' && comando.accion !== 'color') {
    return 'La acción no es compatible con el tipo de parámetro color.';
  }
  if (comando.tipo === 'intensidad' && comando.accion === 'color') {
    return 'La acción color no es compatible con el parámetro de intensidad.';
  }

  const maxGruposCatalogo = Math.max(
    MAX_GRUPOS_EN_RANGO,
    TraductorLuces.obtenerGruposActivos().length
  );

  // Normalización del texto para validar rangos solicitados en la orden
  const orden = TraductorLuces.normalizarTexto(ordenOriginal ?? '');

  // Validación de rangos en el texto de la orden
  const rangoSolicitado = REGEX_RANGO_TEXTO.exec(orden);
  if (rangoSolicitado !== null) {
    const errorRangoTexto = validarRangoGrupos(
      Number(rangoSolicitado[1]),
      Number(rangoSolicitado[2]),
      maxGruposCatalogo
    );
    if (errorRangoTexto !== null) return errorRangoTexto;
  }

  // Validación del grupo o rango de grupos en el comando (incluyendo Blackout 1 thru 6)
  const grupo = (comando.grupo ?? '').trim().toLowerCase();
  const coincidenciaRango = REGEX_RANGO_GRUPO.exec(grupo);
  if (coincidenciaRango !== null) {
    const inicio = Number(coincidenciaRango[1]);
    const fin = Number(coincidenciaRango[2]);
    const errorRango = validarRangoGrupos(inicio, fin, maxGruposCatalogo);
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
    if (numeroGrupo > maxGruposCatalogo) {
      return `El grupo indicado no pertenece al catálogo configurado (grupos 1 al ${maxGruposCatalogo}).`;
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
 * Evalúa atómicamente una lista de comandos compuestos (regla todo o nada):
 * si cualquier sub-comando falla validación o contiene inyección, rechaza todo el bloque.
 */
export function bloqueoDeSeguridadCompuesto(
  comandos: readonly ComandoLuces[],
  ordenOriginal: string | null = null
): string | null {
  if (!Array.isArray(comandos) || comandos.length === 0) {
    return 'No hay comandos válidos para ejecutar.';
  }

  for (let indice = 0; indice < comandos.length; indice += 1) {
    const errorSubcomando = bloqueoDeSeguridad(comandos[indice], ordenOriginal);
    if (errorSubcomando !== null) {
      return comandos.length > 1
        ? `Sub-comando ${indice + 1} bloqueado: ${errorSubcomando}`
        : errorSubcomando;
    }
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
