/* ------------------------------------------------------------------ */
/*  Vigie — Une demande se voit partout, tout de suite                 */
/* ------------------------------------------------------------------ */

/*
 * Un titre qu'on vient de demander apparaît dans les rangées de l'accueil, la
 * grille du catalogue, les résultats de recherche, la filmographie ouverte…
 * chacune avec sa forme de réponse. Plutôt qu'un correctif par forme, on
 * parcourt chaque réponse en cache et on pose « demandé » sur toute fiche qui
 * porte cet identifiant — sans toucher à ce qui ne change pas : les objets
 * inchangés gardent leur identité, rien d'autre ne se redessine.
 */

import type { QueryClient } from "@tanstack/react-query";

const PENDING = 2;
const MAX_DEPTH = 6;

function mark(value: unknown, tmdbId: number, mediaType: string, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const next = mark(v, tmdbId, mediaType, depth + 1);
      if (next !== v) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  const obj = value as Record<string, unknown>;
  if (obj.id === tmdbId && obj.mediaType === mediaType) {
    const info = obj.mediaInfo as { status?: number } | undefined;
    if ((info?.status ?? 0) >= PENDING) return value;
    return { ...obj, mediaInfo: { ...(info ?? {}), status: PENDING } };
  }
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const next = mark(v, tmdbId, mediaType, depth + 1);
    if (next !== v) changed = true;
    out[k] = next;
  }
  return changed ? out : value;
}

/** Les réponses de catalogue du plugin — pas les demandes elles-mêmes, ni les fiches. */
const CATALOG_KEYS = new Set([
  "vigie-rail", "vigie-search", "vigie-browse", "vigie-person-credits",
  "seer-trending", "seer-search", "seer-discover", "seer-media-similar",
]);

export function markRequestedEverywhere(qc: QueryClient, tmdbId: number, mediaType: "movie" | "tv"): void {
  qc.setQueriesData(
    { predicate: (q) => CATALOG_KEYS.has(String(q.queryKey[0])) },
    (old: unknown) => mark(old, tmdbId, mediaType),
  );
}
