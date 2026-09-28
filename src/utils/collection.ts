/* ------------------------------------------------------------------ */
/*  Vigie — Une saga : l'ordre de ses volets, ce qui en est là          */
/* ------------------------------------------------------------------ */

import type { SeerrSearchResult } from "../api/types";

/** Du plus ancien au plus récent — l'ordre dans lequel une saga se regarde ; sans date, à la fin. */
export function sortParts(parts: readonly SeerrSearchResult[]): SeerrSearchResult[] {
  return [...parts].sort((a, b) => {
    const da = a.releaseDate ?? "";
    const db = b.releaseDate ?? "";
    if (!da || !db) return da ? -1 : db ? 1 : 0;
    return da.localeCompare(db);
  });
}

/** Les volets déjà sur le serveur, en tout ou en partie (Jellyseerr 4 ou 5). */
export function partsHere(parts: readonly SeerrSearchResult[]): number {
  return parts.filter((p) => p.mediaInfo?.status === 4 || p.mediaInfo?.status === 5).length;
}
