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
import { goneFromJellyfin, goneSeasonsOf } from "./live/live-state";
import {
  arrivalItemKey, bestCopies, entryState, titleArrival, type ArrivalState, type TitleArrivalState,
} from "./arrival/arrival-state";

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
    status: e.validating ? "completed" : e.paused ? "paused" : e.stalled ? "warning" : e.waiting ? "queued" : "downloading",
    validating: e.validating,
    stalled: e.stalled,
    title: e.episodeTitle,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
  };
}

/** L'état d'une entrée de la file (arrival/arrival-state.ts). */
export function queueEntryState(e: QueueEntry): ArrivalState {
  return entryState({ stalled: e.stalled, validating: e.validating, waiting: e.waiting });
}

const SUMMARY_STATUS: Record<TitleArrivalState, string> = {
  downloading: "downloading", importing: "completed", pending: "queued", blocked: "warning",
};

/**
 * Ce qui arrive pour une demande, en un résumé. L'état est celui de la règle
 * (arrival/arrival-state.ts) : la meilleure copie de chaque élément, puis le
 * plus parlant des éléments — jamais « bloqué » tant qu'un élément avance.
 * Taille et reste se lisent sur ces meilleures copies, UNE fois par
 * téléchargement (un pack de saison a une entrée par épisode, toutes de la
 * taille du pack) : une copie refusée à l'import ne gonfle plus l'avancement
 * de celle qui descend.
 */
export function summarizeQueue(entries: readonly QueueEntry[]): { summary: DownloadProgress; items: DownloadProgress[] } | null {
  const tagged = entries.map((entry) => ({ item: arrivalItemKey(entry.seasonNumber, entry.episodeNumber), state: queueEntryState(entry), entry }));
  const arrival = titleArrival(tagged);
  if (!arrival) return null;
  const chosen = bestCopies(tagged).map((t) => t.entry);

  const downloads = new Map<string, QueueEntry>();
  for (const e of chosen) downloads.set(e.downloadId ?? e.id, e);
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
    if (!e.validating && !e.stalled && e.etaSeconds != null && (eta === null || e.etaSeconds > eta)) eta = e.etaSeconds;
  }

  const importing = arrival.state === "importing";
  const pending = arrival.state === "pending";
  const single = chosen.length === 1 ? chosen[0] : null;
  const summary: DownloadProgress = {
    percent: importing ? 100 : sized > 0 && size > 0 ? Math.min(100, Math.max(0, ((size - left) / size) * 100)) : null,
    size: sized > 0 ? size : null,
    sizeLeft: sized > 0 ? left : null,
    etaSeconds: importing ? null : eta,
    estimatedCompletionAt: null,
    status: pending && chosen.some((e) => e.paused) ? "paused" : SUMMARY_STATUS[arrival.state],
    validating: importing,
    stalled: arrival.state === "blocked",
    stalledCount: arrival.blockedItems,
    title: single?.episodeTitle ?? null,
    seasonNumber: single?.seasonNumber ?? null,
    episodeNumber: single?.episodeNumber ?? null,
  };
  const items = chosen.map(entryProgress)
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
 * Le titre (ou une des saisons demandées) a-t-il été supprimé de Jellyfin ?
 * Radarr et Sonarr gardent un fichier pour « là » jusqu'à leur prochaine
 * relecture du disque — des heures après une suppression faite dans
 * Jellyfin : leurs fichiers ne disent alors plus « disponible ».
 */
export function deletedFromJellyfin(req: Pick<InFlightRequest, "mediaType" | "tmdbId" | "seasons">): boolean {
  if (goneFromJellyfin(req.mediaType, req.tmdbId)) return true;
  if (req.mediaType !== "tv" || !req.seasons?.length) return false;
  const gone = goneSeasonsOf(req.tmdbId);
  return req.seasons.some((s) => gone.has(s));
}

/**
 * Les verdicts des demandes qui attendent encore, par identifiant de ligne.
 * Une lecture de la file pour toutes ; les fichiers seulement pour ce qui
 * n'y est pas — quelques titres, gardés en cache et partagés entre comptes.
 */
export async function arrVerdicts(
  cfg: WorkerCfg,
  requests: readonly InFlightRequest[],
  isDeleted: (req: InFlightRequest) => boolean = deletedFromJellyfin,
): Promise<Map<string, ArrVerdict>> {
  const out = new Map<string, ArrVerdict>();
  const waiting = requests.filter((r) => IN_FLIGHT.has(r.status) && r.tmdbId > 0);
  if (waiting.length === 0) return out;
  const queue = await queueSnapshot(cfg).catch(() => null);
  if (!queue) return out;

  await mapLimit(waiting, CONCURRENCY, async (req) => {
    let files = matchQueue(req, queue.items).length > 0 ? null : await filesOf(cfg, req);
    // Supprimé de Jellyfin : un fichier que Radarr ou Sonarr croient encore là ne prouve rien.
    if ((files === "all" || files === "some") && isDeleted(req)) files = null;
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
