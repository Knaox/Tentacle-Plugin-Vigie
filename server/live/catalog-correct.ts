/* ------------------------------------------------------------------ */
/*  Vigie — Les pages de Jellyseerr relayées au hub, corrigées          */
/* ------------------------------------------------------------------ */

/*
 * Le relais (routes-proxy.ts) sert au hub les pages de Jellyseerr : listes de
 * catalogue, fiches, volets d'une saga, filmographies. Chacune porte l'état de
 * ses titres (`mediaInfo`) tel que Jellyseerr le croit ; on le corrige au
 * moment de servir (media-info.ts) — jamais dans le cache partagé, qui garde
 * la page de Jellyseerr telle quelle : une suppression se voit à la requête
 * suivante, sans attendre que le cache expire.
 */

import { correctListItem, correctMediaInfo, type MediaInfoShape } from "./media-info";

type Json = Record<string, unknown>;

const DETAIL = /^api\/v1\/(movie|tv)\/(\d+)$/;
const SIMILAR = /^api\/v1\/(movie|tv)\/\d+\/similar$/;
const DISCOVER = /^api\/v1\/discover\/(movies|tv)(\/|$)/;

/** La page porte-t-elle l'état de titres (et mérite-t-elle d'être lue plutôt que relayée telle quelle) ? */
export function carriesTitles(path: string): boolean {
  return DETAIL.test(path)
    || SIMILAR.test(path)
    || DISCOVER.test(path)
    || /^api\/v1\/discover\/trending$/.test(path)
    || /^api\/v1\/search$/.test(path)
    || /^api\/v1\/collection\/\d+$/.test(path)
    || /^api\/v1\/person\/\d+\/combined_credits$/.test(path);
}

function mapList(list: unknown, fallback?: "movie" | "tv"): { list: unknown; changed: boolean } {
  if (!Array.isArray(list)) return { list, changed: false };
  let changed = false;
  const next = list.map((item) => {
    if (!item || typeof item !== "object") return item;
    const fixed = correctListItem(item as { id?: unknown; mediaType?: unknown; mediaInfo?: MediaInfoShape }, fallback);
    if (fixed !== item) changed = true;
    return fixed;
  });
  return { list: changed ? next : list, changed };
}

/** La page corrigée — la même si rien n'y change. */
export function correctCatalog<T>(path: string, data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const page = data as unknown as Json;
  const detail = DETAIL.exec(path);
  if (detail) {
    const type = detail[1] as "movie" | "tv";
    const info = correctMediaInfo(type, Number(detail[2]), page.mediaInfo as MediaInfoShape | undefined);
    return info === page.mediaInfo ? data : ({ ...page, mediaInfo: info } as unknown as T);
  }

  const similar = SIMILAR.exec(path);
  const discover = DISCOVER.exec(path);
  const fallback = similar
    ? (similar[1] as "movie" | "tv")
    : discover ? (discover[1] === "movies" ? "movie" : "tv") : undefined;

  const out: Json = { ...page };
  let changed = false;
  for (const [field, type] of [["results", fallback], ["parts", "movie"], ["cast", undefined], ["crew", undefined]] as const) {
    const r = mapList(page[field], type);
    if (r.changed) {
      out[field] = r.list;
      changed = true;
    }
  }
  return changed ? (out as unknown as T) : data;
}
