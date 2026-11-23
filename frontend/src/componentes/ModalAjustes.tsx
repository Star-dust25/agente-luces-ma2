import { useState } from 'react';
import type {
  ConfiguracionColorMA2,
  ConfiguracionGrupoMA2,
  ConfiguracionSistemaMA2,
  TemaInterfaz,
} from '../tipos/ipc';

interface PropiedadesModalAjustes {
  readonly configuracionActual: ConfiguracionSistemaMA2;
  readonly guardando: boolean;
  readonly alCerrar: () => void;
  readonly alGuardar: (nuevaConfig: ConfiguracionSistemaMA2) => Promise<void>;
}

type PestanaAjustes = 'conexion' | 'grupos' | 'colores';

interface GrupoEditable {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly sinonimosTexto: string;
}

interface ColorEditable {
  readonly id: string;
  readonly nombre: string;
  readonly preset: string;
  readonly hex: string;
  readonly sinonimosTexto: string;
}

function convertirTextoALista(texto: string, respaldo: readonly string[]): readonly string[] {
  const elementos = texto
    .split(',')
    .map((s) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    )
    .filter((s) => s.length > 0);
  return elementos.length > 0 ? Array.from(new Set(elementos)) : respaldo;
}

export function ModalAjustes({
  configuracionActual,
  guardando,
  alCerrar,
  alGuardar,
}: PropiedadesModalAjustes) {
  const [pestana, setPestana] = useState<PestanaAjustes>('conexion');
  const [host, setHost] = useState<string>(configuracionActual.conexion.host);
  const [puerto, setPuerto] = useState<string>(String(configuracionActual.conexion.puerto));
  const [usuario, setUsuario] = useState<string>(configuracionActual.conexion.usuario);
  const [contrasena, setContrasena] = useState<string>(configuracionActual.conexion.contrasena);
  const [executorDefecto, setExecutorDefecto] = useState<string>(
    String(configuracionActual.executorPorDefecto)
  );
  const [tema, setTema] = useState<TemaInterfaz>(configuracionActual.interfaz.tema);
  const [autoEjecutarVoz, setAutoEjecutarVoz] = useState<boolean>(
    configuracionActual.interfaz.autoEjecutarVoz
  );

  const [gruposEditables, setGruposEditables] = useState<readonly GrupoEditable[]>(() =>
    configuracionActual.grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      descripcion: g.descripcion,
      sinonimosTexto: g.sinonimos.join(', '),
    }))
  );

  const [coloresEditables, setColoresEditables] = useState<readonly ColorEditable[]>(() =>
    configuracionActual.colores.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      preset: c.preset,
      hex: c.hex,
      sinonimosTexto: c.sinonimos.join(', '),
    }))
  );

  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const actualizarGrupo = (
    id: string,
    campo: 'nombre' | 'sinonimosTexto',
    valor: string
  ) => {
    setGruposEditables((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [campo]: valor } : g))
    );
  };

  const actualizarColor = (
    id: string,
    campo: 'nombre' | 'preset' | 'hex' | 'sinonimosTexto',
    valor: string
  ) => {
    setColoresEditables((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c))
    );
  };

  const manejarGuardar = async () => {
    const puertoNum = Number(puerto.trim());
    const execNum = Number(executorDefecto.trim());

    if (host.trim().length === 0 || usuario.trim().length === 0 || contrasena.trim().length === 0) {
      setErrorValidacion('Host, usuario y contraseña no pueden estar vacíos.');
      setPestana('conexion');
      return;
    }

    if (!Number.isInteger(puertoNum) || puertoNum < 1 || puertoNum > 65535) {
      setErrorValidacion('El puerto TCP debe ser un entero entre 1 y 65535.');
      setPestana('conexion');
      return;
    }

    if (!Number.isInteger(execNum) || execNum < 1 || execNum > 999) {
      setErrorValidacion('El executor por defecto debe estar entre 1 y 999.');
      setPestana('conexion');
      return;
    }

    const gruposFinales: ConfiguracionGrupoMA2[] = [];
    for (let i = 0; i < gruposEditables.length; i += 1) {
      const g = gruposEditables[i];
      if (g.nombre.trim().length === 0) {
        setErrorValidacion(`El nombre del grupo G${g.id} no puede estar vacío.`);
        setPestana('grupos');
        return;
      }
      gruposFinales.push({
        id: g.id,
        nombre: g.nombre.trim(),
        descripcion: g.descripcion,
        sinonimos: convertirTextoALista(
          g.sinonimosTexto,
          configuracionActual.grupos[i]?.sinonimos ?? [g.nombre.toLowerCase()]
        ),
      });
    }

    const coloresFinales: ConfiguracionColorMA2[] = [];
    for (let i = 0; i < coloresEditables.length; i += 1) {
      const c = coloresEditables[i];
      const presetLimpio = c.preset.trim();
      if (c.nombre.trim().length === 0 || !/^(?:4\.)?[1-9]\d?$/.test(presetLimpio) || !/^#[0-9a-f]{6}$/i.test(c.hex.trim())) {
        setErrorValidacion(`Revisa el nombre, preset o HEX de color (${c.nombre || c.id}).`);
        setPestana('colores');
        return;
      }
      coloresFinales.push({
        id: c.id,
        nombre: c.nombre.trim(),
        preset: presetLimpio.includes('.') ? presetLimpio : `4.${presetLimpio}`,
        hex: c.hex.trim(),
        sinonimos: convertirTextoALista(
          c.sinonimosTexto,
          configuracionActual.colores[i]?.sinonimos ?? [c.id]
        ),
      });
    }

    setErrorValidacion(null);
    await alGuardar({
      conexion: {
        host: host.trim(),
        puerto: puertoNum,
        usuario: usuario.trim(),
        contrasena: contrasena.trim(),
      },
      executorPorDefecto: execNum,
      grupos: gruposFinales,
      colores: coloresFinales,
      interfaz: {
        tema,
        autoEjecutarVoz,
      },
    });
  };

  return (
    <div
      className="modal-fondo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-ajustes"
    >
      <div className="modal-caja glass">
        <div className="modal-cabecera">
          <div>
            <h2 id="titulo-modal-ajustes">Ajustes del Sistema (config.json)</h2>
            <p className="texto-gris">
              Los cambios de red reconectan Telnet y actualizan el diccionario en vivo.
            </p>
          </div>
          <button
            type="button"
            className="btn-icono"
            aria-label="Cerrar ajustes"
            onClick={alCerrar}
          >
            ×
          </button>
        </div>

        <div className="modal-pestanas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'conexion'}
            className={`pestana-btn${pestana === 'conexion' ? ' activa' : ''}`}
            onClick={() => setPestana('conexion')}
          >
            Conexión & Cabina
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'grupos'}
            className={`pestana-btn${pestana === 'grupos' ? ' activa' : ''}`}
            onClick={() => setPestana('grupos')}
          >
            Grupos (G1–G6)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'colores'}
            className={`pestana-btn${pestana === 'colores' ? ' activa' : ''}`}
            onClick={() => setPestana('colores')}
          >
            Colores (4.1–4.9)
          </button>
        </div>

        <div className="modal-contenido">
          {pestana === 'conexion' && (
            <div className="form-grid">
              <label className="campo-form">
                <span>IP / Host GrandMA2</span>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="127.0.0.1"
                />
              </label>

              <label className="campo-form">
                <span>Puerto Telnet</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={puerto}
                  onChange={(e) => setPuerto(e.target.value)}
                />
              </label>

              <label className="campo-form">
                <span>Usuario Telnet</span>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </label>

              <label className="campo-form">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
              </label>

              <label className="campo-form">
                <span>Executor por defecto (Cues)</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={executorDefecto}
                  onChange={(e) => setExecutorDefecto(e.target.value)}
                />
              </label>

              <div className="campo-form">
                <span>Tema visual</span>
                <div className="selector-tema">
                  <button
                    type="button"
                    className={`chip-nivel${tema === 'cabina' ? ' activo' : ''}`}
                    onClick={() => setTema('cabina')}
                  >
                    Modo Cabina (Oscuro)
                  </button>
                  <button
                    type="button"
                    className={`chip-nivel${tema === 'dia' ? ' activo' : ''}`}
                    onClick={() => setTema('dia')}
                  >
                    Modo Día (Gris Suave)
                  </button>
                </div>
              </div>

              <label className="campo-switch campo-ancho">
                <input
                  type="checkbox"
                  checked={autoEjecutarVoz}
                  onChange={(e) => setAutoEjecutarVoz(e.target.checked)}
                />
                <span>
                  Auto-ejecutar comandos dictados por voz (por seguridad en vivo se recomienda desactivado)
                </span>
              </label>
            </div>
          )}

          {pestana === 'grupos' && (
            <div className="lista-editable">
              {gruposEditables.map((g) => (
                <div key={g.id} className="fila-editable">
                  <span className="badge badge-activo">G{g.id}</span>
                  <input
                    type="text"
                    value={g.nombre}
                    onChange={(e) => actualizarGrupo(g.id, 'nombre', e.target.value)}
                    placeholder="Nombre visible"
                    aria-label={`Nombre visible del grupo ${g.id}`}
                  />
                  <input
                    type="text"
                    value={g.sinonimosTexto}
                    onChange={(e) => actualizarGrupo(g.id, 'sinonimosTexto', e.target.value)}
                    placeholder="Alias separados por coma"
                    aria-label={`Alias del grupo ${g.id}`}
                  />
                </div>
              ))}
            </div>
          )}

          {pestana === 'colores' && (
            <div className="lista-editable">
              {coloresEditables.map((c) => (
                <div key={c.id} className="fila-editable fila-editable-color">
                  <span
                    className="pastilla-punto-color"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    className="input-preset"
                    value={c.preset}
                    onChange={(e) => actualizarColor(c.id, 'preset', e.target.value)}
                    aria-label={`Preset de color ${c.nombre}`}
                  />
                  <input
                    type="text"
                    value={c.hex}
                    onChange={(e) => actualizarColor(c.id, 'hex', e.target.value)}
                    aria-label={`HEX del color ${c.nombre}`}
                  />
                  <input
                    type="text"
                    value={c.nombre}
                    onChange={(e) => actualizarColor(c.id, 'nombre', e.target.value)}
                    aria-label={`Nombre del color ${c.id}`}
                  />
                  <input
                    type="text"
                    value={c.sinonimosTexto}
                    onChange={(e) => actualizarColor(c.id, 'sinonimosTexto', e.target.value)}
                    aria-label={`Sinónimos del color ${c.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {errorValidacion !== null && (
          <p className="mensaje-error-modal" role="alert">
            {errorValidacion}
          </p>
        )}

        <div className="modal-pie">
          <button type="button" className="btn-fantasma" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-carmesi"
            onClick={() => void manejarGuardar()}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
