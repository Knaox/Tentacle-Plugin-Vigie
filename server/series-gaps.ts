/* ------------------------------------------------------------------ */
/*  Vigie — Ce qui manque aux séries en partie là                      */
/* ------------------------------------------------------------------ */

/*
 * « En partie » ne dit pas quoi faire : il manque une saison entière, ou
 * quelques épisodes d'une saison en cours ? Jellyseerr le sait, saison par
 * saison — mais ne le joint ni à ses résultats de recherche ni à sa liste de
 * demandes (vérifié : `mediaInfo` et `media` y arrivent sans `seasons`).
 *
 * Une seule liste le donne, pour toutes les séries à la fois :
 * `GET /media?filter=partial` renvoie les séries en partie là AVEC l'état de
 * chacune de leurs saisons (une entité par saison TMDB, hors spéciaux). Une
 * page ou deux pour tout un serveur, gardées une minute : les affiches, les
 * demandes et le calendrier y lisent ce qui manque sans un appel de plus.
 */

import { cached } from "./cache";
import type { WorkerCfg } from "./seerr-unified";

/** Saison → statut Jellyseerr (5 disponible, 4 en partie, sinon absente). */
export type SeasonStates = ReadonlyMap<number, number>;

/** Ce qui manque à une série : des saisons entières, des épisodes de certaines. */
export interface SeriesGaps {
  missing: number[];
  partial: number[];
}

const AVAILABLE = 5;
const PARTIAL = 4;
const PAGE = 100;
/** Garde-fou : mille séries incomplètes, c'est déjà une bibliothèque hors norme. */
const MAX_PAGES = 10;

interface MediaPage {
  pageInfo?: { pages?: number };
  results?: Array<{
    mediaType?: string;
    tmdbId?: number;
    seasons?: Array<{ seasonNumber?: number; status?: number }>;
  }>;
}

async function loadIndex(cfg: Pick<WorkerCfg, "seerrUrl" | "seerrApiKey">): Promise<Map<number, SeasonStates>> {
  const out = new Map<number, SeasonStates>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${cfg.seerrUrl}/api/v1/media?filter=partial&take=${PAGE}&skip=${page * PAGE}&sort=mediaAdded`;
    const res = await fetch(url, { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Jellyseerr GET /media?filter=partial : ${res.status}`);
    const body = (await res.json()) as MediaPage;
    for (const media of body.results ?? []) {
      if (media.mediaType !== "tv" || typeof media.tmdbId !== "number") continue;
      const seasons = new Map<number, number>();
      for (const s of media.seasons ?? []) {
        if (typeof s.seasonNumber === "number" && s.seasonNumber > 0 && typeof s.status === "number") {
          seasons.set(s.seasonNumber, s.status);
        }
      }
      out.set(media.tmdbId, seasons);
    }
    if ((body.pageInfo?.pages ?? 1) <= page + 1) break;
  }
  return out;
}

/**
 * L'état des saisons de chaque série en partie là, par id TMDB. Une carte
 * vide quand Jellyseerr ne répond pas : on ne sait pas, on ne conclut rien.
 */
export async function partialSeriesSeasons(
  cfg: Pick<WorkerCfg, "seerrUrl" | "seerrApiKey"> | null,
): Promise<ReadonlyMap<number, SeasonStates>> {
  if (!cfg) return new Map();
  try {
    return await cached(`series-gaps:${cfg.seerrUrl}`, 60_000, () => loadIndex(cfg), { staleMs: 10 * 60_000 });
  } catch {
    return new Map();
  }
}

/** Les saisons absentes, et celles qui ne sont là qu'en partie. */
export function gapsOf(seasons: SeasonStates | undefined): SeriesGaps | null {
  if (!seasons || seasons.size === 0) return null;
  const missing: number[] = [];
  const partial: number[] = [];
  for (const [season, status] of seasons) {
    if (status === PARTIAL) partial.push(season);
    else if (status !== AVAILABLE) missing.push(season);
  }
  if (missing.length === 0 && partial.length === 0) return null;
  return { missing: missing.sort((a, b) => a - b), partial: partial.sort((a, b) => a - b) };
}
