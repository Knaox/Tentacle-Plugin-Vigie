/* ------------------------------------------------------------------ */
/*  Vigie — « Tous » : films et séries dans une même grille             */
/* ------------------------------------------------------------------ */

/*
 * TMDB ne mélange pas les types dans une découverte : « Tous » alterne donc
 * deux catalogues — un film, une série, un film… — tant que les deux en ont,
 * puis finit sur le plus long. Chaque case sait d'où elle vient : l'accès
 * direct du catalogue est intact (l'ascenseur a sa vraie taille, seules les
 * pages regardées se chargent, dans chacune des deux sources).
 */

import { useCallback, useMemo } from "react";
import type { SparseCatalog } from "./useSparseCatalog";

export interface Slot {
  source: 0 | 1;
  offset: number;
}

/** La source et la position, dans sa source, de la case `index`. */
export function locate(index: number, a: number | null, b: number | null): Slot {
  const pair = (i: number): Slot => (i % 2 === 0 ? { source: 0, offset: i / 2 } : { source: 1, offset: (i - 1) / 2 });
  if (a === null || b === null) return pair(index);
  const shared = Math.min(a, b);
  if (index < 2 * shared) return pair(index);
  return { source: a > b ? 0 : 1, offset: shared + (index - 2 * shared) };
}

/** Pour les cases [from, to], la plage à charger dans chaque source (ou `null`). */
export function sourceRanges(from: number, to: number, a: number | null, b: number | null): [[number, number] | null, [number, number] | null] {
  const ranges: [[number, number] | null, [number, number] | null] = [null, null];
  for (let i = Math.max(0, from); i <= to; i++) {
    const { source, offset } = locate(i, a, b);
    const cur = ranges[source];
    ranges[source] = cur ? [Math.min(cur[0], offset), Math.max(cur[1], offset)] : [offset, offset];
  }
  return ranges;
}

/** Deux catalogues à accès direct, vus comme un seul — actif seulement pour « Tous ». */
export function useMixedCatalog(first: SparseCatalog, second: SparseCatalog, active: boolean): SparseCatalog {
  const a = first.total;
  const b = second.total;
  const { itemAt: firstAt, ensureRange: firstRange, retry: firstRetry } = first;
  const { itemAt: secondAt, ensureRange: secondRange, retry: secondRetry } = second;

  const itemAt = useCallback((index: number) => {
    const { source, offset } = locate(index, a, b);
    return source === 0 ? firstAt(offset) : secondAt(offset);
  }, [a, b, firstAt, secondAt]);

  const ensureRange = useCallback((from: number, to: number) => {
    const [ra, rb] = sourceRanges(from, to, a, b);
    if (ra) firstRange(ra[0], ra[1]);
    if (rb) secondRange(rb[0], rb[1]);
  }, [a, b, firstRange, secondRange]);

  const retry = useCallback(() => { firstRetry(); secondRetry(); }, [firstRetry, secondRetry]);

  return useMemo<SparseCatalog>(() => (active ? {
    total: a === null || b === null ? null : a + b,
    capped: first.capped || second.capped,
    version: first.version + second.version,
    itemAt,
    ensureRange,
    // Une source en panne n'éteint pas l'autre ; les deux : on le dit.
    error: first.error && second.error,
    retry,
  } : first), [active, a, b, first, second, itemAt, ensureRange, retry]);
}
