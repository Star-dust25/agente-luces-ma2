import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CATALOGO_COLORES,
  CATALOGO_GRUPOS,
  TraductorLuces,
  type DefinicionColorMA2,
  type ResultadoInterpretacion,
} from './diccionario/TraductorLuces';
import type {
  ComandoLuces,
  EstadoConexionMA2,
  RespuestaComandoIPC,
} from './tipos/ipc';

type NivelLog = 'info' | 'exito' | 'advertencia' | 'error';

interface EstadoGrupo {
  readonly id: string;
  readonly nombre: string;
  readonly intensidad: number;
  readonly colorNombre: string | null;
}

interface RegistroLog {
  readonly id: string;
  readonly hora: string;
  readonly nivel: NivelLog;
  readonly titulo: string;
  readonly sintaxisMA2: string | null;
  readonly comandoPayload: ComandoLuces | null;
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

const EJEMPLOS_RAPIDOS = [
  'Frontales al 50%',
  'Contraluz en rojo',
  'Wash al 100%',
  'Apagar frontales',
] as const;

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

function inicializarGrupos(): Record<string, EstadoGrupo> {
  const inicial: Record<string, EstadoGrupo> = {};
  for (const g of CATALOGO_GRUPOS) {
    inicial[g.id] = {
      id: g.id,
      nombre: g.nombre,
      intensidad: 0,
      colorNombre: null,
    };
  }
  return inicial;
}

function expandirGrupos(grupo: string): readonly string[] {
  const limpio = grupo.trim().toLowerCase();
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
  return [limpio];
}

function posicionarMenu(x: number, y: number): { left: number; top: number } {
  return {
    left: Math.min(x, Math.max(16, window.innerWidth - 220)),
    top: Math.min(y, Math.max(16, window.innerHeight - 250)),
  };
}

export default function App() {
  const esElectron = typeof window !== 'undefined' && window.api !== undefined;

  const [orden, setOrden] = useState<string>('');
  const [grupos, setGrupos] = useState<Record<string, EstadoGrupo>>(inicializarGrupos);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionMA2 | 'WEB'>(
    esElectron ? 'CONECTANDO' : 'WEB'
  );
  const [cargando, setCargando] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [logs, setLogs] = useState<RegistroLog[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [menu, setMenu] = useState<MenuContextual | null>(null);

  const timersRef = useRef<Map<string, number>>(new Map());
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const interpretacion = useMemo<ResultadoInterpretacion | null>(() => {
    if (orden.trim().length === 0) {
      return null;
    }
    return TraductorLuces.interpretarOrden(orden);
  }, [orden]);

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

  const actualizarEstadoGrupoLocal = useCallback(
    (payload: ComandoLuces, color?: DefinicionColorMA2) => {
      const ids = expandirGrupos(payload.grupo);
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
    },
    []
  );

  const enviarComando = useCallback(
    async (
      payload: ComandoLuces,
      sintaxisMA2: string,
      titulo: string,
      textoOriginal: string | null = null,
      color?: DefinicionColorMA2
    ) => {
      setEnviando(true);
      try {
        if (window.api !== undefined) {
          const respuesta: RespuestaComandoIPC = await window.api.enviarComandoLuces(payload);
          setEstadoConexion(respuesta.estadoConexion);
          const comandoFinal = respuesta.comandoGenerado?.trim() ?? sintaxisMA2;

          if (respuesta.exito) {
            actualizarEstadoGrupoLocal(payload, color);
            registrarLog({
              nivel: 'exito',
              titulo,
              sintaxisMA2: comandoFinal,
              comandoPayload: payload,
              textoOriginal,
            });
            lanzarToast('exito', titulo, comandoFinal);
          } else {
            registrarLog({
              nivel: 'error',
              titulo: `Error · ${titulo}`,
              sintaxisMA2: comandoFinal,
              comandoPayload: payload,
              textoOriginal,
            });
            lanzarToast('error', 'No enviado a MA2', respuesta.mensaje);
          }
        } else {
          await new Promise<void>((r) => window.setTimeout(r, 220));
          actualizarEstadoGrupoLocal(payload, color);
          registrarLog({
            nivel: 'info',
            titulo,
            sintaxisMA2,
            comandoPayload: payload,
            textoOriginal,
          });
          lanzarToast('info', titulo, sintaxisMA2);
        }
      } finally {
        setEnviando(false);
      }
    },
    [actualizarEstadoGrupoLocal, lanzarToast, registrarLog]
  );

  const procesarFormulario = useCallback(async () => {
    const res = TraductorLuces.interpretarOrden(orden);
    if (!res.exito || res.comandoPayload === null || res.sintaxisMA2 === null) {
      const msg = res.mensajeError ?? 'No se pudo interpretar la instrucción.';
      lanzarToast('advertencia', 'Orden incompleta', msg);
      return;
    }
    await enviarComando(
      res.comandoPayload,
      res.sintaxisMA2,
      `${res.etiquetaAccion} · ${res.etiquetaGrupo}`,
      res.textoOriginal
    );
  }, [enviarComando, lanzarToast, orden]);

  const accionRapidaGrupo = useCallback(
    async (idGrupo: string, porcentaje: number) => {
      const g = grupos[idGrupo];
      const nombre = g?.nombre ?? `Grupo ${idGrupo}`;
      const accion = porcentaje === 0 ? 'apagar' : porcentaje === 100 ? 'encender' : 'ajustar';
      await enviarComando(
        { accion, grupo: idGrupo, valor: String(porcentaje), tipo: 'intensidad' },
        `Group ${idGrupo} At ${porcentaje}`,
        `${nombre} al ${porcentaje}%`,
        `${nombre} al ${porcentaje}%`
      );
    },
    [enviarComando, grupos]
  );

  const colorRapidoGrupo = useCallback(
    async (idGrupo: string, color: DefinicionColorMA2) => {
      const g = grupos[idGrupo];
      const nombre = g?.nombre ?? `Grupo ${idGrupo}`;
      await enviarComando(
        { accion: 'color', grupo: idGrupo, valor: color.preset, tipo: 'color' },
        `Group ${idGrupo} At Preset ${color.preset}`,
        `${nombre} · ${color.nombre}`,
        `Poner ${nombre.toLowerCase()} en ${color.nombre.toLowerCase()}`,
        color
      );
    },
    [enviarComando, grupos]
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
    setMenu({ tipo: 'grupo', x: e.clientX, y: e.clientY, idGrupo });
  };

  const abrirMenuLog = (e: ReactMouseEvent<HTMLElement>, idLog: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ tipo: 'log', x: e.clientX, y: e.clientY, idLog });
  };

  const manejarEnter = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void procesarFormulario();
    }
  };

  const grupoEnMenu = menu?.tipo === 'grupo' ? grupos[menu.idGrupo] : undefined;
  const logEnMenu =
    menu?.tipo === 'log' ? logs.find((item) => item.id === menu.idLog) : undefined;

  const conectado = estadoConexion === 'AUTENTICADO' || estadoConexion === 'CONECTADO';

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
              <span className={`badge ${conectado ? 'badge-activo' : 'badge-sutil'}`}>
                <span className="indicador-estado" />
                {estadoConexion === 'AUTENTICADO'
                  ? 'MA2 Conectado'
                  : estadoConexion === 'WEB'
                    ? 'Simulador Web'
                    : estadoConexion}
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
              className="btn-carmesi-borde"
              onClick={() => void accionRapidaGrupo('1 thru 6', 0)}
              disabled={enviando}
            >
              Blackout
            </button>
          </div>
        </header>

        {/* Barra limpia de grupos (Clic derecho o ⋮ para menú contextual) */}
        <section className="tira-grupos" aria-label="Grupos de luces">
          {cargando
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="pastilla-grupo glass" aria-hidden="true">
                  <span className="skeleton skeleton-linea" />
                </div>
              ))
            : CATALOGO_GRUPOS.map((g) => {
                const estado = grupos[g.id];
                const encendido = (estado?.intensidad ?? 0) > 0;
                return (
                  <div
                    key={g.id}
                    className={`pastilla-grupo glass${encendido ? ' encendido' : ''}`}
                    onClick={() => void accionRapidaGrupo(g.id, encendido ? 0 : 100)}
                    onContextMenu={(e) => abrirMenuGrupo(e, g.id)}
                    role="button"
                    tabIndex={0}
                    title="Clic para alternar · Clic derecho para opciones"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void accionRapidaGrupo(g.id, encendido ? 0 : 100);
                      }
                    }}
                  >
                    <div className="pastilla-info">
                      <span className="pastilla-id">G{g.id}</span>
                      <span className="pastilla-nombre">{g.nombre}</span>
                    </div>
                    <div className="pastilla-meta">
                      <span className={`badge ${encendido ? 'badge-activo' : 'badge-sutil'}`}>
                        {estado?.intensidad ?? 0}%
                      </span>
                      <button
                        type="button"
                        className="btn-icono"
                        aria-label={`Menú de ${g.nombre}`}
                        onClick={(e) => abrirMenuGrupo(e, g.id)}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                );
              })}
        </section>

        {/* Área principal de 2 columnas limpia */}
        <main className="espacio-principal">
          {/* Columna izquierda: Consola */}
          <section className="panel glass">
            <div className="panel-titulo">
              <h2>Orden de Iluminación</h2>
              <span className="texto-gris">Enter para ejecutar</span>
            </div>

            <div className="campo-contenedor">
              <textarea
                ref={inputRef}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                onKeyDown={manejarEnter}
                placeholder='Escribe una instrucción... ej. "Frontales al 50%" o "Contraluz en rojo"'
                maxLength={220}
                aria-label="Instrucción de iluminación"
              />

              <div className="chips-ejemplos">
                {EJEMPLOS_RAPIDOS.map((ejemplo) => (
                  <button
                    key={ejemplo}
                    type="button"
                    className="chip"
                    onClick={() => setOrden(ejemplo)}
                  >
                    {ejemplo}
                  </button>
                ))}
              </div>
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
                    onClick={() => setOrden('')}
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

          {/* Columna derecha: Bitácora limpia */}
          <section className="panel glass">
            <div className="panel-titulo">
              <h2>Actividad</h2>
              <div className="meta-derecha">
                <span className="badge badge-sutil">{logs.length}</span>
                {logs.length > 0 && (
                  <button
                    type="button"
                    className="btn-fantasma"
                    onClick={() => setLogs([])}
                  >
                    Vaciar
                  </button>
                )}
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
              {CATALOGO_COLORES.slice(0, 4).map((color) => (
                <button
                  key={color.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    void colorRapidoGrupo(grupoEnMenu.id, color);
                  }}
                >
                  Color: {color.nombre}
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
              {logEnMenu.comandoPayload !== null && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const p = logEnMenu.comandoPayload;
                    const s = logEnMenu.sintaxisMA2 ?? '';
                    setMenu(null);
                    if (p !== null) {
                      void enviarComando(p, s, logEnMenu.titulo, logEnMenu.textoOriginal);
                    }
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
