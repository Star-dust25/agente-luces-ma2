import type { DefinicionGrupoMA2 } from '../diccionario/TraductorLuces';
import type { ComandoLuces } from '../tipos/ipc';

export const MAX_PASOS_DESHACER = 20;
export const TOTAL_GRUPOS_RIG = 6;

/**
 * Estado completo de un grupo de luces en el monitor en vivo.
 */
export interface InstantaneaGrupo {
  readonly id: string;
  readonly nombre: string;
  readonly intensidad: number;
  readonly colorNombre: string | null;
  readonly colorHex: string | null;
  readonly colorPreset: string | null;
}

/**
 * Snapshot reversible almacenado en la pila de historial (Deshacer).
 */
export interface PasoDeshacer {
  readonly id: string;
  readonly etiqueta: string;
  readonly estadosPrevios: readonly InstantaneaGrupo[];
}

/**
 * Resumen legible de la selección actual para la barra de control rápido.
 */
export interface ResumenSeleccionGrupos {
  readonly badge: string;
  readonly titulo: string;
}

/**
 * Ordena numéricamente los identificadores de grupo sin duplicados.
 */
export function ordenarIdsGrupos(ids: readonly string[]): readonly string[] {
  const unicos = Array.from(new Set(ids));
  return unicos.sort((a, b) => Number(a) - Number(b));
}

/**
 * Indica si todos los grupos configurados (G1–G6) están seleccionados.
 */
export function esSeleccionCompleta(
  ids: readonly string[],
  totalGrupos: number = TOTAL_GRUPOS_RIG
): boolean {
  const ordenados = ordenarIdsGrupos(ids);
  if (ordenados.length !== totalGrupos) {
    return false;
  }
  for (let i = 1; i <= totalGrupos; i += 1) {
    if (!ordenados.includes(String(i))) {
      return false;
    }
  }
  return true;
}

/**
 * Actualiza la selección de grupos según clic simple o Ctrl/Cmd + clic.
 * Garantiza que siempre quede al menos un grupo seleccionado.
 */
export function alternarSeleccionGrupo(
  actuales: readonly string[],
  idClick: string,
  multiseleccion: boolean
): readonly string[] {
  if (!multiseleccion) {
    return [idClick];
  }

  const yaExiste = actuales.includes(idClick);
  if (yaExiste) {
    if (actuales.length <= 1) {
      return actuales;
    }
    return ordenarIdsGrupos(actuales.filter((id) => id !== idClick));
  }

  return ordenarIdsGrupos([...actuales, idClick]);
}

/**
 * Genera el texto descriptivo de la selección activa (1 grupo, subconjunto o Todos).
 */
export function formatearResumenSeleccion(
  ids: readonly string[],
  catalogo: readonly DefinicionGrupoMA2[]
): ResumenSeleccionGrupos {
  const ordenados = ordenarIdsGrupos(ids);

  if (ordenados.length === 0) {
    return { badge: 'G1', titulo: 'Frontales' };
  }

  if (esSeleccionCompleta(ordenados, catalogo.length)) {
    return { badge: 'TODOS', titulo: `Todos (G1–G${catalogo.length})` };
  }

  if (ordenados.length === 1) {
    const idUnico = ordenados[0];
    const definicion = catalogo.find((g) => g.id === idUnico);
    return {
      badge: `G${idUnico}`,
      titulo: definicion?.nombre ?? `Grupo ${idUnico}`,
    };
  }

  return {
    badge: `${ordenados.length} GRUPOS`,
    titulo: ordenados.map((id) => `G${id}`).join(', '),
  };
}

/**
 * Construye los comandos de intensidad para la selección actual.
 * Cuando están seleccionados todos los grupos (G1–G6), compacta en "1 thru 6".
 */
export function construirComandosIntensidadSeleccion(
  idsSeleccionados: readonly string[],
  porcentaje: number,
  totalGrupos: number = TOTAL_GRUPOS_RIG
): readonly ComandoLuces[] {
  const ordenados = ordenarIdsGrupos(idsSeleccionados);
  const nivel = Math.max(0, Math.min(100, Math.round(porcentaje)));
  const accion = nivel === 0 ? 'apagar' : nivel === 100 ? 'encender' : 'ajustar';

  if (esSeleccionCompleta(ordenados, totalGrupos)) {
    return [
      {
        accion,
        grupo: `1 thru ${totalGrupos}`,
        valor: String(nivel),
        tipo: 'intensidad',
      },
    ];
  }

  return ordenados.map((idGrupo) => ({
    accion,
    grupo: idGrupo,
    valor: String(nivel),
    tipo: 'intensidad',
  }));
}

/**
 * Construye los comandos de preset de color (Pool 4) para la selección actual.
 */
export function construirComandosColorSeleccion(
  idsSeleccionados: readonly string[],
  preset: string,
  totalGrupos: number = TOTAL_GRUPOS_RIG
): readonly ComandoLuces[] {
  const ordenados = ordenarIdsGrupos(idsSeleccionados);

  if (esSeleccionCompleta(ordenados, totalGrupos)) {
    return [
      {
        accion: 'color',
        grupo: `1 thru ${totalGrupos}`,
        valor: preset,
        tipo: 'color',
      },
    ];
  }

  return ordenados.map((idGrupo) => ({
    accion: 'color',
    grupo: idGrupo,
    valor: preset,
    tipo: 'color',
  }));
}

/**
 * Expande un descriptor de grupo ("1", "1 thru 6", "1 + 3") en sus IDs individuales.
 */
export function expandirIdsGrupo(grupoTexto: string): readonly string[] {
  const limpio = grupoTexto.trim().toLowerCase();
  const rango = /^(\d+)\s+thru\s+(\d+)$/.exec(limpio);
  if (rango !== null) {
    const inicio = Number(rango[1]);
    const fin = Number(rango[2]);
    const lista: string[] = [];
    for (let i = inicio; i <= fin; i += 1) {
      lista.push(String(i));
    }
    return lista;
  }

  return limpio
    .split(/\s*\+\s*/)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0);
}

/**
 * Captura una instantánea inmutable de los grupos que serán modificados por un lote de comandos.
 */
export function capturarInstantaneaAfectados(
  gruposActuales: Readonly<Record<string, InstantaneaGrupo>>,
  comandos: readonly ComandoLuces[]
): readonly InstantaneaGrupo[] {
  const idsAfectados = new Set<string>();
  for (const cmd of comandos) {
    for (const id of expandirIdsGrupo(cmd.grupo)) {
      if (gruposActuales[id] !== undefined) {
        idsAfectados.add(id);
      }
    }
  }

  return ordenarIdsGrupos(Array.from(idsAfectados)).map((id) => ({
    ...gruposActuales[id],
  }));
}

/**
 * Inserta un nuevo snapshot al inicio de la pila de Deshacer respetando el límite máximo (20).
 */
export function registrarPasoDeshacer(
  pilaActual: readonly PasoDeshacer[],
  nuevoPaso: PasoDeshacer
): readonly PasoDeshacer[] {
  if (nuevoPaso.estadosPrevios.length === 0) {
    return pilaActual;
  }
  return [nuevoPaso, ...pilaActual.slice(0, MAX_PASOS_DESHACER - 1)];
}

/**
 * Construye los comandos GrandMA2 necesarios para revertir cada grupo a su estado previo exacto.
 */
export function construirComandosRestauracion(
  estadosPrevios: readonly InstantaneaGrupo[]
): readonly ComandoLuces[] {
  const comandos: ComandoLuces[] = [];

  for (const estado of estadosPrevios) {
    const accionIntensidad =
      estado.intensidad === 0 ? 'apagar' : estado.intensidad === 100 ? 'encender' : 'ajustar';

    comandos.push({
      accion: accionIntensidad,
      grupo: estado.id,
      valor: String(estado.intensidad),
      tipo: 'intensidad',
    });

    if (estado.colorPreset !== null && estado.intensidad > 0) {
      comandos.push({
        accion: 'color',
        grupo: estado.id,
        valor: estado.colorPreset,
        tipo: 'color',
      });
    }
  }

  return comandos;
}
