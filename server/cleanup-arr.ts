/* ------------------------------------------------------------------ */
/*  Vigie — Ce qu'une demande supprimée fait à Sonarr et Radarr         */
/* ------------------------------------------------------------------ */

/*
 * Règle de l'administrateur (2026-10-10) : une demande supprimée ne laisse
 * plus son film ou sa série dormir « non surveillé » dans Radarr ou Sonarr —
 * c'était le désordre assuré.
 *   - Un film : retiré de Radarr. Sauf si une autre demande le veut encore
 *     (un autre compte, une redemande) : alors Radarr n'y touche pas du tout.
 *   - Des saisons : Sonarr cesse de les surveiller ; s'il n'en surveille plus
 *     AUCUNE, la série est retirée de Sonarr. S'il en reste, elle reste.
 * Les fichiers ne partent que si on l'a demandé (« supprimer aussi les
 * fichiers »). En retirant une série, son dossier ne part que si Sonarr n'y
 * a plus aucun épisode : jamais les fichiers d'une saison qu'on n'a pas
 * supprimée. Ce qui se télécharge encore est annulé d'abord.
 */

import type { CleanupJob } from "./db";
import {
  arrFetch, cancelRadarrQueue, cancelSonarrQueue, deleteSonarrSeasonFiles, getArrServerConfig,
  unmonitorSonarrSeasons, type ArrServerConfig,
} from "./arr-service";
import type { SeerrMediaState } from "./seerr-media";

/** Demandes Jellyseerr encore en vie : en attente, approuvée, terminée. */
const LIVE_REQUEST = new Set([1, 2, 5]);

export type ArrOutcome =
  /** Retiré de Radarr ou de Sonarr. */
  | "removed"
  /** Des saisons ne sont plus surveillées ; la série reste (d'autres le sont). */
  | "unmonitored"
  /** Une autre demande le veut : rien n'a bougé. */
  | "kept"
  /** Jamais ajouté à Radarr ou Sonarr (ou pas de serveur) : rien à faire. */
  | "no-target";

interface Conn {
  seerrUrl: string;
  seerrApiKey: string;
}

type Job = Pick<CleanupJob, "mediaType" | "seasons" | "deleteFiles" | "seerrRequestId">;

/** Applique la règle à la demande d'un job de suppression ; lève si Radarr ou Sonarr refuse (le job est relancé). */
export async function cleanArrForJob(config: Conn, job: Job, media: SeerrMediaState | null): Promise<ArrOutcome> {
  const arrId = media?.externalServiceId;
  if (!media || !arrId) return "no-target";
  const server = await getArrServerConfig(config.seerrUrl, config.seerrApiKey, job.mediaType === "movie" ? "radarr" : "sonarr");
  if (!server) return "no-target";
  return job.mediaType === "movie" ? cleanMovie(server, arrId, job, media) : cleanSeries(server, arrId, job);
}

async function cleanMovie(server: ArrServerConfig, movieId: number, job: Job, media: SeerrMediaState): Promise<ArrOutcome> {
  const others = media.requests.filter((r) => r.id !== job.seerrRequestId && !r.is4k && LIVE_REQUEST.has(r.status));
  if (others.length > 0) return "kept";
  await cancelRadarrQueue(server, movieId);
  if (!(await removeRadarrMovie(server, movieId, job.deleteFiles))) throw new Error("Radarr remove failed");
  return "removed";
}

async function cleanSeries(server: ArrServerConfig, seriesId: number, job: Job): Promise<ArrOutcome> {
  await cancelSonarrQueue(server, seriesId, job.seasons);
  if (!(await unmonitorSonarrSeasons(server, seriesId, job.seasons))) throw new Error("Sonarr unmonitor failed");
  if (job.deleteFiles && !(await deleteSonarrSeasonFiles(server, seriesId, job.seasons))) {
    throw new Error("Sonarr delete season files failed");
  }
  const outcome = await removeSonarrSeriesIfUnmonitored(server, seriesId, job.deleteFiles);
  if (outcome === "failed") throw new Error("Sonarr remove failed");
  return outcome === "removed" ? "removed" : "unmonitored";
}

/** Retire un film de Radarr ; ses fichiers seulement si demandé. */
export async function removeRadarrMovie(server: ArrServerConfig, movieId: number, deleteFiles: boolean): Promise<boolean> {
  try {
    const res = await arrFetch(server, `/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}&addImportExclusion=false`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`[ArrService] removeRadarrMovie #${movieId} failed:`, err);
    return false;
  }
}

/**
 * Retire une série de Sonarr s'il n'en surveille plus aucune saison. Son
 * dossier ne part qu'avec `deleteFiles` ET plus aucun épisode dedans.
 */
export async function removeSonarrSeriesIfUnmonitored(
  server: ArrServerConfig,
  seriesId: number,
  deleteFiles: boolean,
): Promise<"removed" | "kept" | "failed"> {
  try {
    const res = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (res.status === 404) return "removed";
    if (!res.ok) return "failed";
    const series = (await res.json()) as {
      seasons?: Array<{ seasonNumber: number; monitored: boolean }>;
      statistics?: { episodeFileCount?: number };
    };
    if ((series.seasons ?? []).some((s) => s.monitored)) return "kept";
    const empty = series.statistics?.episodeFileCount === 0;
    const del = await arrFetch(
      server,
      `/api/v3/series/${seriesId}?deleteFiles=${deleteFiles && empty}&addImportListExclusion=false`,
      { method: "DELETE" },
    );
    return del.ok || del.status === 404 ? "removed" : "failed";
  } catch (err) {
    console.warn(`[ArrService] removeSonarrSeriesIfUnmonitored #${seriesId} failed:`, err);
    return "failed";
  }
}
