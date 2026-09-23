/* ------------------------------------------------------------------ */
/*  Vigie — Où en est chaque sortie : demandée, en route, là, bloquée   */
/* ------------------------------------------------------------------ */

/*
 * Cinq états — ceux qu'on se demande devant un calendrier :
 *   - disponible : le fichier est là (Sonarr `hasFile`, Jellyseerr 5) ;
 *   - en route   : dans la file de téléchargement ;
 *   - en cours d'importation : complet, Sonarr ou Radarr le range ;
 *   - bloqué     : dans la file, mais rien n'avance — JAMAIS « échec » ;
 *   - demandé    : suivi, il arrivera dès sa sortie.
 * Rien : personne ne l'a demandé.
 *
 * L'épisode LUI-MÊME, pas la saison : « la saison 4 est demandée » ne disait
 * pas si l'épisode 18, sorti hier, était arrivé. Calculé à CHAQUE réponse, sur
 * des copies — les calendriers se gardent un quart d'heure en cache, l'état
 * d'un épisode doit se voir à la minute.
 */

import type { WorkerCfg } from "./seerr-unified";
import type { RequestStatus } from "./types";
import { addDays, type CalendarItem, type CalendarResponse, type ItemState } from "./calendar-types";
import { queueSnapshot, type QueueEntry } from "./arr-queue";
import {
  episodeKey, sonarrSeriesFacts, sonarrWindowFacts, type EpisodeFact, type WindowFacts,
} from "./sonarr-episodes";
import { statusOf } from "./search/status-map";

export interface Queued {
  stalled: boolean;
  percent: number | null;
  /** Complet : Sonarr ou Radarr le range dans la bibliothèque. */
  validating: boolean;
}

export interface QueueIndex {
  /** « tmdbId:S4E18 » */
  episodes: Map<string, Queued>;
  movies: Map<number, Queued>;
}

const NO_FACTS: WindowFacts = { byEpisode: new Map(), byDay: new Map() };
const NO_QUEUE: QueueIndex = { episodes: new Map(), movies: new Map() };

/** Plusieurs entrées pour un même titre (un film réessayé) : bloqué seulement si toutes le sont. */
function merge(prev: Queued | undefined, next: QueueEntry): Queued {
  if (!prev) return { stalled: next.stalled, percent: next.percent, validating: next.validating };
  return { stalled: prev.stalled && next.stalled, percent: prev.percent ?? next.percent, validating: prev.validating && next.validating };
}

export function indexQueue(entries: readonly QueueEntry[]): QueueIndex {
  const index: QueueIndex = { episodes: new Map(), movies: new Map() };
  for (const e of entries) {
    if (e.tmdbId == null) continue;
    if (e.source === "radarr") {
      index.movies.set(e.tmdbId, merge(index.movies.get(e.tmdbId), e));
    } else if (e.seasonNumber != null && e.episodeNumber != null) {
      const key = episodeKey(e.tmdbId, e.seasonNumber, e.episodeNumber);
      index.episodes.set(key, merge(index.episodes.get(key), e));
    }
  }
  return index;
}

/* Une demande qui attend encore : le titre est demandé. */
const WAITING: ReadonlySet<RequestStatus> = new Set([
  "queued", "processing", "sent_to_seer", "approved", "unavailable", "retry_pending",
  "downloading", "partially_available",
]);

function fromQueue(q: Queued | undefined): ItemState | null {
  if (!q) return null;
  return q.stalled ? "stalled" : q.validating ? "importing" : "downloading";
}

/** Une série en partie là se dit « en partie » ; un épisode, lui, est demandé. */
function fromRequest(status: RequestStatus | null | undefined, seriesLevel = false): ItemState | null {
  if (!status || !WAITING.has(status)) return null;
  return seriesLevel && status === "partially_available" ? "partial" : "requested";
}

/** L'épisode, d'après Sonarr : son fichier, la file, son suivi. */
export function episodeState(
  fact: EpisodeFact | undefined,
  queued: Queued | undefined,
  fallback: ItemState | null,
): ItemState | null {
  if (fact?.hasFile) return "available";
  const inQueue = fromQueue(queued);
  if (inQueue) return inQueue;
  // Sonarr connaît l'épisode : son suivi fait foi — non suivi, non demandé.
  if (fact) return fact.monitored ? "requested" : null;
  return fallback;
}

/** Un film : Jellyseerr pour « là » et « demandé », la file pour ce qui arrive. */
export function movieState(
  mediaStatus: number | undefined,
  queued: Queued | undefined,
  fallback: ItemState | null,
): ItemState | null {
  if (mediaStatus === 5) return "available";
  const inQueue = fromQueue(queued);
  if (inQueue) return inQueue;
  if (mediaStatus === 2 || mediaStatus === 3) return "requested";
  return fallback;
}

/**
 * L'état d'une sortie. Une série que Sonarr ne suit pas n'a que l'état de sa
 * fiche Jellyseerr : « disponible » ne vaut alors que pour ce qui est déjà sorti.
 */
export function stateOfItem(
  item: CalendarItem,
  facts: WindowFacts,
  queue: QueueIndex,
  today: string,
): { state: ItemState | null; percent: number | null } {
  const request = fromRequest(item.requestStatus);
  if (item.mediaType === "movie") {
    const queued = queue.movies.get(item.tmdbId);
    const state = movieState(statusOf("movie", item.tmdbId), queued, request);
    return { state, percent: state === "downloading" ? queued?.percent ?? null : null };
  }

  // Sans Sonarr, une série « partielle » ne dit rien de CET épisode : seules
  // la demande et les états sans ambiguïté parlent.
  const media = statusOf("tv", item.tmdbId);
  const fallback: ItemState | null = media === 5
    ? (item.date <= today ? "available" : null)
    : media === 2 || media === 3 ? "requested" : request;
  if (item.kind !== "episode" || item.seasonNumber == null || item.episodeNumber == null) {
    // Une sortie de niveau série : une série en partie là le dit.
    const series = media === 4 ? "partial" : fallback === "requested" ? fromRequest(item.requestStatus, true) ?? fallback : fallback;
    return { state: series, percent: null };
  }

  const key = episodeKey(item.tmdbId, item.seasonNumber, item.episodeNumber);
  let fact = facts.byEpisode.get(key);
  if (!fact) {
    // Numérotations qui divergent (TMDB contre Sonarr, courant pour un animé) :
    // un seul épisode de la série ce jour-là, c'est lui.
    const sameDay = facts.byDay.get(`${item.tmdbId}:${item.date}`);
    if (sameDay?.length === 1) fact = sameDay[0];
  }
  const queued = queue.episodes.get(key);
  const state = episodeState(fact, queued, fallback);
  return { state, percent: state === "downloading" ? queued?.percent ?? null : null };
}

/**
 * Pose l'état de chaque sortie, sur des COPIES : la réponse reçue peut venir
 * d'un cache partagé. Sonarr ou la file muets : l'état se rabat sur ce que
 * Jellyseerr et les demandes en disent, jamais d'erreur pour autant.
 */
export async function attachItemStates(
  cfg: WorkerCfg,
  res: CalendarResponse,
  today: string,
): Promise<CalendarResponse> {
  if (res.items.length === 0) return res;
  const hasEpisodes = res.items.some((i) => i.kind === "episode");
  const [facts, queue] = await Promise.all([
    hasEpisodes
      // Un jour de marge : l'instant réel peut faire basculer un épisode de jour.
      ? sonarrWindowFacts(cfg, addDays(res.from, -1), addDays(res.to, 1)).catch(() => NO_FACTS)
      : Promise.resolve(NO_FACTS),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE),
  ]);
  return {
    ...res,
    items: res.items.map((item) => ({ ...item, ...stateOfItem(item, facts, queue, today) })),
  };
}

export interface SeriesEpisodeStates {
  /** Sonarr suit la série : l'état se lit épisode par épisode. */
  tracked: boolean;
  /** « S4E18 » → état ; un épisode absent n'est pas demandé. */
  states: Record<string, ItemState>;
  /** « S4E18 » → avancement, pour ceux qui sont en route. */
  percents: Record<string, number>;
  /**
   * Jour de diffusion → « S4E18 », pour les jours à un seul épisode. TMDB et
   * Sonarr ne numérotent pas toujours pareil (un animé en une saison de 66
   * épisodes chez l'un, quatre chez l'autre) : la date, elle, est commune.
   */
  dates: Record<string, string>;
  /** Les saisons de Sonarr (hors épisodes spéciaux) — pour savoir si les numérotations concordent. */
  seasons: number[];
}

/** Tous les épisodes d'une série, pour sa fiche : l'état de chacun. */
export async function seriesEpisodeStates(cfg: WorkerCfg, tmdbId: number): Promise<SeriesEpisodeStates> {
  const [facts, queue] = await Promise.all([
    sonarrSeriesFacts(cfg, tmdbId),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE),
  ]);
  const states: Record<string, ItemState> = {};
  const percents: Record<string, number> = {};
  const byDay = new Map<string, string[]>();
  const seasons = new Set<number>();
  for (const [key, fact] of facts) {
    const queued = queue.episodes.get(`${tmdbId}:${key}`);
    const state = episodeState(fact, queued, null);
    if (state) states[key] = state;
    if (state === "downloading" && queued?.percent != null) percents[key] = Math.round(queued.percent);
    if (fact.airDate) byDay.set(fact.airDate, [...(byDay.get(fact.airDate) ?? []), key]);
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (season > 0) seasons.add(season);
  }
  const dates: Record<string, string> = {};
  for (const [day, keys] of byDay) if (keys.length === 1) dates[day] = keys[0];
  return { tracked: facts.size > 0, states, percents, dates, seasons: [...seasons].sort((a, b) => a - b) };
}
