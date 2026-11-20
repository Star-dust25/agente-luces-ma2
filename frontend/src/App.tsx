import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CATALOGO_COLORES,
  CATALOGO_GRUPOS,
  TraductorLuces,
  type DefinicionColorMA2,
  type ResultadoInterpretacion,
} from './diccionario/TraductorLuces';
import { bloqueoDeSeguridadCompuesto } from './seguridadComandos';
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
  EstadoConexionMA2,
  RespuestaComandoIPC,
} from './tipos/ipc';

type NivelLog = 'info' | 'exito' | 'advertencia' | 'error';

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

const EJEMPLOS_RAPIDOS = [
  'Frontales al 70% en azul',
  'Frontales al 100% y contras apagadas',
  'Contraluz en rojo',
  'Apagar frontales',
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

function inicializarGrupos(): Record<string, InstantaneaGrupo> {
  const inicial: Record<string, InstantaneaGrupo> = {};
  for (const g of CATALOGO_GRUPOS) {
    inicial[g.id] = {
      id: g.id,
      nombre: g.nombre,
      intensidad: 0,
      colorNombre: null,
      colorHex: null,
      colorPreset: null,
    };
  }
  return inicial;
}

function posicionarMenu(x: number, y: number): { left: number; top: number } {
  return {
    left: Math.min(x, Math.max(16, window.innerWidth - 224)),
    top: Math.min(y, Math.max(16, window.innerHeight - 410)),
  };
}

function construirSintaxisDesdePayload(payload: ComandoLuces): string {
  if (payload.tipo === 'color') {
    const preset = payload.valor.includes('.') ? payload.valor : `4.${payload.valor}`;
    return `Group ${payload.grupo} At Preset ${preset}`;
  }
  const nivel = payload.accion === 'apagar' ? '0' : payload.valor;
  return `Group ${payload.grupo} At ${nivel}`;
}

export default function App() {
  const esElectron = typeof window !== 'undefined' && window.api !== undefined;

  const [orden, setOrden] = useState<string>('');
  const [grupos, setGrupos] = useState<Record<string, InstantaneaGrupo>>(inicializarGrupos);
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

  const gruposRef = useRef<Record<string, InstantaneaGrupo>>(grupos);
  gruposRef.current = grupos;

  const timersRef = useRef<Map<string, number>>(new Map());
  const timerBlackoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const enviandoRef = useRef(false);
  const ultimoIntentoRef = useRef<{ clave: string; instante: number } | null>(null);

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
  }, [orden]);

  const sugerenciasActivas = useMemo<readonly string[]>(() => {
    if (sugerenciasOcultas || orden.trim().length === 0) {
      return [];
    }
    return TraductorLuces.generarSugerencias(orden, 3);
  }, [orden, sugerenciasOcultas]);

  const resumenSeleccion = useMemo(
    () => formatearResumenSeleccion(gruposSeleccionados, CATALOGO_GRUPOS),
    [gruposSeleccionados]
  );

  const todosSeleccionados = useMemo(
    () => esSeleccionCompleta(gruposSeleccionados, CATALOGO_GRUPOS.length),
    [gruposSeleccionados]
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
    }, 3600);
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
          const [estado] = await Promise.all([
            window.api.obtenerEstadoConexion(),
            new Promise<void>((r) => window.setTimeout(r, 380)),
          ]);
          setEstadoConexion(estado);
          if (notificar) {
            lanzarToast('exito', 'Consola sincronizada', `Estado Telnet: ${estado}`);
          }
        } else {
          await new Promise<void>((r) => window.setTimeout(r, 380));
          setEstadoConexion('WEB');
          if (notificar) {
            lanzarToast('info', 'Modo Simulador Web', 'Ejecuta Electron para conexión TCP real.');
          }
        }
      } finally {
        setCargando(false);
      }
    },
    [lanzarToast]
  );

  useEffect(() => {
    void sincronizar(false);
    if (window.api === undefined) {
      return undefined;
    }
    return window.api.suscribirEstadoConexion((nuevoEstado) => {
      setEstadoConexion(nuevoEstado);
    });
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

  // Atajos globales de teclado para cabina en vivo (sin interferir al escribir)
  useEffect(() => {
    const manejarAtajosGlobales = (evento: KeyboardEvent) => {
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
          seleccionarGrupos(CATALOGO_GRUPOS.map((g) => g.id));
        }
      }
    };

    window.addEventListener('keydown', manejarAtajosGlobales);
    return () => {
      window.removeEventListener('keydown', manejarAtajosGlobales);
    };
  }, [seleccionarGrupos]);

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
    };
  }, []);

  const actualizarEstadoGrupoLocal = useCallback(
    (payload: ComandoLuces, color?: DefinicionColorMA2) => {
      const ids = expandirIdsGrupo(payload.grupo);
      setGrupos((prev) => {
        const copia = { ...prev };
        for (const id of ids) {
          const actual = copia[id];
          if (actual === undefined) continue;
          if (payload.tipo === 'color') {
            const c = color ?? CATALOGO_COLORES.find((item) => item.preset === payload.valor);
            copia[id] = {
              ...actual,
              intensidad: actual.intensidad === 0 ? 100 : actual.intensidad,
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
        ahora - ultimoIntentoRef.current.instante < 500
      ) {
        return false;
      }

      const instantaneaPrevia = registrarDeshacer
        ? capturarInstantaneaAfectados(gruposRef.current, comandos)
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
            const respuesta: RespuestaComandoIPC = await window.api.enviarComandoLuces(payload);
            setEstadoConexion(respuesta.estadoConexion);
            const comandoFinal = respuesta.comandoGenerado?.trim() ?? sintaxisEsperada;

            if (respuesta.exito) {
              actualizarEstadoGrupoLocal(payload, colorOpcional);
              sintaxisEnviadas.push(comandoFinal);
              registrarLog({
                nivel: 'exito',
                titulo: etiquetaPaso,
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

        if (!falloEnvio && sintaxisEnviadas.length > 0) {
          if (registrarDeshacer && instantaneaPrevia.length > 0) {
            setPilaDeshacer((prev) =>
              registrarPasoDeshacer(prev, {
                id: crearId('undo'),
                etiqueta: tituloLote,
                estadosPrevios: instantaneaPrevia,
              })
            );
          }

          const resumen = sintaxisEnviadas.join(' · ');
          if (window.api !== undefined) {
            lanzarToast('exito', tituloLote, resumen);
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

  const procesarFormulario = useCallback(async () => {
    const res = interpretacion ?? TraductorLuces.interpretarOrden(orden);
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
  }, [despacharLoteComandos, interpretacion, lanzarToast, orden]);

  const accionRapidaGrupo = useCallback(
    async (idGrupo: string, porcentaje: number) => {
      const g = grupos[idGrupo];
      const nombre = g?.nombre ?? `Grupo ${idGrupo}`;
      const accion = porcentaje === 0 ? 'apagar' : porcentaje === 100 ? 'encender' : 'ajustar';

      if (idGrupo !== '1 thru 6' && gruposSeleccionados.length === 1 && gruposSeleccionados[0] === idGrupo) {
        setValorSlider(porcentaje);
      }

      await despacharLoteComandos(
        [{ accion, grupo: idGrupo, valor: String(porcentaje), tipo: 'intensidad' }],
        `${nombre} al ${porcentaje}%`,
        { textoOriginal: `${nombre} al ${porcentaje}%` }
      );
    },
    [despacharLoteComandos, grupos, gruposSeleccionados]
  );

  const aplicarIntensidadSeleccion = useCallback(
    async (porcentaje: number) => {
      const comandos = construirComandosIntensidadSeleccion(
        gruposSeleccionados,
        porcentaje,
        CATALOGO_GRUPOS.length
      );
      setValorSlider(porcentaje);
      await despacharLoteComandos(comandos, `${resumenSeleccion.titulo} al ${porcentaje}%`, {
        textoOriginal: `${resumenSeleccion.titulo} al ${porcentaje}%`,
      });
    },
    [despacharLoteComandos, gruposSeleccionados, resumenSeleccion.titulo]
  );

  const aplicarColorSeleccion = useCallback(
    async (color: DefinicionColorMA2) => {
      const comandos = construirComandosColorSeleccion(
        gruposSeleccionados,
        color.preset,
        CATALOGO_GRUPOS.length
      );
      await despacharLoteComandos(comandos, `${resumenSeleccion.titulo} · ${color.nombre}`, {
        textoOriginal: `Poner ${resumenSeleccion.titulo.toLowerCase()} en ${color.nombre.toLowerCase()}`,
        colorOpcional: color,
      });
    },
    [despacharLoteComandos, gruposSeleccionados, resumenSeleccion.titulo]
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
        'Haz clic nuevamente para apagar todos los grupos (1 al 6).'
      );
      return;
    }

    if (timerBlackoutRef.current !== null) {
      window.clearTimeout(timerBlackoutRef.current);
      timerBlackoutRef.current = null;
    }
    setConfirmandoBlackout(false);
    void accionRapidaGrupo('1 thru 6', 0);
  }, [accionRapidaGrupo, confirmandoBlackout, lanzarToast]);

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
    <div className="lienzo">
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
                title="Estado en vivo de la sesión TCP/Telnet con GrandMA2"
              >
                <span className="indicador-estado" />
                {infoEstado.texto}
              </span>
            )}

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
              title="Doble clic rápido para ejecutar apagón general (grupos 1 al 6)"
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
                  {CATALOGO_GRUPOS.map((g) => {
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

                        <span className="pastilla-nombre">{g.nombre}</span>

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
                    onClick={() => seleccionarGrupos(CATALOGO_GRUPOS.map((g) => g.id))}
                    title="Seleccionar todos los grupos G1–G6 (Alt + 0)"
                  >
                    <span className="pastilla-id">G1–G6</span>
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
              {CATALOGO_COLORES.map((color) => {
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
          </div>
        </section>

        {/* Área principal de 2 columnas */}
        <main className="espacio-principal">
          {/* Columna izquierda: Orden de Iluminación */}
          <section className="panel glass">
            <div className="panel-titulo">
              <h2>Orden de Iluminación</h2>
              <span className="texto-gris" title="Atajos globales disponibles">
                Alt+1..6 grupo · Alt+0 todos · Ctrl+K / / enfocar
              </span>
            </div>

            <div className="campo-contenedor">
              <textarea
                ref={inputRef}
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value);
                  setIndiceHistorial(-1);
                  setSugerenciasOcultas(false);
                }}
                onKeyDown={manejarTecladoOrden}
                placeholder='Ej. "Frontales al 70% en azul" o "Frontales al 100% y contras apagadas"'
                maxLength={220}
                aria-label="Instrucción de iluminación"
              />

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
              {CATALOGO_COLORES.map((color) => (
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
