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
 *
 * Le retrait AUTOMATIQUE d'une demande consommée (titre supprimé de
 * Jellyfin, action `forget`) est plus prudent : « parti de Jellyfin » ne
 * prouve pas que les fichiers le sont (bibliothèque retirée, saisons
 * dé-surveillées après téléchargement). Un film dont Radarr a encore le
 * fichier cesse seulement d'être surveillé ; une série n'est retirée de
 * Sonarr que s'il n'y a plus aucun épisode.
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

type Job = Pick<CleanupJob, "mediaType" | "seasons" | "deleteFiles" | "seerrRequestId"> & { action?: CleanupJob["action"] };

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
  if (job.action === "forget") {
    const kept = await unmonitorRadarrMovieWithFile(server, movieId);
    if (kept === "failed") throw new Error("Radarr unmonitor failed");
    if (kept === "unmonitored") return "unmonitored";
  }
  if (!(await removeRadarrMovie(server, movieId, job.deleteFiles))) throw new Error("Radarr remove failed");
  return "removed";
}

/**
 * Radarr a-t-il encore le fichier du film ? Alors il cesse seulement de le
 * surveiller (« unmonitored »). « no-file » : rien ne le retient.
 */
async function unmonitorRadarrMovieWithFile(server: ArrServerConfig, movieId: number): Promise<"unmonitored" | "no-file" | "failed"> {
  try {
    const res = await arrFetch(server, `/api/v3/movie/${movieId}`);
    if (res.status === 404) return "no-file";
    if (!res.ok) return "failed";
    const movie = (await res.json()) as { hasFile?: boolean; monitored?: boolean };
    if (!movie.hasFile) return "no-file";
    if (movie.monitored === false) return "unmonitored";
    const put = await arrFetch(server, `/api/v3/movie/${movieId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...movie, monitored: false }),
    });
    return put.ok ? "unmonitored" : "failed";
  } catch (err) {
    console.warn(`[ArrService] unmonitorRadarrMovieWithFile #${movieId} failed:`, err);
    return "failed";
  }
}

async function cleanSeries(server: ArrServerConfig, seriesId: number, job: Job): Promise<ArrOutcome> {
  await cancelSonarrQueue(server, seriesId, job.seasons);
  if (!(await unmonitorSonarrSeasons(server, seriesId, job.seasons))) throw new Error("Sonarr unmonitor failed");
  if (job.deleteFiles && !(await deleteSonarrSeasonFiles(server, seriesId, job.seasons))) {
    throw new Error("Sonarr delete season files failed");
  }
  const outcome = await removeSonarrSeriesIfUnmonitored(server, seriesId, job.deleteFiles, job.action === "forget");
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
 * `onlyIfEmpty` : seulement s'il n'y a plus aucun épisode (retrait automatique).
 */
export async function removeSonarrSeriesIfUnmonitored(
  server: ArrServerConfig,
  seriesId: number,
  deleteFiles: boolean,
  onlyIfEmpty = false,
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
    if (onlyIfEmpty && !empty) return "kept";
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
