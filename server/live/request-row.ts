/* ------------------------------------------------------------------ */
/*  Vigie — Une demande de Jellyseerr, lue avec ce que Jellyfin a        */
/* ------------------------------------------------------------------ */

/*
 * « Mes demandes », ses compteurs et l'agenda lisent les demandes de
 * Jellyseerr ; leur statut se tire du média qu'elles portent (request-status).
 * Un film supprimé de Jellyfin y restait « Disponible » jusqu'à la synchro
 * nocturne de Jellyseerr — puis « Supprimé », rangé avec les archives, alors
 * que sa demande court toujours.
 *
 * Avant d'en tirer le statut, on corrige donc la ligne avec la règle commune
 * (title-truth.ts) — la demande elle-même compte : elle EXISTE, c'est le
 * principe d'une ligne de Jellyseerr. Un titre parti dont la demande est là
 * redevient « Demandé » (en route si quelque chose descend) ; ses saisons
 * parties ne comptent plus pour arrivées, même si Jellyseerr a terminé la
 * demande de saison.
 */

import type { RequestStatus } from "../types";
import type { SeasonStates } from "../series-gaps";
import { resolveRequestStatus, type StatusRow } from "../request-status";
import { factsFor } from "./live-state";
import { REQUEST, correctMediaStatus, correctSeasonStatus, type RequestFact, type TitleFacts } from "./title-truth";

export interface LiveRow extends StatusRow {
  is4k?: boolean;
  media?: StatusRow["media"] & { tmdbId?: number; mediaType?: "movie" | "tv" | string };
}

function factsOfRow(row: LiveRow): { facts: TitleFacts; type: "movie" | "tv" } | null {
  const type = row.media?.mediaType === "tv" ? "tv" : row.media?.mediaType === "movie" ? "movie" : null;
  const tmdbId = Number(row.media?.tmdbId);
  if (!type || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  const downloading = (row.media?.downloadStatus?.length ?? 0) > 0;
  const own: RequestFact = {
    status: row.status,
    is4k: row.is4k === true,
    seasons: (row.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number"),
  };
  const base = factsFor(type, tmdbId, { downloading });
  return { type, facts: { ...base, requests: [...(base.requests ?? []), own] } };
}

/** La ligne et l'état des saisons, corrigés ; `library` : ce que Jellyfin dit du titre. */
export function correctRequestRow<T extends LiveRow>(
  row: T,
  seasonStates?: SeasonStates,
): { row: T; seasonStates?: SeasonStates; library: "present" | "gone" | "unknown" } {
  const read = factsOfRow(row);
  if (!read) return { row, seasonStates, library: "unknown" };
  const { facts, type } = read;
  const library = facts.library.state;
  const mediaStatus = correctMediaStatus(type, row.media?.status, facts);

  let mediaSeasons = row.media?.seasons;
  let states = seasonStates;
  let requestSeasons = row.seasons;
  if (type === "tv") {
    const gone = (s: number) => library === "gone" || facts.library.goneSeasons.has(s);
    mediaSeasons = mediaSeasons?.map((s) => ({ ...s, status: correctSeasonStatus(s.seasonNumber, s.status, facts) }));
    if (states) {
      const next = new Map<number, number>();
      for (const [season, status] of states) next.set(season, correctSeasonStatus(season, status, facts) ?? status);
      states = next;
    }
    // Une saison partie n'est plus « arrivée », même si sa demande est terminée.
    requestSeasons = requestSeasons?.map((s) => (gone(s.seasonNumber) && s.status === REQUEST.COMPLETED
      ? { ...s, status: REQUEST.APPROVED }
      : s));
  }

  if (mediaStatus === row.media?.status && mediaSeasons === row.media?.seasons && requestSeasons === row.seasons && states === seasonStates) {
    return { row, seasonStates, library };
  }
  return {
    row: {
      ...row,
      seasons: requestSeasons,
      media: row.media ? { ...row.media, status: mediaStatus, seasons: mediaSeasons } : row.media,
    },
    seasonStates: states,
    library,
  };
}

/** Le statut affiché d'une demande de Jellyseerr — `resolveRequestStatus`, sur la ligne corrigée. */
export function resolveLiveStatus(
  row: LiveRow,
  local?: { status: RequestStatus } | null,
  seasonStates?: SeasonStates,
): RequestStatus {
  const fixed = correctRequestRow(row, seasonStates);
  return resolveRequestStatus(fixed.row, local, fixed.seasonStates, fixed.library);
}
