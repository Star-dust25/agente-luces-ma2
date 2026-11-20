import type { ConfiguracionColorMA2 } from '../tipos/ipc';

export interface HSV {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

export interface PuntoRueda {
  readonly x: number;
  readonly y: number;
}

const HEX_VALIDO = /^#[0-9a-f]{6}$/i;
const PRESET_VALIDO = /^(?:4\.)?[1-9]\d?$/;

export function limitarPuntoRueda(x: number, y: number): PuntoRueda {
  const radio = Math.hypot(x, y);
  return radio > 1 ? { x: x / radio, y: y / radio } : { x, y };
}

export function coordenadasClienteARueda(
  clientX: number,
  clientY: number,
  rect: Readonly<{ left: number; top: number; width: number; height: number }>
): PuntoRueda {
  return limitarPuntoRueda(
    (clientX - rect.left - rect.width / 2) / (rect.width / 2),
    (clientY - rect.top - rect.height / 2) / (rect.height / 2)
  );
}

/** x/y normalizados entre -1 y 1. Derecha = rojo, arriba = verde lima. */
export function puntoAHSV(x: number, y: number): HSV {
  const punto = limitarPuntoRueda(x, y);
  return {
    h: (Math.atan2(-punto.y, punto.x) * 180 / Math.PI + 360) % 360,
    s: Math.min(1, Math.hypot(punto.x, punto.y)),
    v: 1,
  };
}

export function hsvAHex({ h, s, v }: HSV): string {
  const c = v * s;
  const sector = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs(sector % 2 - 1));
  const [r, g, b] = sector < 1 ? [c, x, 0]
    : sector < 2 ? [x, c, 0]
    : sector < 3 ? [0, c, x]
    : sector < 4 ? [0, x, c]
    : sector < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return `#${[r, g, b].map((canal) => Math.round((canal + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function hexAHSV(hex: string): HSV | null {
  if (!HEX_VALIDO.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: h * 60, s: max === 0 ? 0 : delta / max, v: max };
}

export function puntoDesdeHex(hex: string): PuntoRueda {
  const hsv = hexAHSV(hex);
  if (hsv === null) return { x: 0, y: 0 };
  const angulo = hsv.h * Math.PI / 180;
  return { x: Math.cos(angulo) * hsv.s, y: -Math.sin(angulo) * hsv.s };
}

function hexALab(hex: string): readonly [number, number, number] {
  const rgb = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const xyz = [
    (rgb[0] * 0.4124564 + rgb[1] * 0.3575761 + rgb[2] * 0.1804375) / 0.95047,
    (rgb[0] * 0.2126729 + rgb[1] * 0.7151522 + rgb[2] * 0.0721750),
    (rgb[0] * 0.0193339 + rgb[1] * 0.1191920 + rgb[2] * 0.9503041) / 1.08883,
  ].map((c) => c > 0.008856 ? Math.cbrt(c) : 7.787 * c + 16 / 116);
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

export interface PresetCercano {
  readonly color: ConfiguracionColorMA2;
  readonly diferencia: number;
  readonly exacto: boolean;
}

/** Distancia CIE76 (ΔE) en Lab D65. Empates: menor índice de preset y luego id. */
export function buscarPresetCercano(
  hex: string,
  catalogo: readonly ConfiguracionColorMA2[]
): PresetCercano | null {
  if (!HEX_VALIDO.test(hex)) return null;
  const origen = hexALab(hex);
  let mejor: PresetCercano | null = null;
  for (const color of catalogo) {
    if (!HEX_VALIDO.test(color.hex) || !PRESET_VALIDO.test(color.preset)) continue;
    const destino = hexALab(color.hex);
    const diferencia = Math.hypot(...origen.map((c, i) => c - destino[i]));
    const candidato = { color, diferencia, exacto: hex.toLowerCase() === color.hex.toLowerCase() };
    const indice = Number(color.preset.replace('4.', ''));
    const indiceMejor = mejor === null ? Infinity : Number(mejor.color.preset.replace('4.', ''));
    if (mejor === null || diferencia < mejor.diferencia - 1e-9 ||
      (Math.abs(diferencia - mejor.diferencia) < 1e-9 &&
        (indice < indiceMejor || (indice === indiceMejor && color.id < mejor.color.id)))) {
      mejor = candidato;
    }
  }
  return mejor;
}
