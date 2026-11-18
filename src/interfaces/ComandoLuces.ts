/**
 * Acciones soportadas desde el proceso de renderizado (Frontend) hacia la consola GrandMA2.
 */
export type TipoAccionLuz = 'encender' | 'apagar' | 'ajustar' | 'color';

/**
 * Tipos de parámetros controlables definidos en el acuerdo de interfaz IPC.
 */
export type TipoParametroLuz = 'intensidad' | 'color';

/**
 * Contrato de carga útil JSON enviado por el frontend mediante IPC.
 * Ejemplo intensidad: { accion: "encender", grupo: "1", valor: "50", tipo: "intensidad" }
 * Ejemplo color:      { accion: "color", grupo: "1", valor: "4.2", tipo: "color" }
 */
export interface ComandoLuces {
  readonly accion: TipoAccionLuz;
  readonly grupo: string;
  readonly valor: string;
  readonly tipo: TipoParametroLuz;
}

/**
 * Estados posibles del ciclo de vida de la conexión TCP/Telnet con GrandMA2.
 */
export type EstadoConexionMA2 =
  | 'DESCONECTADO'
  | 'CONECTANDO'
  | 'CONECTADO'
  | 'AUTENTICADO'
  | 'RECONECTANDO'
  | 'ERROR';

/**
 * Respuesta estructurada que el proceso principal devuelve al frontend tras procesar un comando.
 */
export interface RespuestaComandoIPC {
  readonly exito: boolean;
  readonly comandoGenerado: string | null;
  readonly mensaje: string;
  readonly estadoConexion: EstadoConexionMA2;
  readonly marcaTiempo: string;
}

/**
 * Parámetros de configuración para el cliente Telnet de GrandMA2.
 */
export interface ConfiguracionTelnetMA2 {
  readonly host: string;
  readonly puerto: number;
  readonly usuario: string;
  readonly contrasena: string;
  readonly tiempoEsperaSocketMs: number;
  readonly retrasoBaseReconexionMs: number;
  readonly retrasoMaximoReconexionMs: number;
  readonly factorBackoff: number;
  readonly maximoComandosEnCola: number;
}

const ACCIONES_PERMITIDAS: ReadonlySet<string> = new Set<TipoAccionLuz>([
  'encender',
  'apagar',
  'ajustar',
  'color',
]);

const TIPOS_PARAMETRO_PERMITIDOS: ReadonlySet<string> = new Set<TipoParametroLuz>([
  'intensidad',
  'color',
]);

const EXPRESION_GRUPO_MA2 = /^\d+(?:\s*(?:thru|\+|-)\s*\d+)*$/i;
const EXPRESION_VALOR_NUMERICO = /^\d+(?:\.\d+)?$/;
const EXPRESION_PRESET_COLOR_MA2 = /^(?:4\.)?[1-9]\d?$/;

/**
 * Type Guard que verifica si un valor desconocido corresponde a un objeto plano no nulo.
 */
export function esObjetoNoNulo(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Type Guard que valida si el valor recibido corresponde a una acción de luz permitida.
 */
export function esAccionLuzValida(valor: unknown): valor is TipoAccionLuz {
  return typeof valor === 'string' && ACCIONES_PERMITIDAS.has(valor);
}

/**
 * Type Guard que valida si el valor recibido corresponde a un tipo de parámetro soportado.
 */
export function esTipoParametroLuzValido(valor: unknown): valor is TipoParametroLuz {
  return typeof valor === 'string' && TIPOS_PARAMETRO_PERMITIDOS.has(valor);
}

/**
 * Verifica que el identificador de grupo tenga una sintaxis numérica o de rango válida para GrandMA2
 * (por ejemplo: "1", "1 thru 10", "1 + 2") y previene inyección de caracteres de control.
 */
function esGrupoMA2Valido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }

  const grupoLimpio = valor.trim();
  return grupoLimpio.length > 0 && EXPRESION_GRUPO_MA2.test(grupoLimpio);
}

/**
 * Verifica que el valor de intensidad sea una cadena numérica finita dentro del rango [0, 100].
 */
function esValorIntensidadValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }

  const valorLimpio = valor.trim();
  if (!EXPRESION_VALOR_NUMERICO.test(valorLimpio)) {
    return false;
  }

  const numero = Number(valorLimpio);
  return Number.isFinite(numero) && numero >= 0 && numero <= 100;
}

/**
 * Verifica que el valor corresponda a un identificador de preset de color válido en GrandMA2
 * (ej. "4.1".."4.99" o índice "1".."99" dentro del pool 4 de Color).
 */
function esValorPresetColorValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }

  const presetLimpio = valor.trim();
  return EXPRESION_PRESET_COLOR_MA2.test(presetLimpio);
}

/**
 * Type Guard principal para validar en tiempo de ejecución los payloads recibidos desde ipcMain.
 */
export function esComandoLucesValido(cargaUtil: unknown): cargaUtil is ComandoLuces {
  if (!esObjetoNoNulo(cargaUtil)) {
    return false;
  }

  const accion = cargaUtil['accion'];
  const grupo = cargaUtil['grupo'];
  const valor = cargaUtil['valor'];
  const tipo = cargaUtil['tipo'];

  if (
    !esAccionLuzValida(accion) ||
    !esGrupoMA2Valido(grupo) ||
    !esTipoParametroLuzValido(tipo)
  ) {
    return false;
  }

  if (tipo === 'color') {
    return esValorPresetColorValido(valor);
  }

  return esValorIntensidadValido(valor);
}
