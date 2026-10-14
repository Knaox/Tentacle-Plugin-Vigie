/* ------------------------------------------------------------------ */
/*  Vigie — La place de la mini-carte                                  */
/* ------------------------------------------------------------------ */

/*
 * JUMEAU de `previewPlacement.ts` du cœur (forme « affiche ») : la
 * mini-carte fait ~23 % de la largeur de la fenêtre, entre 300 et 560 px,
 * jamais moins de 1,2 × la largeur d'une VIGNETTE moyenne du cœur (sa
 * `idealCardWidth`) — l'aperçu d'une affiche a la taille de celui d'une
 * vignette ; il restait au plancher, plus petit. Vidéo 16:9 en haut, bandeau
 * dessous, au moins aussi haute que l'affiche à couvrir. Centrée sur la carte, rentrée
 * dans la fenêtre (sous la barre d'onglets collante de Vigie), au pixel près.
 * Elle part de l'affiche — la plus grande échelle qui y tient — et grandit.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Le bas de ce qui colle en haut de la page (la mini-carte n'y passe pas dessous). */
  safeTop?: number;
}

export interface Placement extends Rect {
  videoHeight: number;
  /** La transformation de départ : translation (px) puis échelle, origine au centre. */
  from: { x: number; y: number; scale: number };
}

export const PREVIEW_MARGIN = 16;
export const PREVIEW_ASPECT = 16 / 9;
export const PREVIEW_SCREEN_SHARE = 0.23;
export const PREVIEW_MIN_GROWTH = 1.2;
export const PREVIEW_COVER_PX = 8;
export const PREVIEW_MIN_WIDTH = 300;
export const PREVIEW_MAX_WIDTH = 560;

const PANEL_STOPS: ReadonlyArray<readonly [number, number]> = [
  [288, 128],
  [400, 156],
  [560, 188],
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** La hauteur du bandeau pour une largeur (interpolée entre les paliers du cœur). */
export function panelHeight(width: number): number {
  const first = PANEL_STOPS[0];
  const last = PANEL_STOPS[PANEL_STOPS.length - 1];
  if (width <= first[0]) return first[1];
  if (width >= last[0]) return last[1];
  for (let i = 1; i < PANEL_STOPS.length; i++) {
    const [w1, h1] = PANEL_STOPS[i];
    if (width > w1) continue;
    const [w0, h0] = PANEL_STOPS[i - 1];
    return Math.round(h0 + ((width - w0) / (w1 - w0)) * (h1 - h0));
  }
  return last[1];
}

/** La vignette moyenne du cœur (`cardSizes.ts` : `EPISODE_WIDTH.md`, `EPISODE_VW`). */
const VIGNETTE = { base: 280, lg: 400, vw: 24 };

/** La largeur d'une vignette moyenne du cœur dans cette fenêtre (son `clamp` CSS). */
export function vignetteWidth(viewportWidth: number): number {
  return clamp((viewportWidth * VIGNETTE.vw) / 100, VIGNETTE.base, VIGNETTE.lg);
}

export function previewWidthFor(cardWidth: number, viewportWidth: number): number {
  const base = Math.max(cardWidth, vignetteWidth(viewportWidth));
  const wanted = Math.max(viewportWidth * PREVIEW_SCREEN_SHARE, base * PREVIEW_MIN_GROWTH);
  return clamp(wanted, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
}

export function placePreview(anchor: Rect, viewport: Viewport): Placement | null {
  if (!(anchor.width > 0) || !(anchor.height > 0)) return null;
  const minLeft = PREVIEW_MARGIN;
  const maxRight = viewport.width - PREVIEW_MARGIN;
  const minTop = Math.max(PREVIEW_MARGIN, (viewport.safeTop ?? 0) + PREVIEW_MARGIN);
  const maxBottom = viewport.height - PREVIEW_MARGIN;
  const roomWidth = maxRight - minLeft;
  const roomHeight = maxBottom - minTop;
  if (roomWidth <= 0 || roomHeight <= 0) return null;

  const wanted = previewWidthFor(anchor.width, viewport.width);
  const byHeight = (roomHeight - panelHeight(wanted)) * PREVIEW_ASPECT;
  const width = Math.round(Math.max(1, Math.min(wanted, roomWidth, byHeight)));
  const videoHeight = Math.round(width / PREVIEW_ASPECT);
  const content = videoHeight + panelHeight(width);
  const height = Math.round(Math.min(Math.max(content, anchor.height + 2 * PREVIEW_COVER_PX), roomHeight));

  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const left = Math.round(clamp(centerX - width / 2, minLeft, maxRight - width));
  const top = Math.round(clamp(centerY - height / 2, minTop, maxBottom - height));

  const scale = Math.min(anchor.width / width, anchor.height / height, 1);
  const from = { x: centerX - (left + width / 2), y: centerY - (top + height / 2), scale };
  return { left, top, width, height, videoHeight, from };
}

export function fromTransform(from: Placement["from"]): string {
  const round = (v: number) => Math.round(v * 100) / 100;
  return `translate(${round(from.x)}px, ${round(from.y)}px) scale(${Math.round(from.scale * 10000) / 10000})`;
}

/**
 * Ce que les voisines d'une rangée doivent glisser pour laisser la place à la
 * mini-carte : celles de gauche du débord gauche, celles de droite du débord
 * droit (jamais négatif).
 */
export function roomShifts(anchor: Rect, preview: Rect): { left: number; right: number } {
  return {
    left: Math.max(0, Math.round(anchor.left - preview.left)),
    right: Math.max(0, Math.round(preview.left + preview.width - (anchor.left + anchor.width))),
  };
}
