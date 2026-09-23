/* ------------------------------------------------------------------ */
/*  Vigie — Ce que Sonarr sait de chaque épisode : là, ou attendu       */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr ne connaît que la SAISON : « partiellement disponible » pour une
 * saison en cours de diffusion ne dit pas si l'épisode 18 est arrivé. Sonarr,
 * lui, le sait épisode par épisode : `hasFile` (le fichier est là) et
 * `monitored` (il le récupérera dès qu'il sortira — c'est ce qu'on a demandé).
 *
 * Deux lectures, courtes toutes les deux — un épisode arrive à la minute près
 * et c'est précisément ce qu'on veut voir :
 *   - une FENÊTRE du calendrier (tout ce qui sort, suivi ou non) ;
 *   - une SÉRIE entière, pour sa fiche.
 * Périmées, elles sont servies pendant qu'elles se relisent : personne
 * n'attend Sonarr.
 */

import type { WorkerCfg } from "./seerr-unified";
import { cached } from "./cache";
import { airTimeKey, arrGet, sonarr, sonarrSeriesId, sonarrSeriesIndex } from "./sonarr-schedule";

const FACTS_TTL_MS = 60_000;
const SERIES_FACTS_TTL_MS = 45_000;
const FACTS_STALE_MS = 10 * 60_000;

interface SonarrEpisodeRow {
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  hasFile?: boolean;
  monitored?: boolean;
  airDate?: string;
}

/** Ce que Sonarr dit d'un épisode. */
export interface EpisodeFact {
  hasFile: boolean;
  monitored: boolean;
  /** Jour de diffusion (chaîne d'origine) — ce que TMDB et Sonarr partagent quand leurs numéros divergent. */
  airDate?: string;
}

export interface WindowFacts {
  /** « tmdbId:S4E18 » → faits. */
  byEpisode: Map<string, EpisodeFact>;
  /** « tmdbId:2026-09-24 » → faits des épisodes de ce jour (numérotations qui divergent). */
  byDay: Map<string, EpisodeFact[]>;
}

/** La clé de cache des épisodes d'une série — la file l'oublie quand la série en sort. */
export const seriesFactsKey = (tmdbId: number) => `seer:sonarr:facts:series:${tmdbId}`;

export function episodeKey(tmdbId: number, season: number, episode: number): string {
  return `${tmdbId}:${airTimeKey(season, episode)}`;
}

function factOf(row: SonarrEpisodeRow): EpisodeFact {
  const fact: EpisodeFact = { hasFile: row.hasFile === true, monitored: row.monitored === true };
  if (row.airDate && /^\d{4}-\d{2}-\d{2}$/.test(row.airDate)) fact.airDate = row.airDate;
  return fact;
}

/**
 * Les épisodes d'une fenêtre, suivis OU NON : un épisode sans suivi dont le
 * fichier est là reste disponible, et l'absence de suivi dit « non demandé ».
 */
export async function sonarrWindowFacts(cfg: WorkerCfg, from: string, to: string): Promise<WindowFacts> {
  return cached(
    `seer:sonarr:facts:${from}:${to}`,
    FACTS_TTL_MS,
    async () => {
      const facts: WindowFacts = { byEpisode: new Map(), byDay: new Map() };
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      if (!server || index.size === 0) return facts;
      const rows = await arrGet<SonarrEpisodeRow[]>(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&unmonitored=true&includeSeries=false`,
      );
      // Configuré mais muet : lever, ne pas graver « rien n'est là » une minute.
      if (rows === null) throw new Error("Sonarr injoignable (état des épisodes)");

      const tmdbBySeries = new Map<number, number>();
      for (const [tmdbId, seriesId] of index) tmdbBySeries.set(seriesId, tmdbId);
      for (const row of rows) {
        const tmdbId = row.seriesId != null ? tmdbBySeries.get(row.seriesId) : undefined;
        if (!tmdbId || row.seasonNumber == null || row.episodeNumber == null) continue;
        const fact = factOf(row);
        facts.byEpisode.set(episodeKey(tmdbId, row.seasonNumber, row.episodeNumber), fact);
        if (row.airDate) {
          const day = `${tmdbId}:${row.airDate}`;
          facts.byDay.set(day, [...(facts.byDay.get(day) ?? []), fact]);
        }
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS },
  );
}

/**
 * Tous les épisodes d'UNE série, « S4E18 » → faits. Map vide quand Sonarr ne
 * la suit pas : la fiche se rabat alors sur l'état des saisons.
 */
export async function sonarrSeriesFacts(cfg: WorkerCfg, tmdbId: number): Promise<Map<string, EpisodeFact>> {
  return cached(
    seriesFactsKey(tmdbId),
    SERIES_FACTS_TTL_MS,
    async () => {
      // Une série tout juste ajoutée à Sonarr est retrouvée sans attendre l'index.
      const [server, seriesId] = await Promise.all([sonarr(cfg), sonarrSeriesId(cfg, tmdbId)]);
      if (!server || !seriesId) return new Map<string, EpisodeFact>();
      const rows = await arrGet<SonarrEpisodeRow[]>(server, `/api/v3/episode?seriesId=${seriesId}`);
      if (rows === null) throw new Error("Sonarr injoignable (épisodes de la série)");
      const facts = new Map<string, EpisodeFact>();
      for (const row of rows) {
        if (row.seasonNumber == null || row.episodeNumber == null) continue;
        facts.set(airTimeKey(row.seasonNumber, row.episodeNumber), factOf(row));
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS },
  );
}
