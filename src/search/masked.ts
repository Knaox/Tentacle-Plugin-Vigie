/* ------------------------------------------------------------------ */
/*  Vigie — Les résultats que le filtre de contenu masque d'ordinaire   */
/* ------------------------------------------------------------------ */

/*
 * Une recherche ne cache pas ce qu'on cherche explicitement : le serveur rend
 * les titres masqués MARQUÉS (`masked`), la carte le dit, et un seul geste les
 * retire — sans nouvelle requête, la réponse est déjà là. Découvrir et les
 * rangées, elles, ne les reçoivent jamais.
 */

import type { SeerrSearchResult } from "../api/types";
import type { VigieSearchResponse } from "../api/types-search";

const isMasked = (item: SeerrSearchResult) => item.masked === true;

/** Combien de titres masqués la réponse montre (le meilleur résultat compris, une fois). */
export function countMasked(data: VigieSearchResponse): number {
  const keys = new Set<string>();
  const add = (item: SeerrSearchResult) => { if (isMasked(item)) keys.add(`${item.mediaType}:${item.id}`); };
  data.movies.forEach(add);
  data.series.forEach(add);
  if (data.top?.kind === "media") add(data.top.item);
  return keys.size;
}

/** La même réponse, sans les titres masqués — le meilleur résultat compris. */
export function withoutMasked(data: VigieSearchResponse): VigieSearchResponse {
  return {
    ...data,
    top: data.top?.kind === "media" && isMasked(data.top.item) ? null : data.top,
    movies: data.movies.filter((m) => !isMasked(m)),
    series: data.series.filter((m) => !isMasked(m)),
  };
}
