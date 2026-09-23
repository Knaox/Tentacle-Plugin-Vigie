/* ------------------------------------------------------------------ */
/*  Vigie — Sonarr et Radarr disent où en est une demande              */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr constate l'arrivée d'un titre à son rythme : son relais de la
 * file retarde d'une minute, sa disponibilité de plusieurs. Sonarr et Radarr,
 * eux, savent — ce qui descend (la file, relue toutes les huit secondes), ce
 * qui s'importe (fichier complet, pas encore rangé), ce qui est là (le
 * fichier). Pour les demandes qui attendent encore, ce sont eux qui parlent :
 *
 *   en route → en cours d'importation → disponible
 *
 * Jellyseerr reste la source de ce que Sonarr et Radarr ignorent (validation,
 * refus, suppression) ; on n'attend plus de lui qu'il dise qu'un titre est là.
 * Un service muet ne corrige rien : Jellyseerr garde alors la parole.
 */

import type { DownloadProgress, RequestStatus, RequestsStats } from "./types";
import type { WorkerCfg } from "./seerr-unified";
import { queueSnapshot, type QueueEntry, type QueueResponse } from "./arr-queue";
import { sonarrSeriesFacts, type EpisodeFact } from "./sonarr-episodes";
import { radarrHasFile } from "./radarr-movies";
import { mapLimit } from "./concurrency";

/** Ce qui attend encore quelque chose de Sonarr ou de Radarr. */
export const IN_FLIGHT: ReadonlySet<RequestStatus> = new Set([
  "approved", "unavailable", "downloading", "partially_available",
]);

export interface InFlightRequest {
  id: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Saisons demandées ; `null` : on ne les connaît pas. */
  seasons: readonly number[] | null;
  status: RequestStatus;
}

export interface ArrVerdict {
  status: RequestStatus;
  /** Ce qui descend ou s'importe ; `null` quand rien n'est dans la file. */
  download: DownloadProgress | null;
  /** Détail par épisode, plafonné — absent quand il n'y en a qu'un. */
  downloads?: DownloadProgress[];
}

/** Ce que les fichiers disent de ce qu'on a demandé. */
export type FilesVerdict = "all" | "some" | "none";

/* Une saison complète en aligne couramment vingt-quatre (cf. download-progress.ts). */
const MAX_DETAIL = 24;
const CONCURRENCY = 4;

/** Les entrées de la file qui servent CETTE demande : son film, ou ses saisons. */
export function matchQueue(req: InFlightRequest, items: readonly QueueEntry[]): QueueEntry[] {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  return items.filter((e) => e.source === source && e.tmdbId === req.tmdbId && (
    req.mediaType === "movie" || !req.seasons?.length
    || (e.seasonNumber != null && req.seasons.includes(e.seasonNumber))
  ));
}

function entryProgress(e: QueueEntry): DownloadProgress {
  return {
    percent: e.validating ? 100 : e.percent,
    size: e.size,
    sizeLeft: e.sizeLeft,
    etaSeconds: e.validating ? null : e.etaSeconds,
    estimatedCompletionAt: null,
    status: e.validating ? "completed" : e.paused ? "paused" : e.stalled ? "warning" : "downloading",
    validating: e.validating,
    stalled: e.stalled,
    title: e.episodeTitle,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
  };
}

/**
 * Ce qui arrive pour une demande, en un résumé : la taille et le reste
 * comptés UNE fois par téléchargement (un pack de saison a une entrée par
 * épisode, toutes de la taille du pack), le plus long des délais, et
 * l'importation seulement quand plus rien ne descend.
 */
export function summarizeQueue(entries: readonly QueueEntry[]): { summary: DownloadProgress; items: DownloadProgress[] } | null {
  if (entries.length === 0) return null;
  const downloads = new Map<string, QueueEntry>();
  for (const e of entries) downloads.set(e.downloadId ?? e.id, e);

  let size = 0;
  let left = 0;
  let sized = 0;
  let eta: number | null = null;
  for (const e of downloads.values()) {
    if (e.size != null && e.sizeLeft != null) {
      size += e.size;
      left += e.sizeLeft;
      sized++;
    }
    if (!e.validating && e.etaSeconds != null && (eta === null || e.etaSeconds > eta)) eta = e.etaSeconds;
  }

  const importing = entries.every((e) => e.validating);
  const stalledCount = entries.filter((e) => e.stalled).length;
  const moving = entries.some((e) => !e.validating && !e.stalled && !e.paused);
  const single = entries.length === 1 ? entries[0] : null;
  const summary: DownloadProgress = {
    percent: importing ? 100 : sized > 0 && size > 0 ? Math.min(100, Math.max(0, ((size - left) / size) * 100)) : null,
    size: sized > 0 ? size : null,
    sizeLeft: sized > 0 ? left : null,
    etaSeconds: importing ? null : eta,
    estimatedCompletionAt: null,
    status: importing ? "completed" : moving ? "downloading" : entries.some((e) => e.paused) ? "paused" : "warning",
    validating: importing,
    // Bloquée : tout ce qui n'est pas arrivé est bloqué (même règle que Jellyseerr).
    stalled: stalledCount > 0 && entries.every((e) => e.stalled || e.validating),
    stalledCount,
    title: single?.episodeTitle ?? null,
    seasonNumber: single?.seasonNumber ?? null,
    episodeNumber: single?.episodeNumber ?? null,
  };
  const items = entries.map(entryProgress)
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .slice(0, MAX_DETAIL);
  return { summary, items };
}

/**
 * Les saisons demandées sont-elles là, d'après les fichiers de Sonarr ?
 * Chaque épisode compte, ceux à venir compris : une saison en cours de
 * diffusion est là EN PARTIE (la règle de Jellyseerr, et celle de la fiche).
 * `null` : série inconnue de Sonarr, ou saisons demandées inconnues.
 */
export function seriesFiles(seasons: readonly number[] | null, facts: ReadonlyMap<string, EpisodeFact>): FilesVerdict | null {
  if (!seasons?.length || facts.size === 0) return null;
  let total = 0;
  let here = 0;
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (!seasons.includes(season)) continue;
    total++;
    if (fact.hasFile) here++;
  }
  if (total === 0) return null;
  return here === total ? "all" : here > 0 ? "some" : "none";
}

/**
 * Le verdict de Sonarr ou Radarr sur une demande, ou `null` s'il n'a rien à
 * corriger. Dans la file : en route, ou en cours d'importation quand tout ce
 * qui la sert est complet. Hors de la file : ses fichiers disent disponible,
 * disponible en partie — ou, quand Jellyseerr la croyait en route, qu'elle
 * attend encore.
 */
export function verdictFor(req: InFlightRequest, queue: QueueResponse, files: FilesVerdict | null): ArrVerdict | null {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  if (queue.unreachable.includes(source)) return null;

  const arriving = summarizeQueue(matchQueue(req, queue.items));
  if (arriving) {
    // Déjà là en partie et le reste arrive : elle reste « en partie », la barre dit ce qui vient.
    const status = req.status === "partially_available" ? "partially_available" : "downloading";
    return { status, download: arriving.summary, downloads: arriving.items.length > 1 ? arriving.items : undefined };
  }
  if (files === "all") return { status: "available", download: null };
  if (files === "some" && req.status !== "partially_available") return { status: "partially_available", download: null };
  if (files === "none" && req.status === "downloading") return { status: "unavailable", download: null };
  return null;
}

async function filesOf(cfg: WorkerCfg, req: InFlightRequest): Promise<FilesVerdict | null> {
  if (req.mediaType === "movie") {
    const hasFile = await radarrHasFile(cfg, req.tmdbId);
    return hasFile === null ? null : hasFile ? "all" : "none";
  }
  const facts = await sonarrSeriesFacts(cfg, req.tmdbId).catch(() => null);
  return facts ? seriesFiles(req.seasons, facts) : null;
}

/**
 * Les verdicts des demandes qui attendent encore, par identifiant de ligne.
 * Une lecture de la file pour toutes ; les fichiers seulement pour ce qui
 * n'y est pas — quelques titres, gardés en cache et partagés entre comptes.
 */
export async function arrVerdicts(cfg: WorkerCfg, requests: readonly InFlightRequest[]): Promise<Map<string, ArrVerdict>> {
  const out = new Map<string, ArrVerdict>();
  const waiting = requests.filter((r) => IN_FLIGHT.has(r.status) && r.tmdbId > 0);
  if (waiting.length === 0) return out;
  const queue = await queueSnapshot(cfg).catch(() => null);
  if (!queue) return out;

  await mapLimit(waiting, CONCURRENCY, async (req) => {
    const files = matchQueue(req, queue.items).length > 0 ? null : await filesOf(cfg, req);
    const verdict = verdictFor(req, queue, files);
    if (verdict) out.set(req.id, verdict);
  });
  return out;
}

/** Des lignes, avec le statut que Sonarr et Radarr leur donnent. */
export function withArrStatus<T extends { id: string; status: RequestStatus }>(
  items: T[], verdicts: ReadonlyMap<string, ArrVerdict>,
): T[] {
  if (verdicts.size === 0) return items;
  return items.map((i) => {
    const v = verdicts.get(i.id);
    return v && v.status !== i.status ? { ...i, status: v.status } : i;
  });
}

/** Les compteurs, avec les mêmes corrections : bandeau et cartes disent la même chose. */
export function restat(
  stats: RequestsStats, items: ReadonlyArray<{ id: string; status: RequestStatus }>, verdicts: ReadonlyMap<string, ArrVerdict>,
): RequestsStats {
  if (verdicts.size === 0) return stats;
  const byStatus = { ...stats.byStatus };
  for (const i of items) {
    const v = verdicts.get(i.id);
    if (!v || v.status === i.status) continue;
    byStatus[i.status] = Math.max(0, (byStatus[i.status] ?? 0) - 1);
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }
  return { ...stats, byStatus };
}
