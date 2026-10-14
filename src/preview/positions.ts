/* ------------------------------------------------------------------ */
/*  Vigie — La position d'un aperçu, pour le retour sur la carte       */
/* ------------------------------------------------------------------ */

/*
 * JUMEAU de `previewPositions.ts` du cœur : quitter une affiche puis y revenir
 * reprend la bande-annonce où on l'avait laissée, au lieu de la relancer
 * depuis son début. La clé est le chemin du flux SANS son jeton (la vidéo,
 * jamais le titre) ; une position vaut dix minutes ; une bande-annonce finie,
 * ou quittée à deux secondes de sa fin, repart du début.
 */

const RESUME_TTL_MS = 10 * 60 * 1000;
const MAX_POSITIONS = 200;
const END_MARGIN_S = 2;

const positions = new Map<string, { at: number; until: number }>();

export const streamKey = (src: string) => src.split("?")[0];

export function resumePositionFor(src: string, now = Date.now()): number | null {
  const key = streamKey(src);
  const known = positions.get(key);
  if (!known) return null;
  if (known.until <= now) {
    positions.delete(key);
    return null;
  }
  return known.at;
}

export function rememberPosition(src: string, at: number, duration: number, now = Date.now()): void {
  const key = streamKey(src);
  if (!(at > 0) || (Number.isFinite(duration) && duration > 0 && at >= duration - END_MARGIN_S)) {
    positions.delete(key);
    return;
  }
  if (positions.size >= MAX_POSITIONS && !positions.has(key)) positions.clear();
  positions.set(key, { at, until: now + RESUME_TTL_MS });
}

export function forgetPosition(src: string): void {
  positions.delete(streamKey(src));
}

export function clearPositions(): void {
  positions.clear();
}
