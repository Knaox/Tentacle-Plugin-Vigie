/* ------------------------------------------------------------------ */
/*  Seer Plugin — L'heure réelle de diffusion, d'après Sonarr          */
/* ------------------------------------------------------------------ */

/*
 * TMDB ne donne QUE la date d'un épisode — jamais l'heure. Vérifié : les
 * fiches renvoyées par Jellyseerr portent `airDate: '2018-04-10'` et rien de
 * plus. Sonarr, lui, connaît `airDateUtc`, l'instant exact.
 *
 * L'écart ne se limite pas à l'heure. Sur le calendrier réel de l'instance,
 * `airDate` et `airDateUtc` tombent souvent des jours DIFFÉRENTS : un épisode
 * annoncé le 14 août sort en fait le 13 à 17 h 15 à Paris, parce que la date
 * de Sonarr est celle du fuseau de la chaîne d'origine. Pour un anime japonais,
 * la date affichée jusqu'ici avait donc un jour de retard.
 *
 * Deux garde-fous :
 *   - Sonarr ne connaît que les séries qu'il suit. Pour les autres, on renvoie
 *     simplement la date, sans jamais inventer d'heure.
 *   - le JOUR local se calcule côté CLIENT : le serveur ignore le fuseau du
 *     navigateur, et le recalculer ici produirait un cache faux pour la moitié
 *     des utilisateurs. On transporte l'instant, le client l'affiche.
 */

import type { WorkerCfg } from "./seerr-unified";
import type { CalendarResponse } from "./calendar-types";
import { buildArrUrl, getArrServerConfig, type ArrServerConfig } from "./arr-service";
import { cached, put } from "./cache";

/** L'index des séries ne bouge qu'à l'ajout d'une série. */
const SERIES_TTL_MS = 30 * 60_000;
const SERIES_STALE_MS = 6 * 3_600_000;
/** Le calendrier bouge quand un épisode est reprogrammé — rare, mais réel. */
const CALENDAR_TTL_MS = 30 * 60_000;
const CALENDAR_STALE_MS = 6 * 3_600_000;
const EPISODES_TTL_MS = 3_600_000;
const EPISODES_STALE_MS = 12 * 3_600_000;

interface SonarrSeries {
  id?: number;
  tmdbId?: number;
}

interface SonarrEpisode {
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  airDateUtc?: string;
  /** Jour « chaîne d'origine » (YYYY-MM-DD) — cohérent avec les dates TMDB. */
  airDate?: string;
}

/** Un épisode du calendrier Sonarr, rattaché à sa série TMDB. */
export interface SonarrWindowEpisode {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  airDateUtc: string;
  airDate: string | null;
}

/** « S1E2 » — la clé que le client utilisera pour retrouver son épisode. */
export function airTimeKey(season: number, episode: number): string {
  return `S${season}E${episode}`;
}

export async function sonarr(cfg: WorkerCfg): Promise<ArrServerConfig | null> {
  return getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr");
}

/** GET JSON borné. `null` en cas d'échec — on ne devine jamais. */
export async function arrGet<T>(server: ArrServerConfig, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const SERIES_INDEX_KEY = "seer:sonarr:series";
/* Une série absente de l'index ne le fait pas relire plus d'une fois par minute. */
const INDEX_RETRY_MS = 60_000;
let indexRereadAt = 0;

async function readSeriesIndex(cfg: WorkerCfg): Promise<Map<number, number>> {
  // Pas de Sonarr configuré : un vrai vide, cachable sans remords.
  const server = await sonarr(cfg);
  if (!server) return new Map<number, number>();
  const rows = await arrGet<SonarrSeries[]>(server, "/api/v3/series");
  // Configuré mais muet : LEVER — un index vide gravé en cache ferait
  // disparaître tous les épisodes en silence, sans rien à réparer.
  if (rows === null) throw new Error("Sonarr injoignable (index des séries)");
  const index = new Map<number, number>();
  for (const s of rows) {
    if (s.tmdbId && s.id) index.set(s.tmdbId, s.id);
  }
  return index;
}

/**
 * tmdbId → identifiant Sonarr, en UN SEUL appel.
 *
 * Sonarr renseigne `tmdbId` sur presque toutes ses séries (162 sur 163 dans
 * l'instance de test) : inutile de passer par la correspondance de Jellyseerr,
 * qui coûterait un appel par média.
 */
export async function sonarrSeriesIndex(cfg: WorkerCfg): Promise<Map<number, number>> {
  return cached(SERIES_INDEX_KEY, SERIES_TTL_MS, () => readSeriesIndex(cfg), { staleMs: SERIES_STALE_MS });
}

/**
 * L'identifiant Sonarr d'UNE série. Absente de l'index gardé une demi-heure
 * — ajoutée depuis, le plus souvent par la demande qu'on suit —, l'index est
 * relu, au plus une fois par minute ; il ne remplace l'ancien que s'il a pu
 * être lu : Sonarr muet, on garde ce qu'on savait.
 */
export async function sonarrSeriesId(cfg: WorkerCfg, tmdbId: number): Promise<number | null> {
  const known = (await sonarrSeriesIndex(cfg)).get(tmdbId);
  if (known || Date.now() - indexRereadAt < INDEX_RETRY_MS) return known ?? null;
  indexRereadAt = Date.now();
  const fresh = await readSeriesIndex(cfg).catch(() => null);
  if (!fresh) return null;
  put(SERIES_INDEX_KEY, fresh, SERIES_TTL_MS, SERIES_STALE_MS);
  return fresh.get(tmdbId) ?? null;
}

/**
 * Le calendrier Sonarr d'une fenêtre, BRUT et caché une seule fois : les deux
 * dérivés (instants de diffusion, épisodes du calendrier maître) repartent de
 * la même réponse au lieu de payer chacun leur appel.
 */
async function sonarrCalendarRaw(
  cfg: WorkerCfg, from: string, to: string,
): Promise<SonarrEpisode[]> {
  return cached(
    `seer:sonarr:calraw:${from}:${to}`,
    CALENDAR_TTL_MS,
    async () => {
      const server = await sonarr(cfg);
      if (!server) return [];
      const rows = await arrGet<SonarrEpisode[]>(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&includeSeries=false`,
      );
      // Configuré mais muet ≠ semaine sans épisode : lever, ne rien graver.
      if (rows === null) throw new Error("Sonarr injoignable (calendrier)");
      return rows;
    },
    { staleMs: CALENDAR_STALE_MS },
  );
}

/**
 * Instants de diffusion d'une fenêtre, indexés « seriesId:S1E2 ».
 * Le calendrier de Sonarr couvre les séries qu'il suit, toutes chaînes mêlées.
 */
export async function sonarrWindowAirTimes(
  cfg: WorkerCfg, from: string, to: string,
): Promise<Map<string, string>> {
  const rows = await sonarrCalendarRaw(cfg, from, to);
  const times = new Map<string, string>();
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    times.set(`${e.seriesId}:${airTimeKey(e.seasonNumber, e.episodeNumber)}`, e.airDateUtc);
  }
  return times;
}

/**
 * Les épisodes de la fenêtre, passés COMPRIS, rattachés à leur série TMDB.
 *
 * C'est la seule source de dates passées pour les séries : les fiches TMDB ne
 * retiennent que le PROCHAIN épisode, si bien qu'un samedi, le calendrier ne
 * savait plus ce qui était sorti lundi. Sonarr, lui, garde toute la fenêtre.
 */
export async function sonarrWindowEpisodes(
  cfg: WorkerCfg, from: string, to: string,
): Promise<SonarrWindowEpisode[]> {
  const [rows, index] = await Promise.all([
    sonarrCalendarRaw(cfg, from, to),
    sonarrSeriesIndex(cfg),
  ]);
  if (rows.length === 0 || index.size === 0) return [];

  const tmdbBySeriesId = new Map<number, number>();
  for (const [tmdbId, seriesId] of index) tmdbBySeriesId.set(seriesId, tmdbId);

  const out: SonarrWindowEpisode[] = [];
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    const tmdbId = tmdbBySeriesId.get(e.seriesId);
    if (!tmdbId) continue;
    out.push({
      tmdbId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      airDate: e.airDate && /^\d{4}-\d{2}-\d{2}$/.test(e.airDate) ? e.airDate : null,
    });
  }
  return out;
}

/**
 * Ajoute l'instant réel aux entrées « épisode » d'un calendrier.
 *
 * Ne touche à rien d'autre, et ne jette jamais : Sonarr injoignable ou série
 * inconnue, le calendrier repart tel quel. C'est le client qui décidera du jour
 * à afficher, puisque lui seul connaît le fuseau.
 */
export async function attachAirTimes(
  cfg: WorkerCfg, res: CalendarResponse,
): Promise<CalendarResponse> {
  const episodes = res.items.filter((i) => i.kind === "episode");
  if (episodes.length === 0) return res;

  try {
    const [index, times] = await Promise.all([
      sonarrSeriesIndex(cfg),
      // Fenêtre élargie d'un jour : un épisode peut basculer d'une journée à
      // l'autre une fois ramené à l'heure locale, dans un sens comme dans l'autre.
      sonarrWindowAirTimes(cfg, shiftDay(res.from, -1), shiftDay(res.to, 1)),
    ]);
    if (index.size === 0 || times.size === 0) return res;

    for (const item of episodes) {
      const seriesId = index.get(item.tmdbId);
      if (!seriesId || item.seasonNumber == null || item.episodeNumber == null) continue;
      const at = times.get(`${seriesId}:${airTimeKey(item.seasonNumber, item.episodeNumber)}`);
      if (at) item.airDateUtc = at;
    }
  } catch { /* Sonarr indisponible : la date seule reste juste. */ }

  return res;
}

/** Décalage en jours d'une date 'YYYY-MM-DD', sans passer par UTC. */
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Instants de diffusion d'UNE série, indexés « S1E2 ».
 * Map vide si Sonarr ne la suit pas — l'appelant affichera la date seule.
 */
export async function sonarrSeriesAirTimes(
  cfg: WorkerCfg, tmdbId: number,
): Promise<Map<string, string>> {
  return cached(
    `seer:sonarr:eps:${tmdbId}`,
    EPISODES_TTL_MS,
    async () => {
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      const seriesId = index.get(tmdbId);
      if (!server || !seriesId) return new Map<string, string>();

      const rows = await arrGet<SonarrEpisode[]>(server, `/api/v3/episode?seriesId=${seriesId}`);
      // Série suivie mais Sonarr muet : lever plutôt que cacher « aucune heure ».
      if (rows === null) throw new Error("Sonarr injoignable (épisodes)");
      const times = new Map<string, string>();
      for (const e of rows) {
        if (!e.airDateUtc || e.seasonNumber == null || e.episodeNumber == null) continue;
        times.set(airTimeKey(e.seasonNumber, e.episodeNumber), e.airDateUtc);
      }
      return times;
    },
    { staleMs: EPISODES_STALE_MS },
  );
}
