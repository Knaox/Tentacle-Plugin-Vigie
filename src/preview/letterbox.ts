/* ------------------------------------------------------------------ */
/*  Vigie — Le letterbox incrusté d'une bande-annonce                  */
/* ------------------------------------------------------------------ */

/*
 * JUMEAU de `previewLetterbox.ts` du cœur (apps/web/src/trailerPreview/),
 * recopié tel quel : la même mesure, une fois, sur la première image réduite,
 * et la même échelle prudente (rien au-delà du 2,39:1, rien dans le doute).
 * Un changement là-bas se reporte ici. `measureVideoCrop` est celui de
 * `previewFrameCrop.ts`.
 */

/** Ce qu'une image réduite donne à lire : des pixels RGBA, ligne après ligne. */
export interface FramePixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface CropGeometry {
  /** Largeur / hauteur de la source (pixels de la vidéo). */
  sourceAspect: number;
  /** Largeur / hauteur de la boîte où la vidéo est posée en `cover`. */
  boxAspect: number;
}

/** Une bande de letterbox : chaque pixel au plus à ce niveau (0-255) — un noir d'encodage, pas une nuit. */
const PURE_BLACK = 16;
/** Un pixel « sombre » : la ligne de passage entre la bande et l'image, mélangée par la réduction. */
const DARK = 24;
/** Le contenu touche les bords : au moins cette part de pixels non sombres sur ses colonnes extrêmes. */
const EDGE_CONTENT_SHARE = 0.3;
/** Jamais au-delà du 2,39:1 du cinéma. */
export const MAX_CONTENT_ASPECT = 2.4;

const level = (frame: FramePixels, x: number, y: number) => {
  const i = (y * frame.width + x) * 4;
  return Math.max(Number(frame.data[i]), Number(frame.data[i + 1]), Number(frame.data[i + 2]));
};

function rowShare(frame: FramePixels, y: number, test: (value: number) => boolean): number {
  let count = 0;
  for (let x = 0; x < frame.width; x++) if (test(level(frame, x, y))) count++;
  return count / frame.width;
}

const pureBlack = (frame: FramePixels, y: number) => rowShare(frame, y, (v) => v <= PURE_BLACK) === 1;

function rowMean(frame: FramePixels, y: number): number {
  let sum = 0;
  for (let x = 0; x < frame.width; x++) sum += level(frame, x, y);
  return sum / frame.width;
}

/**
 * La part NOIRE de la ligne de passage (0 à 1) : la réduction y a mélangé la
 * fin de la bande et le début de l'image. Lue contre les deux lignes d'image
 * qui suivent ; une image trop sombre ne dit rien (0).
 */
function passageShare(frame: FramePixels, y: number, inward: 1 | -1): number {
  const inner = (rowMean(frame, y + inward) + rowMean(frame, y + 2 * inward)) / 2;
  if (inner < 2 * DARK) return 0;
  return Math.min(1, Math.max(0, 1 - rowMean(frame, y) / inner));
}

/** Le contenu atteint-il les bords gauche et droit de la ligne `y` (un logo sur fond noir, non) ? */
function reachesEdges(frame: FramePixels, y: number): boolean {
  const band = Math.max(1, Math.round(frame.width / 10));
  let left = 0;
  let right = 0;
  for (let x = 0; x < band; x++) {
    if (level(frame, x, y) > DARK) left++;
    if (level(frame, frame.width - 1 - x, y) > DARK) right++;
  }
  return left / band >= EDGE_CONTENT_SHARE && right / band >= EDGE_CONTENT_SHARE;
}

/**
 * La part de la hauteur de la source que l'image occupe vraiment (1 : pas de
 * bandes), ou `null` si la mesure n'est pas sûre.
 */
export function letterboxContentShare(frame: FramePixels): number | null {
  const { height } = frame;
  if (frame.width < 8 || height < 16 || frame.data.length < frame.width * height * 4) return null;
  let top = 0;
  while (top < height && pureBlack(frame, top)) top++;
  let bottom = 0;
  while (bottom < height && pureBlack(frame, height - 1 - bottom)) bottom++;
  if (top === 0 && bottom === 0) return 1;
  // Une bande d'un seul côté, ou presque toute l'image noire : une scène sombre, un fondu, pas un letterbox.
  if (top === 0 || bottom === 0 || top + bottom + 6 >= height) return null;
  // Au pixel près : la ligne de passage compte pour sa part noire.
  const topBars = top + passageShare(frame, top, 1);
  const bottomBars = bottom + passageShare(frame, height - 1 - bottom, -1);
  // Deux bandes inégales : une scène sombre d'un côté, pas un letterbox.
  if (Math.abs(topBars - bottomBars) > 1.5) return null;
  // Le contenu doit toucher les deux bords sur une bonne part de ses lignes (un logo sur fond noir, non).
  const first = top + 1;
  const last = height - 2 - bottom;
  let reaching = 0;
  for (let y = first; y <= last; y++) if (reachesEdges(frame, y)) reaching++;
  if (last < first || reaching / (last - first + 1) < EDGE_CONTENT_SHARE) return null;
  return (height - 2 * Math.min(topBars, bottomBars)) / height;
}

/**
 * L'échelle à poser sur la vidéo (≥ 1) pour que son image utile couvre la
 * boîte, comme `cover` le ferait d'une source sans bandes ; 1 si rien n'est
 * sûr. Bornée au 2,39:1.
 */
export function letterboxCropScale(frame: FramePixels, geometry: CropGeometry): number {
  const share = letterboxContentShare(frame);
  const { sourceAspect, boxAspect } = geometry;
  if (share === null || share >= 1 || !(sourceAspect > 0) || !(boxAspect > 0)) return 1;
  // Au plus 2,39:1 d'image utile : au-delà, on garde des bandes plutôt que de couper l'image.
  const kept = Math.max(share, sourceAspect / MAX_CONTENT_ASPECT);
  // `cover` affiche déjà la source plus haute que la boîte quand elle est plus étroite (une 4:3).
  const coverOverflow = Math.max(boxAspect / sourceAspect, 1);
  const scale = 1 / (kept * coverOverflow);
  return Math.max(1, Math.round(scale * 1000) / 1000);
}

const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 144;

/** L'échelle qui rogne la première image décodée de `video` ; 1 si rien n'est lisible (canevas taché, sans dimensions). */
export function measureVideoCrop(video: HTMLVideoElement): number {
  try {
    if (!video.videoWidth || !video.videoHeight) return 1;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return 1;
    context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const boxAspect = video.clientWidth > 0 && video.clientHeight > 0 ? video.clientWidth / video.clientHeight : 16 / 9;
    return letterboxCropScale(
      { data, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT },
      { sourceAspect: video.videoWidth / video.videoHeight, boxAspect },
    );
  } catch {
    return 1;
  }
}
