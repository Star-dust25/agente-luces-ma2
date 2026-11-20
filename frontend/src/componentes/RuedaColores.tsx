import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ConfiguracionColorMA2, TemaInterfaz } from '../tipos/ipc';
import { calcularPosicionRueda, type PosicionPanel } from '../servicios/posicionRueda';
import {
  buscarPresetCercano,
  coordenadasClienteARueda,
  hexAHSV,
  hsvAHex,
  puntoAHSV,
  puntoDesdeHex,
} from '../servicios/ruedaColores';

interface PropsRuedaColores {
  readonly ancla: HTMLButtonElement | null;
  readonly tema: TemaInterfaz;
  readonly colores: readonly ConfiguracionColorMA2[];
  readonly colorInicial: string | null;
  readonly gruposDestino: string;
  readonly disponible: boolean;
  readonly motivoNoDisponible: string;
  readonly alAplicar: (color: ConfiguracionColorMA2) => Promise<boolean>;
  readonly alCerrar: (motivo: 'cancelar' | 'escape' | 'fuera' | 'aplicado') => void;
}

const TAMANO_CANVAS = 240;

function colorInicialEnRueda(hex: string | null): string {
  const hsv = hex === null ? null : hexAHSV(hex);
  return hsv === null ? '#ffffff' : hsvAHex({ ...hsv, v: 1 });
}

export function RuedaColores({
  ancla,
  tema,
  colores,
  colorInicial,
  gruposDestino,
  disponible,
  motivoNoDisponible,
  alAplicar,
  alCerrar,
}: PropsRuedaColores) {
  const [hex, setHex] = useState(() => colorInicialEnRueda(colorInicial));
  const [aplicando, setAplicando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ruedaRef = useRef<HTMLDivElement | null>(null);
  const arrastrandoRef = useRef(false);
  const focoInicialRef = useRef(false);
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);
  const cercano = useMemo(() => buscarPresetCercano(hex, colores), [hex, colores]);
  const hsv = hexAHSV(hex) ?? { h: 0, s: 0, v: 1 };
  const punto = puntoDesdeHex(hex);

  useLayoutEffect(() => {
    if (ancla === null || typeof window === 'undefined') return;
    const panel = panelRef.current;
    if (panel === null) return;
    const actualizar = () => {
      const rect = ancla.getBoundingClientRect();
      const alto = panel.getBoundingClientRect().height;
      setPosicion(calcularPosicionRueda(rect, alto, window.innerWidth, window.innerHeight));
    };
    actualizar();
    const observador = new ResizeObserver(actualizar);
    observador.observe(ancla);
    observador.observe(panel);
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    window.visualViewport?.addEventListener('resize', actualizar);
    window.visualViewport?.addEventListener('scroll', actualizar);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('scroll', actualizar, true);
      window.visualViewport?.removeEventListener('resize', actualizar);
      window.visualViewport?.removeEventListener('scroll', actualizar);
    };
  }, [ancla]);

  useEffect(() => {
    if (posicion !== null && !focoInicialRef.current) {
      ruedaRef.current?.focus();
      focoInicialRef.current = true;
    }
  }, [posicion]);

  useEffect(() => {
    const cerrarFuera = (evento: globalThis.PointerEvent) => {
      const destino = evento.target;
      if (destino instanceof Node && !panelRef.current?.contains(destino) && !ancla?.contains(destino)) {
        alCerrar('fuera');
      }
    };
    const cerrarEscape = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCerrar('escape');
      }
    };
    document.addEventListener('pointerdown', cerrarFuera, true);
    document.addEventListener('keydown', cerrarEscape, true);
    return () => {
      document.removeEventListener('pointerdown', cerrarFuera, true);
      document.removeEventListener('keydown', cerrarEscape, true);
    };
  }, [ancla, alCerrar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const contexto = canvas?.getContext('2d');
    if (!contexto) return;
    const imagen = contexto.createImageData(TAMANO_CANVAS, TAMANO_CANVAS);
    const centro = TAMANO_CANVAS / 2;
    for (let y = 0; y < TAMANO_CANVAS; y += 1) {
      for (let x = 0; x < TAMANO_CANVAS; x += 1) {
        const nx = (x + 0.5 - centro) / centro;
        const ny = (y + 0.5 - centro) / centro;
        if (Math.hypot(nx, ny) > 1) continue;
        const color = hsvAHex(puntoAHSV(nx, ny));
        const indice = (y * TAMANO_CANVAS + x) * 4;
        imagen.data[indice] = Number.parseInt(color.slice(1, 3), 16);
        imagen.data[indice + 1] = Number.parseInt(color.slice(3, 5), 16);
        imagen.data[indice + 2] = Number.parseInt(color.slice(5, 7), 16);
        imagen.data[indice + 3] = 255;
      }
    }
    contexto.putImageData(imagen, 0, 0);
  }, []);

  const seleccionarEn = (clientX: number, clientY: number) => {
    const rect = ruedaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const punto = coordenadasClienteARueda(clientX, clientY, rect);
    setHex(hsvAHex(puntoAHSV(punto.x, punto.y)));
  };

  const iniciarArrastre = (evento: PointerEvent<HTMLDivElement>) => {
    if (aplicando) return;
    arrastrandoRef.current = true;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    seleccionarEn(evento.clientX, evento.clientY);
  };

  const moverArrastre = (evento: PointerEvent<HTMLDivElement>) => {
    if (arrastrandoRef.current) seleccionarEn(evento.clientX, evento.clientY);
  };

  const terminarArrastre = (evento: PointerEvent<HTMLDivElement>) => {
    arrastrandoRef.current = false;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
  };

  const moverTeclado = (evento: KeyboardEvent<HTMLDivElement>) => {
    let nuevo = { ...hsv, v: 1 };
    switch (evento.key) {
      case 'ArrowLeft': nuevo = { ...nuevo, h: (hsv.h + 357) % 360 }; break;
      case 'ArrowRight': nuevo = { ...nuevo, h: (hsv.h + 3) % 360 }; break;
      case 'ArrowUp': nuevo = { ...nuevo, s: Math.min(1, hsv.s + 0.03) }; break;
      case 'ArrowDown': nuevo = { ...nuevo, s: Math.max(0, hsv.s - 0.03) }; break;
      case 'Home': nuevo = { ...nuevo, s: 0 }; break;
      case 'End': nuevo = { ...nuevo, s: 1 }; break;
      default: return;
    }
    evento.preventDefault();
    setHex(hsvAHex(nuevo));
  };

  const aplicar = async () => {
    if (!cercano || !disponible || aplicando) return;
    setAplicando(true);
    try {
      if (await alAplicar(cercano.color)) alCerrar('aplicado');
    } finally {
      setAplicando(false);
    }
  };

  const contenido = (
    <div
      id="rueda-colores-panel"
      ref={panelRef}
      className="rueda-panel"
      data-tema={tema}
      role="dialog"
      aria-label="Selector circular de colores"
      style={posicion === null ? { visibility: 'hidden' } : posicion}
    >
      <div className="rueda-encabezado">
        <strong>Rueda de color</strong>
        <span>{gruposDestino}</span>
      </div>
      <div
        ref={ruedaRef}
        className="rueda-superficie"
        role="slider"
        tabIndex={0}
        aria-label="Color elegido. Flechas izquierda y derecha cambian tono; arriba y abajo cambian saturación"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${hex.toUpperCase()}, tono ${Math.round(hsv.h)} grados, saturación ${Math.round(hsv.s * 100)} por ciento`}
        onPointerDown={iniciarArrastre}
        onPointerMove={moverArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
        onKeyDown={moverTeclado}
      >
        <canvas ref={canvasRef} width={TAMANO_CANVAS} height={TAMANO_CANVAS} aria-hidden="true" />
        <span
          className="rueda-indicador"
          style={{ left: `${(punto.x * 0.88 + 1) * 50}%`, top: `${(punto.y * 0.88 + 1) * 50}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="rueda-muestras">
        <div className="rueda-muestra">
          <span className="rueda-muestra-color" style={{ backgroundColor: hex }} />
          <span>Elegido <strong>{hex.toUpperCase()}</strong></span>
        </div>
        <div className="rueda-muestra">
          <span className="rueda-muestra-color" style={{ backgroundColor: cercano?.color.hex ?? 'transparent' }} />
          <span>Preset <strong>{cercano?.color.hex.toUpperCase() ?? '—'}</strong></span>
        </div>
      </div>
      <p className="rueda-datos">HSV {Math.round(hsv.h)}° · {Math.round(hsv.s * 100)}% · {Math.round(hsv.v * 100)}%</p>
      {cercano ? (
        <p className="rueda-aproximacion">
          {cercano.exacto ? 'Coincidencia exacta' : 'Aproximación'}: {cercano.color.nombre} · Preset {cercano.color.preset}
          {!cercano.exacto && <span> · diferencia ΔE76 {cercano.diferencia.toFixed(1)}</span>}
        </p>
      ) : <p className="rueda-aviso" role="status">No hay presets de color válidos configurados.</p>}
      {!disponible && <p className="rueda-aviso" role="status">{motivoNoDisponible}</p>}
      <div className="rueda-acciones">
        <button type="button" className="chip-nivel" onClick={() => alCerrar('cancelar')}>Cancelar</button>
        <button type="button" className="btn-carmesi" disabled={!cercano || !disponible || aplicando} onClick={() => void aplicar()}>
          {aplicando ? 'Enviando…' : 'Aplicar color'}
        </button>
      </div>
      <small className="rueda-nota">Se enviará el preset configurado; el color elegido es una vista previa.</small>
    </div>
  );
  return typeof document === 'undefined' ? contenido : createPortal(contenido, document.body);
}
