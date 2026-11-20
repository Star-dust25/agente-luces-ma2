export interface Rectangulo {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface PosicionPanel {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

const MARGEN = 12;
const SEPARACION = 8;
const ANCHO_PANEL = 310;

/** Coloca el panel bajo el botón o encima si hay más espacio, siempre dentro del viewport. */
export function calcularPosicionRueda(
  ancla: Rectangulo,
  panelAlto: number,
  viewportAncho: number,
  viewportAlto: number
): PosicionPanel {
  const width = Math.max(0, Math.min(ANCHO_PANEL, viewportAncho - MARGEN * 2));
  const altoVisible = Math.min(panelAlto, Math.max(0, viewportAlto - MARGEN * 2));
  const left = Math.max(MARGEN, Math.min(ancla.right - width, viewportAncho - width - MARGEN));
  const espacioAbajo = viewportAlto - ancla.bottom - SEPARACION - MARGEN;
  const espacioArriba = ancla.top - SEPARACION - MARGEN;
  const preferirAbajo = espacioAbajo >= altoVisible || espacioAbajo >= espacioArriba;
  const deseado = preferirAbajo ? ancla.bottom + SEPARACION : ancla.top - altoVisible - SEPARACION;
  const top = Math.max(MARGEN, Math.min(deseado, viewportAlto - altoVisible - MARGEN));
  return { left, top, width };
}
