import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ModalAjustes } from './componentes/ModalAjustes';
import { RuedaColores } from './componentes/RuedaColores';
import {
  CATALOGO_COLORES,
  CATALOGO_GRUPOS,
  TraductorLuces,
  type DefinicionColorMA2,
  type ResultadoInterpretacion,
} from './diccionario/TraductorLuces';
import { bloqueoDeSeguridadCompuesto } from './seguridadComandos';
import { GrabadoraVozCabina } from './servicios/capturaAudio';
import {
  alternarSeleccionGrupo,
  capturarInstantaneaAfectados,
  construirComandosColorSeleccion,
  construirComandosIntensidadSeleccion,
  construirComandosRestauracion,
  esSeleccionCompleta,
  expandirIdsGrupo,
  formatearResumenSeleccion,
  registrarPasoDeshacer,
  type InstantaneaGrupo,
  type PasoDeshacer,
} from './servicios/operacionesCabina';
import type {
  ComandoLuces,
  ConfiguracionSistemaMA2,
  EstadoConexionMA2,
  RespuestaComandoIPC,
} from './tipos/ipc';

type NivelLog = 'info' | 'exito' | 'advertencia' | 'error';
type EstadoVoz = 'inactivo' | 'escuchando' | 'transcribiendo';

interface RegistroLog {
  readonly id: string;
  readonly hora: string;
  readonly nivel: NivelLog;
  readonly titulo: string;
  readonly sintaxisMA2: string | null;
  readonly comandosPayload: readonly ComandoLuces[];
  readonly textoOriginal: string | null;
}

interface ToastItem {
  readonly id: string;
  readonly nivel: NivelLog;
  readonly titulo: string;
  readonly detalle: string;
}

type MenuContextual =
  | { readonly tipo: 'grupo'; readonly x: number; readonly y: number; readonly idGrupo: string }
  | { readonly tipo: 'log'; readonly x: number; readonly y: number; readonly idLog: string };

interface OpcionesDespacho {
  readonly textoOriginal?: string | null;
  readonly colorOpcional?: DefinicionColorMA2;
  readonly registrarDeshacer?: boolean;
}

const CONFIGURACION_POR_DEFECTO_UI: ConfiguracionSistemaMA2 = {
  conexion: {
    host: '127.0.0.1',
    puerto: 30000,
    usuario: 'administrator',
    contrasena: 'admin',
  },
  executorPorDefecto: 1,
  grupos: CATALOGO_GRUPOS,
  colores: CATALOGO_COLORES,
  interfaz: {
    tema: 'cabina',
    autoEjecutarVoz: false,
  },
};

const EJEMPLOS_RAPIDOS = [
  'Frontales al 70% en azul',
  'Frontales al 100% y contras apagadas',
  'Siguiente escena',
  'Ir a escena 3',
] as const;

const NIVELES_RAPIDOS = [0, 25, 50, 75, 100] as const;

const TECLAS_SLIDER_CONFIRMACION: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

function etiquetaEstadoConexion(estado: EstadoConexionMA2 | 'WEB'): {
  texto: string;
  clase: string;
} {
  switch (estado) {
    case 'AUTENTICADO':
      return { texto: 'MA2 Autenticado', clase: 'badge-estado-exito' };
    case 'CONECTADO':
      return { texto: 'TCP Conectado', clase: 'badge-estado-ambar' };
    case 'CONECTANDO':
      return { texto: 'Conectando...', clase: 'badge-estado-ambar' };
    case 'RECONECTANDO':
      return { texto: 'Reconectando...', clase: 'badge-estado-ambar' };
    case 'WEB':
      return { texto: 'Simulador Web', clase: 'badge-estado-ambar' };
    case 'ERROR':
      return { texto: 'Error Telnet', clase: 'badge-estado-error' };
    case 'DESCONECTADO':
      return { texto: 'Desconectado', clase: 'badge-estado-error' };
  }
}

function horaActual(): string {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function crearId(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function crearMapaGruposDesdeConfig(
  config: ConfiguracionSistemaMA2,
  actual?: Readonly<Record<string, InstantaneaGrupo>>
): Record<string, InstantaneaGrupo> {
  const mapa: Record<string, InstantaneaGrupo> = {};
  for (const g of config.grupos) {
    const previo = actual?.[g.id];
    const presetPrevio = previo?.colorPreset ?? null;
    const colorActualizado =
      presetPrevio !== null
        ? config.colores.find((color) => color.preset === presetPrevio)
        : undefined;

    mapa[g.id] = {
      id: g.id,
      nombre: g.nombre,
      intensidad: previo?.intensidad ?? 0,
      colorNombre: colorActualizado?.nombre ?? null,
      colorHex: colorActualizado?.hex ?? null,
      colorPreset: colorActualizado?.preset ?? null,
    };
  }
  return mapa;
}

function posicionarMenu(x: number, y: number): { left: number; top: number } {
  return {
    left: Math.min(x, Math.max(16, window.innerWidth - 224)),
    top: Math.min(y, Math.max(16, window.innerHeight - 410)),
  };
}

function construirSintaxisDesdePayload(payload: ComandoLuces): string {
  if (payload.tipo === 'cue') {
    const exec = payload.executor ?? payload.grupo;
    switch (payload.accion) {
      case 'siguiente':
        return `Go Executor ${exec}`;
      case 'anterior':
        return `GoBack Executor ${exec}`;
      case 'detener':
        return `Off Executor ${exec}`;
      case 'ir_cue':
        return `Goto Cue ${payload.valor} Executor ${exec}`;
      default:
        return `Go Executor ${exec}`;
    }
  }

  if (payload.tipo === 'color') {
    const preset = payload.valor.includes('.') ? payload.valor : `4.${payload.valor}`;
    return `Group ${payload.grupo} At Preset ${preset}`;
  }
  const nivel = payload.accion === 'apagar' ? '0' : payload.valor;
  return `Group ${payload.grupo} At ${nivel}`;
}

export default function App() {
  const esElectron = typeof window !== 'undefined' && window.api !== undefined;

  const [configuracion, setConfiguracion] = useState<ConfiguracionSistemaMA2>(
    CONFIGURACION_POR_DEFECTO_UI
  );
  const [modalAjustesAbierto, setModalAjustesAbierto] = useState<boolean>(false);
  const [ruedaAbierta, setRuedaAbierta] = useState<boolean>(false);
  const [guardandoAjustes, setGuardandoAjustes] = useState<boolean>(false);

  const [orden, setOrden] = useState<string>('');
  const [cueNumeroInput, setCueNumeroInput] = useState<string>('1');
  const [grupos, setGrupos] = useState<Record<string, InstantaneaGrupo>>(() =>
    crearMapaGruposDesdeConfig(CONFIGURACION_POR_DEFECTO_UI)
  );
  const [gruposSeleccionados, setGruposSeleccionados] = useState<readonly string[]>(['1']);
  const [valorSlider, setValorSlider] = useState<number>(0);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionMA2 | 'WEB'>(
    esElectron ? 'CONECTANDO' : 'WEB'
  );
  const [cargando, setCargando] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [logs, setLogs] = useState<RegistroLog[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [menu, setMenu] = useState<MenuContextual | null>(null);
  const [confirmandoBlackout, setConfirmandoBlackout] = useState<boolean>(false);
  const [pilaDeshacer, setPilaDeshacer] = useState<readonly PasoDeshacer[]>([]);
  const [historialOrdenes, setHistorialOrdenes] = useState<readonly string[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState<number>(-1);
  const [borradorTemporal, setBorradorTemporal] = useState<string>('');
  const [sugerenciasOcultas, setSugerenciasOcultas] = useState<boolean>(false);

  const [estadoVoz, setEstadoVoz] = useState<EstadoVoz>('inactivo');
  const [nivelVoz, setNivelVoz] = useState<number>(0);
  const [progresoVoz, setProgresoVoz] = useState<string | null>(null);

  const gruposRef = useRef<Record<string, InstantaneaGrupo>>(grupos);
  gruposRef.current = grupos;

  const configuracionRef = useRef<ConfiguracionSistemaMA2>(configuracion);
  configuracionRef.current = configuracion;

  const grabadoraRef = useRef<GrabadoraVozCabina | null>(null);
  const inicioPresionMicRef = useRef<number | null>(null);
  const estadoVozRef = useRef<EstadoVoz>(estadoVoz);
  estadoVozRef.current = estadoVoz;

  const timersRef = useRef<Map<string, number>>(new Map());
  const timerBlackoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const botonRuedaRef = useRef<HTMLButtonElement | null>(null);
  const enviandoRef = useRef(false);
  const ultimoIntentoRef = useRef<{ clave: string; instante: number } | null>(null);

  const catalogoGruposActual = configuracion.grupos;
  const catalogoColoresActual = configuracion.colores;

  const interpretacion = useMemo<ResultadoInterpretacion | null>(() => {
    if (orden.trim().length === 0) {
      return null;
    }
    const resultado = TraductorLuces.interpretarOrden(orden);
    if (resultado.exito && resultado.comandosPayload.length > 0) {
      const bloqueo = bloqueoDeSeguridadCompuesto(
        resultado.comandosPayload,
        resultado.textoOriginal
      );
      if (bloqueo !== null) {
        return {
          ...resultado,
          exito: false,
          comandoPayload: null,
          comandosPayload: [],
          sintaxisMA2: null,
          sintaxisListaMA2: [],
          resumenesComandos: [],
          mensajeError: bloqueo,
        };
      }
    }
    return resultado;
  }, [orden, configuracion]);

  const sugerenciasActivas = useMemo<readonly string[]>(() => {
    if (sugerenciasOcultas || orden.trim().length === 0) {
      return [];
    }
    return TraductorLuces.generarSugerencias(orden, 3);
  }, [orden, sugerenciasOcultas, configuracion]);

  const resumenSeleccion = useMemo(
    () => formatearResumenSeleccion(gruposSeleccionados, catalogoGruposActual),
    [gruposSeleccionados, catalogoGruposActual]
  );

  const todosSeleccionados = useMemo(
    () => esSeleccionCompleta(gruposSeleccionados, catalogoGruposActual.length),
    [gruposSeleccionados, catalogoGruposActual.length]
  );

  const colorActivoSeleccion = useMemo(() => {
    if (gruposSeleccionados.length === 0) {
      return { preset: null as string | null, nombre: null as string | null, hex: null as string | null };
    }
    const primero = grupos[gruposSeleccionados[0]];
    if (primero === undefined || primero.colorPreset === null) {
      return { preset: null, nombre: null, hex: null };
    }
    const todosComparten = gruposSeleccionados.every(
      (id) => grupos[id]?.colorPreset === primero.colorPreset
    );
    if (!todosComparten) {
      return { preset: null, nombre: 'Mixto', hex: null };
    }
    return {
      preset: primero.colorPreset,
      nombre: primero.colorNombre,
      hex: primero.colorHex,
    };
  }, [grupos, gruposSeleccionados]);

  const aplicarConfiguracionEnMemoria = useCallback((config: ConfiguracionSistemaMA2) => {
    setConfiguracion(config);
    TraductorLuces.configurarCatalogoDinamico({
      grupos: config.grupos,
      colores: config.colores,
      executorPorDefecto: config.executorPorDefecto,
    });
    setGrupos((prev) => crearMapaGruposDesdeConfig(config, prev));
  }, []);

  const seleccionarGrupos = useCallback((nuevosIds: readonly string[]) => {
    setGruposSeleccionados(nuevosIds);
    const idReferencia = nuevosIds[0];
    if (idReferencia !== undefined && gruposRef.current[idReferencia] !== undefined) {
      setValorSlider(gruposRef.current[idReferencia].intensidad);
    }
  }, []);

  const lanzarToast = useCallback((nivel: NivelLog, titulo: string, detalle: string) => {
    const id = crearId('toast');
    setToasts((prev) => [...prev.slice(-2), { id, nivel, titulo, detalle }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, 3800);
    timersRef.current.set(id, timer);
  }, []);

  const cerrarToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const registrarLog = useCallback((item: Omit<RegistroLog, 'id' | 'hora'>) => {
    setLogs((prev) => [{ ...item, id: crearId('log'), hora: horaActual() }, ...prev.slice(0, 29)]);
  }, []);

  const sincronizar = useCallback(
    async (notificar = false) => {
      setCargando(true);
      try {
        if (window.api !== undefined) {
          const [estado, configPersistida] = await Promise.all([
            window.api.obtenerEstadoConexion(),
            window.api.obtenerConfiguracion(),
            new Promise<void>((r) => window.setTimeout(r, 320)),
          ]);
          setEstadoConexion(estado);
          aplicarConfiguracionEnMemoria(configPersistida);
          if (notificar) {
            lanzarToast('exito', 'Consola sincronizada', `Estado Telnet: ${estado}`);
          }
        } else {
          await new Promise<void>((r) => window.setTimeout(r, 320));
          setEstadoConexion('WEB');
          if (notificar) {
            lanzarToast('info', 'Modo Simulador Web', 'Ejecuta Electron para conexión TCP real.');
          }
        }
      } finally {
        setCargando(false);
      }
    },
    [aplicarConfiguracionEnMemoria, lanzarToast]
  );

  useEffect(() => {
    void sincronizar(false);
    if (window.api === undefined) {
      return undefined;
    }
    const desuscribirEstado = window.api.suscribirEstadoConexion((nuevoEstado) => {
      setEstadoConexion(nuevoEstado);
    });
    const desuscribirProgresoVoz =
      typeof window.api.suscribirProgresoVoz === 'function'
        ? window.api.suscribirProgresoVoz((mensaje) => {
            setProgresoVoz(mensaje);
          })
        : () => {};
    return () => {
      desuscribirEstado();
      desuscribirProgresoVoz();
    };
  }, [sincronizar]);

  useEffect(() => {
    if (menu === null) {
      return undefined;
    }
    const cerrar = () => setMenu(null);
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('click', cerrar);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('click', cerrar);
      window.removeEventListener('keydown', escape);
    };
  }, [menu]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
      if (timerBlackoutRef.current !== null) {
        window.clearTimeout(timerBlackoutRef.current);
      }
      void grabadoraRef.current?.cancelar();
    };
  }, []);

  const actualizarEstadoGrupoLocal = useCallback(
    (payload: ComandoLuces, color?: DefinicionColorMA2) => {
      if (payload.tipo === 'cue') {
        return;
      }

      const ids = expandirIdsGrupo(payload.grupo);
      setGrupos((prev) => {
        const copia = { ...prev };
        for (const id of ids) {
          const actual = copia[id];
          if (actual === undefined) continue;
          if (payload.tipo === 'color') {
            const c =
              color ??
              configuracionRef.current.colores.find((item) => item.preset === payload.valor);
            copia[id] = {
              ...actual,
              colorNombre: c?.nombre ?? `Preset ${payload.valor}`,
              colorHex: c?.hex ?? actual.colorHex,
              colorPreset: c?.preset ?? payload.valor,
            };
          } else {
            const valorNum = Number(payload.valor);
            copia[id] = {
              ...actual,
              intensidad: Number.isFinite(valorNum) ? valorNum : actual.intensidad,
            };
          }
        }
        return copia;
      });

      if (ids.includes(gruposSeleccionados[0]) && payload.tipo === 'intensidad') {
        const valorNum = Number(payload.valor);
        if (Number.isFinite(valorNum)) {
          setValorSlider(valorNum);
        }
      }
    },
    [gruposSeleccionados]
  );

  const despacharLoteComandos = useCallback(
    async (
      comandos: readonly ComandoLuces[],
      tituloLote: string,
      opciones: OpcionesDespacho = {}
    ): Promise<boolean> => {
      const { textoOriginal = null, colorOpcional, registrarDeshacer = true } = opciones;

      const bloqueo = bloqueoDeSeguridadCompuesto(comandos, textoOriginal);
      if (bloqueo !== null) {
        lanzarToast('advertencia', 'Orden bloqueada', bloqueo);
        return false;
      }

      if (enviandoRef.current) {
        return false;
      }

      const clave = JSON.stringify(comandos);
      const ahora = Date.now();
      if (
        registrarDeshacer &&
        ultimoIntentoRef.current?.clave === clave &&
        ahora - ultimoIntentoRef.current.instante < 450
      ) {
        return false;
      }

      const comandosConGrupos = comandos.filter((c) => c.tipo !== 'cue');
      const instantaneaPrevia =
        registrarDeshacer && comandosConGrupos.length > 0
          ? capturarInstantaneaAfectados(gruposRef.current, comandosConGrupos)
          : [];

      ultimoIntentoRef.current = { clave, instante: ahora };
      enviandoRef.current = true;
      setEnviando(true);

      const sintaxisEnviadas: string[] = [];
      let falloEnvio = false;

      try {
        for (let indice = 0; indice < comandos.length; indice += 1) {
          const payload = comandos[indice];
          const sintaxisEsperada = construirSintaxisDesdePayload(payload);
          const etiquetaPaso =
            comandos.length > 1
              ? `${tituloLote} (${indice + 1}/${comandos.length})`
              : tituloLote;

          if (window.api !== undefined) {
            let respuesta: RespuestaComandoIPC;
            try {
              respuesta = await window.api.enviarComandoLuces(payload);
            } catch (error) {
              falloEnvio = true;
              registrarLog({
                nivel: 'error',
                titulo: `Error · ${etiquetaPaso}`,
                sintaxisMA2: sintaxisEsperada,
                comandosPayload: [payload],
                textoOriginal,
              });
              lanzarToast('error', 'No enviado a MA2', error instanceof Error ? error.message : String(error));
              break;
            }
            setEstadoConexion(respuesta.estadoConexion);
            const comandoFinal = respuesta.comandoGenerado?.trim() ?? sintaxisEsperada;

            if (respuesta.exito) {
              actualizarEstadoGrupoLocal(payload, colorOpcional);
              sintaxisEnviadas.push(comandoFinal);
              registrarLog({
                nivel: 'info',
                titulo: `Enviado a MA2 · ${etiquetaPaso}`,
                sintaxisMA2: comandoFinal,
                comandosPayload: [payload],
                textoOriginal,
              });
            } else {
              falloEnvio = true;
              registrarLog({
                nivel: 'error',
                titulo: `Error · ${etiquetaPaso}`,
                sintaxisMA2: comandoFinal,
                comandosPayload: [payload],
                textoOriginal,
              });
              lanzarToast('error', 'No enviado a MA2', respuesta.mensaje);
              break;
            }
          } else {
            await new Promise<void>((r) => window.setTimeout(r, 140));
            actualizarEstadoGrupoLocal(payload, colorOpcional);
            sintaxisEnviadas.push(sintaxisEsperada);
            registrarLog({
              nivel: 'info',
              titulo: `Simulación Web · ${etiquetaPaso}`,
              sintaxisMA2: sintaxisEsperada,
              comandosPayload: [payload],
              textoOriginal,
            });
          }
        }

        if (sintaxisEnviadas.length > 0) {
          const idsEnviados = new Set(
            comandos.slice(0, sintaxisEnviadas.length).flatMap((comando) =>
              comando.tipo === 'cue' ? [] : expandirIdsGrupo(comando.grupo)
            )
          );
          const instantaneaEnviada = instantaneaPrevia.filter((grupo) => idsEnviados.has(grupo.id));
          if (registrarDeshacer && instantaneaEnviada.length > 0) {
            setPilaDeshacer((prev) =>
              registrarPasoDeshacer(prev, {
                id: crearId('undo'),
                etiqueta: tituloLote,
                estadosPrevios: instantaneaEnviada,
              })
            );
          }

          const resumen = sintaxisEnviadas.join(' · ');
          if (falloEnvio) {
            lanzarToast('advertencia', 'Envío parcial', `${resumen} · Deshacer disponible para los grupos enviados.`);
          } else if (window.api !== undefined) {
            lanzarToast('info', `${tituloLote} · enviado a MA2`, `${resumen} · Sin confirmación física del resultado.`);
          } else {
            lanzarToast('info', `${tituloLote} (Web)`, resumen);
          }
        }

        return !falloEnvio;
      } finally {
        enviandoRef.current = false;
        setEnviando(false);
      }
    },
    [actualizarEstadoGrupoLocal, lanzarToast, registrarLog]
  );

  const ejecutarOrdenDesdeTexto = useCallback(
    async (textoAProcesar: string) => {
      const res = TraductorLuces.interpretarOrden(textoAProcesar);
      if (!res.exito || res.comandosPayload.length === 0) {
        const msg = res.mensajeError ?? 'No se pudo interpretar la instrucción.';
        lanzarToast('advertencia', 'Orden incompleta', msg);
        return;
      }

      const titulo =
        res.comandosPayload.length > 1
          ? `${res.etiquetaAccion} (${res.comandosPayload.length})`
          : `${res.etiquetaAccion} · ${res.etiquetaGrupo}`;

      const exitoEnvio = await despacharLoteComandos(res.comandosPayload, titulo, {
        textoOriginal: res.textoOriginal,
      });

      if (exitoEnvio && res.textoOriginal.length > 0) {
        setHistorialOrdenes((prev) => {
          if (prev[0] === res.textoOriginal) {
            return prev;
          }
          return [res.textoOriginal, ...prev.slice(0, 24)];
        });
        setIndiceHistorial(-1);
        setBorradorTemporal('');
        setSugerenciasOcultas(true);
      }
    },
    [despacharLoteComandos, lanzarToast]
  );

  const procesarFormulario = useCallback(async () => {
    await ejecutarOrdenDesdeTexto(orden);
  }, [ejecutarOrdenDesdeTexto, orden]);

  // Control por voz local (Push-to-Talk y clic para iniciar/detener)
  const iniciarGrabacionVoz = useCallback(async () => {
    if (estadoVozRef.current !== 'inactivo') {
      return;
    }

    if (grabadoraRef.current === null) {
      grabadoraRef.current = new GrabadoraVozCabina();
    }

    try {
      setNivelVoz(0);
      setProgresoVoz(null);
      await grabadoraRef.current.iniciar((nivel) => setNivelVoz(nivel));
      setEstadoVoz('escuchando');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setEstadoVoz('inactivo');
      setNivelVoz(0);
      setProgresoVoz(null);
      lanzarToast('error', 'Micrófono no disponible', msg);
      registrarLog({
        nivel: 'error',
        titulo: 'Error de micrófono',
        sintaxisMA2: null,
        comandosPayload: [],
        textoOriginal: null,
      });
    }
  }, [lanzarToast, registrarLog]);

  const detenerYTranscribirVoz = useCallback(async () => {
    if (estadoVozRef.current !== 'escuchando' || grabadoraRef.current === null) {
      return;
    }

    setEstadoVoz('transcribiendo');
    setNivelVoz(0);

    try {
      const muestras16k = await grabadoraRef.current.detener();

      if (window.api === undefined) {
        lanzarToast(
          'advertencia',
          'Transcripción local requiere Electron',
          'En navegador web usa entrada por texto; abre en Electron para usar el motor Whisper offline.'
        );
        return;
      }

      const resultado = await window.api.transcribirAudio(muestras16k);
      if (!resultado.exito || resultado.texto.trim().length === 0) {
        lanzarToast('advertencia', 'Sin transcripción válida', resultado.mensaje);
        registrarLog({
          nivel: 'advertencia',
          titulo: 'Voz no procesada',
          sintaxisMA2: null,
          comandosPayload: [],
          textoOriginal: null,
        });
        return;
      }

      const textoTranscrito = resultado.texto.trim();
      setOrden(textoTranscrito);
      setSugerenciasOcultas(true);
      inputRef.current?.focus();

      if (configuracionRef.current.interfaz.autoEjecutarVoz) {
        await ejecutarOrdenDesdeTexto(textoTranscrito);
      } else {
        lanzarToast(
          'info',
          `Voz transcrita (${resultado.duracionMs} ms)`,
          `"${textoTranscrito}" — Revisa y presiona Enter para ejecutar.`
        );
      }
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      lanzarToast('error', 'Error al transcribir audio', detalle);
    } finally {
      setEstadoVoz('inactivo');
      setNivelVoz(0);
      setProgresoVoz(null);
    }
  }, [ejecutarOrdenDesdeTexto, lanzarToast, registrarLog]);

  const manejarPointerDownMic = () => {
    if (estadoVoz === 'transcribiendo') {
      return;
    }
    if (estadoVoz === 'escuchando') {
      inicioPresionMicRef.current = null;
      void detenerYTranscribirVoz();
      return;
    }
    inicioPresionMicRef.current = Date.now();
    void iniciarGrabacionVoz();
  };

  const manejarPointerUpMic = () => {
    if (inicioPresionMicRef.current === null) {
      return;
    }
    const duracionPresion = Date.now() - inicioPresionMicRef.current;
    inicioPresionMicRef.current = null;
    // Si mantuvo presionado >= 320 ms funciona como Push-to-Talk al soltar
    if (duracionPresion >= 320 && estadoVozRef.current === 'escuchando') {
      void detenerYTranscribirVoz();
    }
  };

  const manejarPointerCancelMic = () => {
    if (inicioPresionMicRef.current === null && estadoVozRef.current !== 'escuchando') {
      return;
    }
    inicioPresionMicRef.current = null;
    void grabadoraRef.current?.cancelar();
    setEstadoVoz('inactivo');
    setNivelVoz(0);
    setProgresoVoz(null);
  };

  const manejarKeyDownMic = (evento: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (evento.altKey || evento.repeat) {
      return;
    }
    if (evento.key !== 'Enter' && evento.key !== ' ') {
      return;
    }
    evento.preventDefault();
    if (estadoVozRef.current === 'transcribiendo') {
      return;
    }
    if (estadoVozRef.current === 'escuchando') {
      inicioPresionMicRef.current = null;
      void detenerYTranscribirVoz();
      return;
    }
    inicioPresionMicRef.current = null;
    void iniciarGrabacionVoz();
  };

  // Atajos globales de teclado + Alt+Espacio Push-to-Talk
  useEffect(() => {
    const manejarAtajosGlobales = (evento: KeyboardEvent) => {
      if (modalAjustesAbierto) {
        return;
      }

      if (evento.altKey && evento.code === 'Space') {
        evento.preventDefault();
        if (!evento.repeat && estadoVozRef.current === 'inactivo') {
          void iniciarGrabacionVoz();
        }
        return;
      }

      const objetivo = evento.target as HTMLElement | null;
      const enCampoTexto =
        objetivo !== null &&
        (objetivo.tagName === 'TEXTAREA' ||
          objetivo.tagName === 'INPUT' ||
          objetivo.isContentEditable);

      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (evento.key === '/' && !enCampoTexto && !evento.altKey && !evento.ctrlKey && !evento.metaKey) {
        evento.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (evento.altKey && !evento.ctrlKey && !evento.metaKey) {
        if (/^[1-6]$/.test(evento.key)) {
          evento.preventDefault();
          seleccionarGrupos([evento.key]);
          return;
        }
        if (evento.key === '0') {
          evento.preventDefault();
          seleccionarGrupos(configuracionRef.current.grupos.map((g) => g.id));
        }
      }
    };

    const manejarSoltarPushToTalk = (evento: KeyboardEvent) => {
      if ((evento.code === 'Space' || evento.key === 'Alt') && estadoVozRef.current === 'escuchando') {
        if (inicioPresionMicRef.current === null) {
          void detenerYTranscribirVoz();
        }
      }
    };

    window.addEventListener('keydown', manejarAtajosGlobales);
    window.addEventListener('keyup', manejarSoltarPushToTalk);
    return () => {
      window.removeEventListener('keydown', manejarAtajosGlobales);
      window.removeEventListener('keyup', manejarSoltarPushToTalk);
    };
  }, [detenerYTranscribirVoz, iniciarGrabacionVoz, modalAjustesAbierto, seleccionarGrupos]);

  const accionRapidaGrupo = useCallback(
    async (idGrupo: string, porcentaje: number) => {
      const g = grupos[idGrupo];
      const nombre = g?.nombre ?? `Grupo ${idGrupo}`;
      const accion = porcentaje === 0 ? 'apagar' : porcentaje === 100 ? 'encender' : 'ajustar';

      if (
        idGrupo !== `1 thru ${catalogoGruposActual.length}` &&
        gruposSeleccionados.length === 1 &&
        gruposSeleccionados[0] === idGrupo
      ) {
        setValorSlider(porcentaje);
      }

      await despacharLoteComandos(
        [{ accion, grupo: idGrupo, valor: String(porcentaje), tipo: 'intensidad' }],
        `${nombre} al ${porcentaje}%`,
        { textoOriginal: `${nombre} al ${porcentaje}%` }
      );
    },
    [catalogoGruposActual.length, despacharLoteComandos, grupos, gruposSeleccionados]
  );

  const aplicarIntensidadSeleccion = useCallback(
    async (porcentaje: number) => {
      const comandos = construirComandosIntensidadSeleccion(
        gruposSeleccionados,
        porcentaje,
        catalogoGruposActual.length
      );
      setValorSlider(porcentaje);
      await despacharLoteComandos(comandos, `${resumenSeleccion.titulo} al ${porcentaje}%`, {
        textoOriginal: `${resumenSeleccion.titulo} al ${porcentaje}%`,
      });
    },
    [catalogoGruposActual.length, despacharLoteComandos, gruposSeleccionados, resumenSeleccion.titulo]
  );

  const aplicarColorSeleccion = useCallback(
    async (color: DefinicionColorMA2) => {
      const comandos = construirComandosColorSeleccion(
        gruposSeleccionados,
        color.preset,
        catalogoGruposActual.length
      );
      return despacharLoteComandos(comandos, `${resumenSeleccion.titulo} · ${color.nombre}`, {
        textoOriginal: `Poner ${resumenSeleccion.titulo.toLowerCase()} en ${color.nombre.toLowerCase()}`,
        colorOpcional: color,
      });
    },
    [catalogoGruposActual.length, despacharLoteComandos, gruposSeleccionados, resumenSeleccion.titulo]
  );

  const colorRapidoGrupo = useCallback(
    async (idGrupo: string, color: DefinicionColorMA2) => {
      const g = grupos[idGrupo];
      const nombre = g?.nombre ?? `Grupo ${idGrupo}`;
      await despacharLoteComandos(
        [{ accion: 'color', grupo: idGrupo, valor: color.preset, tipo: 'color' }],
        `${nombre} · ${color.nombre}`,
        {
          textoOriginal: `Poner ${nombre.toLowerCase()} en ${color.nombre.toLowerCase()}`,
          colorOpcional: color,
        }
      );
    },
    [despacharLoteComandos, grupos]
  );

  const ejecutarAccionCue = useCallback(
    async (accionCue: 'siguiente' | 'anterior' | 'ir_cue' | 'detener') => {
      const execStr = String(configuracion.executorPorDefecto);
      const valorCue = accionCue === 'ir_cue' ? cueNumeroInput.trim() : '';

      const payload: ComandoLuces = {
        accion: accionCue,
        grupo: execStr,
        executor: execStr,
        valor: valorCue,
        tipo: 'cue',
      };

      const etiquetas: Record<'siguiente' | 'anterior' | 'ir_cue' | 'detener', string> = {
        siguiente: `Siguiente escena (Exec ${execStr})`,
        anterior: `Escena anterior (Exec ${execStr})`,
        ir_cue: `Ir a Cue ${valorCue} (Exec ${execStr})`,
        detener: `Detener secuencia (Exec ${execStr})`,
      };

      await despacharLoteComandos([payload], etiquetas[accionCue], {
        textoOriginal: etiquetas[accionCue],
        registrarDeshacer: false,
      });
    },
    [configuracion.executorPorDefecto, cueNumeroInput, despacharLoteComandos]
  );

  const ejecutarDeshacer = useCallback(async () => {
    if (pilaDeshacer.length === 0 || enviandoRef.current) {
      return;
    }

    const [ultimoPaso, ...restoPila] = pilaDeshacer;
    const comandosRestauracion = construirComandosRestauracion(ultimoPaso.estadosPrevios);

    const exito = await despacharLoteComandos(
      comandosRestauracion,
      `Deshacer · ${ultimoPaso.etiqueta}`,
      { registrarDeshacer: false }
    );

    if (exito) {
      setGrupos((prev) => {
        const copia = { ...prev };
        for (const estadoPrevio of ultimoPaso.estadosPrevios) {
          copia[estadoPrevio.id] = { ...estadoPrevio };
        }
        return copia;
      });

      const primeroSeleccionado = ultimoPaso.estadosPrevios.find(
        (e) => e.id === gruposSeleccionados[0]
      );
      if (primeroSeleccionado !== undefined) {
        setValorSlider(primeroSeleccionado.intensidad);
      }

      setPilaDeshacer(restoPila);
    }
  }, [despacharLoteComandos, gruposSeleccionados, pilaDeshacer]);

  const guardarAjustesSistema = useCallback(
    async (nuevaConfig: ConfiguracionSistemaMA2) => {
      setGuardandoAjustes(true);
      try {
        if (window.api !== undefined) {
          const respuesta = await window.api.guardarConfiguracion(nuevaConfig);
          if (!respuesta.exito) {
            lanzarToast('error', 'No se pudo guardar config.json', respuesta.mensaje);
            return;
          }
          aplicarConfiguracionEnMemoria(respuesta.configuracion);
          setModalAjustesAbierto(false);
          lanzarToast('exito', 'Ajustes guardados', respuesta.mensaje);
        } else {
          aplicarConfiguracionEnMemoria(nuevaConfig);
          setModalAjustesAbierto(false);
          lanzarToast(
            'info',
            'Ajustes aplicados en vista web',
            'En Electron se persisten en config.json y reconectan Telnet.'
          );
        }
      } finally {
        setGuardandoAjustes(false);
      }
    },
    [aplicarConfiguracionEnMemoria, lanzarToast]
  );

  const copiarTexto = useCallback(
    async (texto: string) => {
      try {
        await navigator.clipboard.writeText(texto);
        lanzarToast('exito', 'Copiado al portapapeles', texto);
      } catch {
        lanzarToast('advertencia', 'No se pudo copiar', texto);
      }
    },
    [lanzarToast]
  );

  const abrirMenuGrupo = (e: ReactMouseEvent<HTMLElement>, idGrupo: string) => {
    e.preventDefault();
    e.stopPropagation();
    seleccionarGrupos([idGrupo]);
    setMenu({ tipo: 'grupo', x: e.clientX, y: e.clientY, idGrupo });
  };

  const abrirMenuLog = (e: ReactMouseEvent<HTMLElement>, idLog: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ tipo: 'log', x: e.clientX, y: e.clientY, idLog });
  };

  const aplicarSugerencia = (textoSugerido: string) => {
    setOrden(textoSugerido);
    setIndiceHistorial(-1);
    setSugerenciasOcultas(true);
    inputRef.current?.focus();
  };

  const manejarTecladoOrden = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void procesarFormulario();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOrden('');
      setIndiceHistorial(-1);
      setBorradorTemporal('');
      setSugerenciasOcultas(true);
      setMenu(null);
      return;
    }

    if (e.key === 'Tab' && sugerenciasActivas.length > 0) {
      e.preventDefault();
      aplicarSugerencia(sugerenciasActivas[0]);
      return;
    }

    if (e.key === 'ArrowUp' && !orden.includes('\n') && historialOrdenes.length > 0) {
      e.preventDefault();
      if (indiceHistorial === -1) {
        setBorradorTemporal(orden);
      }
      const siguienteIndice = Math.min(indiceHistorial + 1, historialOrdenes.length - 1);
      setIndiceHistorial(siguienteIndice);
      setOrden(historialOrdenes[siguienteIndice]);
      setSugerenciasOcultas(true);
      return;
    }

    if (e.key === 'ArrowDown' && !orden.includes('\n') && indiceHistorial >= 0) {
      e.preventDefault();
      const siguienteIndice = indiceHistorial - 1;
      setIndiceHistorial(siguienteIndice);
      setOrden(siguienteIndice < 0 ? borradorTemporal : historialOrdenes[siguienteIndice]);
      setSugerenciasOcultas(true);
    }
  };

  const manejarBlackout = useCallback(() => {
    if (!confirmandoBlackout) {
      setConfirmandoBlackout(true);
      if (timerBlackoutRef.current !== null) {
        window.clearTimeout(timerBlackoutRef.current);
      }
      timerBlackoutRef.current = window.setTimeout(() => {
        timerBlackoutRef.current = null;
        setConfirmandoBlackout(false);
      }, 3500);
      lanzarToast(
        'advertencia',
        'Confirmar Blackout',
        `Haz clic nuevamente para apagar todos los grupos (1 al ${catalogoGruposActual.length}).`
      );
      return;
    }

    if (timerBlackoutRef.current !== null) {
      window.clearTimeout(timerBlackoutRef.current);
      timerBlackoutRef.current = null;
    }
    setConfirmandoBlackout(false);
    void accionRapidaGrupo(`1 thru ${catalogoGruposActual.length}`, 0);
  }, [accionRapidaGrupo, catalogoGruposActual.length, confirmandoBlackout, lanzarToast]);

  const grupoEnMenu = menu?.tipo === 'grupo' ? grupos[menu.idGrupo] : undefined;
  const logEnMenu =
    menu?.tipo === 'log' ? logs.find((item) => item.id === menu.idLog) : undefined;
  const infoEstado = etiquetaEstadoConexion(estadoConexion);
  const colorRellenoSlider = colorActivoSeleccion.hex ?? '#e61e32';
  const estiloSlider = {
    '--porcentaje-slider': `${valorSlider}%`,
    '--color-relleno-slider': colorRellenoSlider,
  } as React.CSSProperties;

  return (
    <div className="lienzo" data-tema={configuracion.interfaz.tema}>
      <div className="resplandor-carmesi" aria-hidden="true" />

      <div className="contenedor">
        {/* Cabecera minimalista */}
        <header className="cabecera glass">
          <div className="marca">
            <span className="marca-punto" aria-hidden="true" />
            <h1>GrandMA2</h1>
            <span className="badge badge-sutil">Control NLP</span>
          </div>

          <div className="cabecera-derecha">
            {cargando ? (
              <span className="skeleton skeleton-badge" aria-label="Cargando estado" />
            ) : (
              <span
                className={`badge ${infoEstado.clase}`}
                role="status"
                title={`Conexión ${configuracion.conexion.host}:${configuracion.conexion.puerto}`}
              >
                <span className="indicador-estado" />
                {infoEstado.texto}
              </span>
            )}

            <button
              type="button"
              className="btn-fantasma"
              onClick={() => setModalAjustesAbierto(true)}
            >
              Ajustes
            </button>
            <button
              type="button"
              className="btn-fantasma"
              onClick={() => void sincronizar(true)}
              disabled={cargando}
            >
              Sincronizar
            </button>
            <button
              type="button"
              className={`btn-carmesi-borde${confirmandoBlackout ? ' armado' : ''}`}
              onClick={manejarBlackout}
              disabled={enviando}
              title="Doble clic rápido para ejecutar apagón general"
            >
              {confirmandoBlackout ? '¿Confirmar Blackout?' : 'Blackout'}
            </button>
          </div>
        </header>

        {/* Tira de grupos G1–G6 + Todos con monitor visual */}
        <section className="tira-grupos" aria-label="Grupos de luces">
          {cargando
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="pastilla-grupo glass" aria-hidden="true">
                  <span className="skeleton skeleton-linea" />
                </div>
              ))
            : (
                <>
                  {catalogoGruposActual.map((g) => {
                    const estado = grupos[g.id];
                    const intensidad = estado?.intensidad ?? 0;
                    const encendido = intensidad > 0;
                    const seleccionado = gruposSeleccionados.includes(g.id);
                    const colorMonitor = estado?.colorHex ?? '#e61e32';

                    return (
                      <div
                        key={g.id}
                        className={`pastilla-grupo glass${encendido ? ' encendido' : ''}${seleccionado ? ' seleccionada' : ''}`}
                        onClick={(e) => {
                          const multiseleccion = e.ctrlKey || e.metaKey;
                          seleccionarGrupos(
                            alternarSeleccionGrupo(gruposSeleccionados, g.id, multiseleccion)
                          );
                        }}
                        onDoubleClick={() => void accionRapidaGrupo(g.id, encendido ? 0 : 100)}
                        onContextMenu={(e) => abrirMenuGrupo(e, g.id)}
                        role="button"
                        tabIndex={0}
                        title="Clic: seleccionar · Ctrl+Clic: multi-selección · Doble clic o %: alternar 0% / 100%"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            seleccionarGrupos(
                              alternarSeleccionGrupo(
                                gruposSeleccionados,
                                g.id,
                                e.ctrlKey || e.metaKey
                              )
                            );
                          }
                        }}
                      >
                        <div className="pastilla-fila-superior">
                          <span className="pastilla-id">G{g.id}</span>
                          <div className="pastilla-indicadores">
                            {estado?.colorHex !== null && estado?.colorHex !== undefined && (
                              <span
                                className="pastilla-punto-color"
                                style={{ backgroundColor: estado.colorHex }}
                                title={estado.colorNombre ?? 'Color aplicado'}
                              />
                            )}
                            <button
                              type="button"
                              className={`badge badge-toggle ${encendido ? 'badge-activo' : 'badge-sutil'}`}
                              title={`Alternar ${g.nombre} entre 0% y 100%`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void accionRapidaGrupo(g.id, encendido ? 0 : 100);
                              }}
                            >
                              {intensidad}%
                            </button>
                          </div>
                        </div>

                        <span className="pastilla-nombre">{estado?.nombre ?? g.nombre}</span>

                        <span className="pastilla-monitor-pista" aria-hidden="true">
                          <span
                            className="pastilla-monitor-barra"
                            style={{
                              width: `${intensidad}%`,
                              backgroundColor: colorMonitor,
                            }}
                          />
                        </span>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className={`pastilla-grupo pastilla-todos glass${todosSeleccionados ? ' seleccionada' : ''}`}
                    onClick={() => seleccionarGrupos(catalogoGruposActual.map((g) => g.id))}
                    title={`Seleccionar todos los grupos G1–G${catalogoGruposActual.length} (Alt + 0)`}
                  >
                    <span className="pastilla-id">G1–G{catalogoGruposActual.length}</span>
                    <span className="pastilla-nombre">Todos</span>
                  </button>
                </>
              )}
        </section>

        {/* Barra contextual de control rápido a 1 clic vinculada a la selección */}
        <section className="barra-control-rapido glass" aria-label="Control rápido de selección">
          <div className="control-grupo-etiqueta">
            <span className="badge badge-activo">{resumenSeleccion.badge}</span>
            <span className="control-grupo-nombre">{resumenSeleccion.titulo}</span>
          </div>

          <div className="control-intensidades" role="group" aria-label="Niveles rápidos">
            {NIVELES_RAPIDOS.map((nivel) => {
              const nivelCoincide =
                gruposSeleccionados.length > 0 &&
                gruposSeleccionados.every((id) => grupos[id]?.intensidad === nivel);
              return (
                <button
                  key={nivel}
                  type="button"
                  className={`chip-nivel${nivelCoincide ? ' activo' : ''}`}
                  disabled={enviando}
                  onClick={() => void aplicarIntensidadSeleccion(nivel)}
                >
                  {nivel}%
                </button>
              );
            })}
          </div>

          <div className="control-slider">
            <input
              type="range"
              className="slider-carmesi"
              style={estiloSlider}
              min={0}
              max={100}
              step={1}
              value={valorSlider}
              aria-label={`Intensidad de ${resumenSeleccion.titulo}`}
              onChange={(e) => setValorSlider(Number(e.target.value))}
              onPointerUp={() => void aplicarIntensidadSeleccion(valorSlider)}
              onKeyUp={(e) => {
                if (TECLAS_SLIDER_CONFIRMACION.has(e.key)) {
                  void aplicarIntensidadSeleccion(valorSlider);
                }
              }}
            />
            <span className="slider-valor">{valorSlider}%</span>
          </div>

          <div className="control-colores-contenedor">
            <div className="control-colores" role="group" aria-label="Colores RF-05">
              {catalogoColoresActual.map((color) => {
                const colorActivo = colorActivoSeleccion.preset === color.preset;
                return (
                  <button
                    key={color.id}
                    type="button"
                    className={`punto-color-rapido${colorActivo ? ' activo' : ''}`}
                    style={{ backgroundColor: color.hex }}
                    title={`${color.nombre} (${color.preset})`}
                    aria-label={`Aplicar ${color.nombre} a ${resumenSeleccion.titulo}`}
                    disabled={enviando}
                    onClick={() => void aplicarColorSeleccion(color)}
                  />
                );
              })}
            </div>
            <span className="color-activo-etiqueta">
              {colorActivoSeleccion.nombre ?? 'Sin color'}
            </span>
            <div className="rueda-anclaje">
              <button
                ref={botonRuedaRef}
                type="button"
                className={`chip-nivel rueda-abrir${ruedaAbierta ? ' activo' : ''}`}
                aria-expanded={ruedaAbierta}
                aria-haspopup="dialog"
                aria-controls={ruedaAbierta ? 'rueda-colores-panel' : undefined}
                aria-label="Abrir selector circular de colores"
                onClick={() => setRuedaAbierta((abierta) => !abierta)}
              >
                Rueda
              </button>
              {ruedaAbierta && (
                <RuedaColores
                  ancla={botonRuedaRef.current}
                  tema={configuracion.interfaz.tema}
                  colores={catalogoColoresActual}
                  colorInicial={colorActivoSeleccion.hex}
                  gruposDestino={resumenSeleccion.titulo}
                  disponible={!enviando && gruposSeleccionados.length > 0 && (estadoConexion === 'AUTENTICADO' || estadoConexion === 'WEB')}
                  motivoNoDisponible={enviando ? 'Hay un envío en curso.' : 'Conecta y autentica MA2 para aplicar el preset.'}
                  alAplicar={aplicarColorSeleccion}
                  alCerrar={(motivo) => {
                    setRuedaAbierta(false);
                    if (motivo !== 'fuera') botonRuedaRef.current?.focus();
                  }}
                />
              )}
            </div>
          </div>
        </section>

        {/* Bloque compacto de Escenas / Cues (RF-07) */}
        <section className="barra-cues glass" aria-label="Control de escenas y cues">
          <div className="cues-identidad">
            <span className="cues-titulo">Escenas</span>
            <span className="badge badge-sutil">Exec {configuracion.executorPorDefecto}</span>
          </div>

          <div className="cues-controles">
            <button
              type="button"
              className="chip-nivel"
              disabled={enviando}
              onClick={() => void ejecutarAccionCue('anterior')}
              title={`Retroceder escena (GoBack Executor ${configuracion.executorPorDefecto})`}
            >
              ◀ Anterior
            </button>
            <button
              type="button"
              className="chip-nivel activo"
              disabled={enviando}
              onClick={() => void ejecutarAccionCue('siguiente')}
              title={`Siguiente escena (Go Executor ${configuracion.executorPorDefecto})`}
            >
              ▶ Siguiente
            </button>

            <div className="cue-salto-directo">
              <label htmlFor="cue-numero" className="texto-gris">
                Cue
              </label>
              <input
                id="cue-numero"
                type="text"
                inputMode="decimal"
                className="input-cue-compacto"
                value={cueNumeroInput}
                onChange={(e) => setCueNumeroInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void ejecutarAccionCue('ir_cue');
                  }
                }}
                placeholder="3 o 2.5"
              />
              <button
                type="button"
                className="chip-nivel"
                disabled={enviando || cueNumeroInput.trim().length === 0}
                onClick={() => void ejecutarAccionCue('ir_cue')}
              >
                Ir
              </button>
            </div>

            <button
              type="button"
              className="btn-carmesi-borde"
              disabled={enviando}
              onClick={() => void ejecutarAccionCue('detener')}
              title={`Detener secuencia (Off Executor ${configuracion.executorPorDefecto})`}
            >
              ⏹ Off
            </button>
          </div>
        </section>

        {/* Área principal de 2 columnas */}
        <main className="espacio-principal">
          {/* Columna izquierda: Orden de Iluminación + Voz offline */}
          <section className="panel glass">
            <div className="panel-titulo">
              <h2>Orden de Iluminación</h2>
              <span className="texto-gris" title="Atajos globales disponibles">
                Alt+1..6 grupo · Alt+0 todos · Ctrl+K o / enfocar
              </span>
            </div>

            <div className="campo-contenedor">
              <div className="area-texto-con-voz">
                <textarea
                  ref={inputRef}
                  value={orden}
                  onChange={(e) => {
                    setOrden(e.target.value);
                    setIndiceHistorial(-1);
                    setSugerenciasOcultas(false);
                  }}
                  onKeyDown={manejarTecladoOrden}
                  placeholder='Ej. "Frontales al 70% en azul", "Siguiente escena" o mantén Alt+Espacio para dictar'
                  maxLength={220}
                  aria-label="Instrucción de iluminación"
                />

                <div className="barra-voz">
                  <button
                    type="button"
                    className={`boton-microfono ${estadoVoz}`}
                    onPointerDown={manejarPointerDownMic}
                    onPointerUp={manejarPointerUpMic}
                    onPointerCancel={manejarPointerCancelMic}
                    onKeyDown={manejarKeyDownMic}
                    disabled={estadoVoz === 'transcribiendo'}
                    title="Clic para iniciar/detener o mantén presionado (Push-to-Talk · Alt+Espacio)"
                  >
                    <span className="mic-icono" aria-hidden="true">
                      ●
                    </span>
                    <span>
                      {estadoVoz === 'escuchando'
                        ? 'Escuchando...'
                        : estadoVoz === 'transcribiendo'
                          ? 'Transcribiendo...'
                          : 'Voz (Alt+Espacio)'}
                    </span>
                  </button>

                  {estadoVoz === 'escuchando' && (
                    <div className="medidor-voz-pista" aria-label="Nivel de micrófono">
                      <span
                        className="medidor-voz-barra"
                        style={{ width: `${nivelVoz}%` }}
                      />
                    </div>
                  )}

                  {estadoVoz === 'transcribiendo' && progresoVoz !== null && (
                    <span className="progreso-voz-texto" role="status" title={progresoVoz}>
                      {progresoVoz}
                    </span>
                  )}

                  <span className="texto-gris badge-voz-modo">
                    {configuracion.interfaz.autoEjecutarVoz
                      ? 'Voz: Auto-envío'
                      : 'Voz: Confirmar con Enter'}
                  </span>
                </div>
              </div>

              {sugerenciasActivas.length > 0 ? (
                <div className="chips-sugerencias">
                  {sugerenciasActivas.map((sugerencia, idx) => (
                    <button
                      key={sugerencia}
                      type="button"
                      className={`chip${idx === 0 ? ' chip-sugerida' : ''}`}
                      onClick={() => aplicarSugerencia(sugerencia)}
                    >
                      {idx === 0 && <span className="atajo-tab">Tab</span>}
                      <span>{sugerencia}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="chips-ejemplos">
                  {EJEMPLOS_RAPIDOS.map((ejemplo) => (
                    <button
                      key={ejemplo}
                      type="button"
                      className="chip chip-cuadricula"
                      onClick={() => aplicarSugerencia(ejemplo)}
                    >
                      {ejemplo}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="barra-inferior-consola">
              <div className="vista-previa-inline">
                {enviando ? (
                  <span className="skeleton skeleton-preview" />
                ) : interpretacion !== null ? (
                  interpretacion.exito && interpretacion.sintaxisMA2 !== null ? (
                    <>
                      <span className="badge badge-activo">{interpretacion.etiquetaAccion}</span>
                      <code>{interpretacion.sintaxisMA2}</code>
                    </>
                  ) : (
                    <span className="texto-gris">{interpretacion.mensajeError}</span>
                  )
                ) : (
                  <span className="texto-gris">Vista previa de sintaxis GrandMA2</span>
                )}
              </div>

              <div className="acciones-consola">
                {orden.length > 0 && (
                  <button
                    type="button"
                    className="btn-fantasma"
                    onClick={() => {
                      setOrden('');
                      setIndiceHistorial(-1);
                      setSugerenciasOcultas(true);
                    }}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  className="btn-carmesi"
                  onClick={() => void procesarFormulario()}
                  disabled={orden.trim().length === 0 || enviando}
                >
                  {enviando ? 'Enviando...' : 'Ejecutar'}
                </button>
              </div>
            </div>
          </section>

          {/* Columna derecha: Bitácora */}
          <section className="panel glass">
            <div className="panel-titulo">
              <h2>Actividad</h2>
              <div className="meta-derecha">
                <span className="badge badge-sutil">{logs.length}</span>
                <button
                  type="button"
                  className="btn-fantasma"
                  disabled={pilaDeshacer.length === 0 || enviando}
                  onClick={() => void ejecutarDeshacer()}
                  title={
                    pilaDeshacer.length > 0
                      ? `Deshacer: ${pilaDeshacer[0].etiqueta}`
                      : 'No hay acciones recientes para deshacer'
                  }
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  className="btn-fantasma"
                  disabled={logs.length === 0}
                  onClick={() => setLogs([])}
                  title="Vaciar lista visual de logs"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="lista-actividad" aria-live="polite">
              {cargando ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="item-actividad" aria-hidden="true">
                    <span className="skeleton skeleton-linea-ancha" />
                  </div>
                ))
              ) : logs.length === 0 ? (
                <p className="vacio">Sin comandos ejecutados todavía.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="item-actividad"
                    onContextMenu={(e) => abrirMenuLog(e, log.id)}
                  >
                    <div className="item-izquierda">
                      <span className="hora">{log.hora}</span>
                      <span className="item-titulo">{log.titulo}</span>
                    </div>

                    <div className="item-derecha">
                      {log.sintaxisMA2 !== null && (
                        <code className="codigo-pill">{log.sintaxisMA2}</code>
                      )}
                      <button
                        type="button"
                        className="btn-icono"
                        aria-label="Opciones de evento"
                        onClick={(e) => abrirMenuLog(e, log.id)}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Modal de Ajustes (no cierra con clic accidental fuera) */}
      {modalAjustesAbierto && (
        <ModalAjustes
          configuracionActual={configuracion}
          guardando={guardandoAjustes}
          alCerrar={() => setModalAjustesAbierto(false)}
          alGuardar={guardarAjustesSistema}
        />
      )}

      {/* Menú contextual */}
      {menu !== null && (
        <div
          className="menu-contextual glass"
          style={posicionarMenu(menu.x, menu.y)}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {menu.tipo === 'grupo' && grupoEnMenu !== undefined && (
            <>
              <div className="menu-encabezado">
                <span>G{grupoEnMenu.id}</span>
                <strong>{grupoEnMenu.nombre}</strong>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  void accionRapidaGrupo(grupoEnMenu.id, 100);
                }}
              >
                Encender al 100%
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  void accionRapidaGrupo(grupoEnMenu.id, 50);
                }}
              >
                Ajustar al 50%
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  void accionRapidaGrupo(grupoEnMenu.id, 0);
                }}
              >
                Apagar (0%)
              </button>
              <div className="menu-divisor" />
              {catalogoColoresActual.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    void colorRapidoGrupo(grupoEnMenu.id, color);
                  }}
                >
                  <span className="menu-color-item">
                    <span
                      className="menu-color-punto"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden="true"
                    />
                    <span>{color.nombre}</span>
                    <span className="menu-color-preset">{color.preset}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {menu.tipo === 'log' && logEnMenu !== undefined && (
            <>
              <div className="menu-encabezado">
                <span>{logEnMenu.hora}</span>
                <strong>Evento</strong>
              </div>
              {logEnMenu.comandosPayload.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const lote = logEnMenu.comandosPayload;
                    const titulo = logEnMenu.titulo;
                    const orig = logEnMenu.textoOriginal;
                    setMenu(null);
                    void despacharLoteComandos(lote, titulo, { textoOriginal: orig });
                  }}
                >
                  Reenviar comando
                </button>
              )}
              {logEnMenu.sintaxisMA2 !== null && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const s = logEnMenu.sintaxisMA2;
                    setMenu(null);
                    if (s !== null) void copiarTexto(s);
                  }}
                >
                  Copiar sintaxis MA2
                </button>
              )}
              {logEnMenu.textoOriginal !== null && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const t = logEnMenu.textoOriginal;
                    setMenu(null);
                    if (t !== null) {
                      setOrden(t);
                      setSugerenciasOcultas(true);
                      inputRef.current?.focus();
                    }
                  }}
                >
                  Editar en consola
                </button>
              )}
              <div className="menu-divisor" />
              <button
                type="button"
                role="menuitem"
                className="texto-carmesi"
                onClick={() => {
                  const id = logEnMenu.id;
                  setMenu(null);
                  setLogs((prev) => prev.filter((item) => item.id !== id));
                }}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      )}

      {/* Toasts minimalistas */}
      <aside className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast glass" role="status">
            <span className="toast-acento" />
            <div className="toast-texto">
              <strong>{t.titulo}</strong>
              <span>{t.detalle}</span>
            </div>
            <button
              type="button"
              className="btn-icono"
              aria-label="Cerrar"
              onClick={() => cerrarToast(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
