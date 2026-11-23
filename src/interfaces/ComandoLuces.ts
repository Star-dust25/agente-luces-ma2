/**
 * Acciones soportadas desde el proceso de renderizado (Frontend) hacia la consola GrandMA2.
 */
export type TipoAccionLuz =
  | 'encender'
  | 'apagar'
  | 'ajustar'
  | 'color'
  | 'siguiente'
  | 'anterior'
  | 'ir_cue'
  | 'detener';

/**
 * Tipos de parámetros controlables definidos en el acuerdo de interfaz IPC.
 */
export type TipoParametroLuz = 'intensidad' | 'color' | 'cue';

/**
 * Contrato de carga útil JSON enviado por el frontend mediante IPC.
 */
export interface ComandoLuces {
  readonly accion: TipoAccionLuz;
  readonly grupo: string;
  readonly valor: string;
  readonly tipo: TipoParametroLuz;
  readonly executor?: string;
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
 * Parámetros de configuración internos para el cliente Telnet de GrandMA2.
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

/**
 * Tema visual de la interfaz en cabina.
 */
export type TemaInterfaz = 'cabina' | 'dia';

/**
 * Sección de conexión persistida en config.json.
 */
export interface ConfiguracionConexionTelnet {
  readonly host: string;
  readonly puerto: number;
  readonly usuario: string;
  readonly contrasena: string;
}

/**
 * Definición editable de un grupo de luces en config.json.
 */
export interface ConfiguracionGrupoMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly sinonimos: readonly string[];
}

/**
 * Definición editable de un preset cromático en config.json.
 */
export interface ConfiguracionColorMA2 {
  readonly id: string;
  readonly nombre: string;
  readonly preset: string;
  readonly hex: string;
  readonly sinonimos: readonly string[];
}

/**
 * Preferencias de interfaz y seguridad de voz en config.json.
 */
export interface ConfiguracionInterfazMA2 {
  readonly tema: TemaInterfaz;
  readonly autoEjecutarVoz: boolean;
}

/**
 * Estructura completa del archivo de configuración externa config.json (RNF-03).
 */
export interface ConfiguracionSistemaMA2 {
  readonly conexion: ConfiguracionConexionTelnet;
  readonly executorPorDefecto: number;
  readonly grupos: readonly ConfiguracionGrupoMA2[];
  readonly colores: readonly ConfiguracionColorMA2[];
  readonly interfaz: ConfiguracionInterfazMA2;
}

/**
 * Respuesta devuelta al guardar configuración desde Ajustes vía IPC.
 */
export interface RespuestaGuardarConfigIPC {
  readonly exito: boolean;
  readonly configuracion: ConfiguracionSistemaMA2;
  readonly mensaje: string;
}

/**
 * Resultado de transcripción local devuelto por el servicio de voz offline (RF-06).
 */
export interface ResultadoTranscripcionVoz {
  readonly exito: boolean;
  readonly texto: string;
  readonly mensaje: string;
  readonly duracionMs: number;
  readonly estadoModelo?: 'LISTO' | 'DESCARGANDO' | 'ERROR';
}

const ACCIONES_INTENSIDAD: ReadonlySet<string> = new Set<TipoAccionLuz>([
  'encender',
  'apagar',
  'ajustar',
]);

const ACCIONES_CUE: ReadonlySet<string> = new Set<TipoAccionLuz>([
  'siguiente',
  'anterior',
  'ir_cue',
  'detener',
]);

const TIPOS_PARAMETRO_PERMITIDOS: ReadonlySet<string> = new Set<TipoParametroLuz>([
  'intensidad',
  'color',
  'cue',
]);

const EXPRESION_GRUPO_MA2 = /^\d+(?:\s*(?:thru|\+|-)\s*\d+)*$/i;
const EXPRESION_VALOR_NUMERICO = /^\d+(?:\.\d+)?$/;
const EXPRESION_PRESET_COLOR_MA2 = /^(?:4\.)?[1-9]\d?$/;
const EXPRESION_EXECUTOR_VALIDO = /^[1-9]\d{0,2}$/;
const EXPRESION_CUE_VALIDO = /^\d+(?:\.\d{1,3})?$/;
const EXPRESION_CONTROL_TELNET = /[\r\n;\0\x01-\x1f]/;
const EXPRESION_HEX_VALIDO = /^#[0-9a-f]{6}$/i;

/**
 * Type Guard que verifica si un valor desconocido corresponde a un objeto plano no nulo.
 */
export function esObjetoNoNulo(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Type Guard que valida si el valor recibido corresponde a un tipo de parámetro soportado.
 */
export function esTipoParametroLuzValido(valor: unknown): valor is TipoParametroLuz {
  return typeof valor === 'string' && TIPOS_PARAMETRO_PERMITIDOS.has(valor);
}

function esGrupoMA2Valido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }

  const grupoLimpio = valor.trim();
  return grupoLimpio.length > 0 && EXPRESION_GRUPO_MA2.test(grupoLimpio);
}

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

function esValorPresetColorValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }

  const presetLimpio = valor.trim();
  return EXPRESION_PRESET_COLOR_MA2.test(presetLimpio);
}

function esExecutorValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }
  return EXPRESION_EXECUTOR_VALIDO.test(valor.trim());
}

function esNumeroCueValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false;
  }
  const limpio = valor.trim();
  if (!EXPRESION_CUE_VALIDO.test(limpio)) {
    return false;
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0;
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
  const executor = cargaUtil['executor'];

  if (typeof accion !== 'string' || !esTipoParametroLuzValido(tipo)) {
    return false;
  }

  if (tipo === 'intensidad') {
    return (
      ACCIONES_INTENSIDAD.has(accion) &&
      esGrupoMA2Valido(grupo) &&
      esValorIntensidadValido(valor)
    );
  }

  if (tipo === 'color') {
    return (
      accion === 'color' &&
      esGrupoMA2Valido(grupo) &&
      esValorPresetColorValido(valor)
    );
  }

  // Validación estricta para tipo === 'cue' (RF-07)
  if (!ACCIONES_CUE.has(accion) || typeof valor !== 'string' || EXPRESION_CONTROL_TELNET.test(valor)) {
    return false;
  }

  const executorCandidato = executor !== undefined ? executor : grupo;
  if (!esExecutorValido(executorCandidato)) {
    return false;
  }

  if (accion === 'ir_cue') {
    return esNumeroCueValido(valor);
  }

  return true;
}

function esCadenaSeguraNoVacia(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.trim().length > 0 &&
    !EXPRESION_CONTROL_TELNET.test(valor)
  );
}

function esListaSinonimosValida(valor: unknown): valor is readonly string[] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((item) => esCadenaSeguraNoVacia(item))
  );
}

function esGrupoConfigValido(valor: unknown): valor is ConfiguracionGrupoMA2 {
  if (!esObjetoNoNulo(valor)) {
    return false;
  }
  return (
    esCadenaSeguraNoVacia(valor['id']) &&
    /^[1-9]\d{0,2}$/.test(valor['id'].trim()) &&
    esCadenaSeguraNoVacia(valor['nombre']) &&
    typeof valor['descripcion'] === 'string' &&
    !EXPRESION_CONTROL_TELNET.test(valor['descripcion']) &&
    esListaSinonimosValida(valor['sinonimos'])
  );
}

function esColorConfigValido(valor: unknown): valor is ConfiguracionColorMA2 {
  if (!esObjetoNoNulo(valor)) {
    return false;
  }
  return (
    esCadenaSeguraNoVacia(valor['id']) &&
    esCadenaSeguraNoVacia(valor['nombre']) &&
    esValorPresetColorValido(valor['preset']) &&
    typeof valor['hex'] === 'string' &&
    EXPRESION_HEX_VALIDO.test(valor['hex'].trim()) &&
    esListaSinonimosValida(valor['sinonimos'])
  );
}

/**
 * Type Guard estricto para validar el esquema completo de config.json.
 */
export function esConfiguracionSistemaValida(valor: unknown): valor is ConfiguracionSistemaMA2 {
  if (!esObjetoNoNulo(valor)) {
    return false;
  }

  const conexion = valor['conexion'];
  const executor = valor['executorPorDefecto'];
  const grupos = valor['grupos'];
  const colores = valor['colores'];
  const interfaz = valor['interfaz'];

  if (!esObjetoNoNulo(conexion) || !esObjetoNoNulo(interfaz)) {
    return false;
  }

  const puerto = conexion['puerto'];
  const conexionValida =
    esCadenaSeguraNoVacia(conexion['host']) &&
    typeof puerto === 'number' &&
    Number.isInteger(puerto) &&
    puerto >= 1 &&
    puerto <= 65535 &&
    esCadenaSeguraNoVacia(conexion['usuario']) &&
    esCadenaSeguraNoVacia(conexion['contrasena']);

  const executorValido =
    typeof executor === 'number' &&
    Number.isInteger(executor) &&
    executor >= 1 &&
    executor <= 999;

  const gruposValidos =
    Array.isArray(grupos) && grupos.length > 0 && grupos.every(esGrupoConfigValido);

  const coloresValidos =
    Array.isArray(colores) && colores.length > 0 && colores.every(esColorConfigValido);

  const tema = interfaz['tema'];
  const autoEjecutarVoz = interfaz['autoEjecutarVoz'];
  const interfazValida =
    (tema === 'cabina' || tema === 'dia') && typeof autoEjecutarVoz === 'boolean';

  return conexionValida && executorValido && gruposValidos && coloresValidos && interfazValida;
}
