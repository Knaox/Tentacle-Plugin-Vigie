/* ------------------------------------------------------------------ */
/*  Vigie — Corriger ce que Jellyseerr joint à une fiche (`mediaInfo`)  */
/* ------------------------------------------------------------------ */

/*
 * Le hub lit l'état d'un titre dans ce que Jellyseerr joint à ses fiches et
 * à ses pages de catalogue (`mediaInfo` : statut, saisons, demandes, l'item
 * Jellyfin). On corrige ce `mediaInfo` au passage, avec la même règle que
 * partout ailleurs (title-truth.ts) :
 *
 *   - le statut du titre et celui de chaque saison ;
 *   - l'item Jellyfin d'un titre parti (« Regarder » mènerait nulle part) ;
 *   - un titre que Jellyfin a mais que Jellyseerr ne connaît pas encore
 *     reçoit un `mediaInfo` qui le dit là.
 *
 * Rien n'est copié quand rien ne change : les pages de catalogue partagées
 * (en cache cinq minutes) restent celles de Jellyseerr, corrigées au service.
 */

import { factsFor } from "./live-state";
import { correctMediaStatus, correctSeasonStatus, type RequestFact } from "./title-truth";

export interface MediaInfoShape {
  status?: number;
  seasons?: Array<{ seasonNumber?: number; status?: number; [k: string]: unknown }>;
  requests?: Array<{ status?: number; is4k?: boolean; createdAt?: string; seasons?: Array<{ seasonNumber?: number }> }>;
  downloadStatus?: unknown[];
  jellyfinMediaId?: string | null;
  [k: string]: unknown;
}

function requestFacts(info: MediaInfoShape | undefined): readonly RequestFact[] | undefined {
  if (!info || !Array.isArray(info.requests)) return undefined;
  return info.requests
    .filter((r) => typeof r?.status === "number")
    .map((r) => ({
      status: r.status as number,
      is4k: r.is4k === true,
      seasons: (r.seasons ?? []).map((s) => s?.seasonNumber).filter((n): n is number => typeof n === "number"),
      createdAt: typeof r.createdAt === "string" ? r.createdAt : null,
    }));
}

/**
 * Le `mediaInfo` corrigé d'un titre — le même objet s'il n'y a rien à
 * changer, `undefined` si le titre reste inconnu.
 */
export function correctMediaInfo<T extends MediaInfoShape>(
  mediaType: "movie" | "tv",
  tmdbId: number,
  info: T | undefined | null,
): T | undefined {
  const source = info ?? undefined;
  const facts = factsFor(mediaType, tmdbId, {
    requests: requestFacts(source),
    downloading: Array.isArray(source?.downloadStatus) && source.downloadStatus.length > 0,
  });
  const status = correctMediaStatus(mediaType, source?.status, facts);

  let seasons = source?.seasons;
  if (mediaType === "tv" && Array.isArray(seasons)) {
    let touched = false;
    const next = seasons.map((s) => {
      if (typeof s?.seasonNumber !== "number") return s;
      const corrected = correctSeasonStatus(s.seasonNumber, s.status, facts);
      if (corrected === s.status) return s;
      touched = true;
      return { ...s, status: corrected };
    });
    if (touched) seasons = next;
  }

  const gone = facts.library.state === "gone";
  const dropItem = gone && source?.jellyfinMediaId != null;
  if (status === source?.status && seasons === source?.seasons && !dropItem) return source;
  if (!source) return status === undefined ? undefined : ({ status } as T);
  return {
    ...source,
    status,
    ...(seasons !== source.seasons ? { seasons } : {}),
    ...(dropItem ? { jellyfinMediaId: null } : {}),
  };
}

/** Une fiche Jellyseerr (`/movie/:id`, `/tv/:id`), son `mediaInfo` corrigé — la même si rien ne change. */
export function withCorrectedInfo<T extends { mediaInfo?: MediaInfoShape | null }>(
  mediaType: "movie" | "tv",
  tmdbId: number,
  detail: T,
): T {
  const info = correctMediaInfo(mediaType, tmdbId, detail.mediaInfo ?? undefined);
  return info === detail.mediaInfo ? detail : { ...detail, mediaInfo: info };
}

/** Une fiche de catalogue (résultat, volet de saga, crédit) : son `mediaInfo` corrigé. */
export function correctListItem<T extends { id?: unknown; mediaType?: unknown; mediaInfo?: MediaInfoShape }>(
  item: T,
  fallbackType?: "movie" | "tv",
): T {
  const type = item?.mediaType === "movie" || item?.mediaType === "tv" ? item.mediaType : fallbackType;
  const id = Number(item?.id);
  if (!type || !Number.isSafeInteger(id) || id <= 0) return item;
  const info = correctMediaInfo(type, id, item.mediaInfo);
  return info === item.mediaInfo ? item : { ...item, mediaInfo: info };
}
