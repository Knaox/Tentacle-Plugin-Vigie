/* ------------------------------------------------------------------ */
/*  Seer Plugin — Calendrier : le volet plateformes                    */
/* ------------------------------------------------------------------ */

/*
 * Servait le mode plateformes de l'ancien calendrier global ; alimente
 * aujourd'hui le calendrier maître (calendar-store-build).
 *
 * Deux besoins distincts se rejoignent ici : trouver les prochains épisodes
 * des séries diffusées sur les plateformes retenues, et dire honnêtement sur
 * quelles plateformes chaque titre se regarde. Le second point corrige un
 * mensonge : chaque entrée recopiait la plateforme DEMANDÉE, ce qui était
 * inoffensif tant qu'on n'en choisissait qu'une, et devenait faux dès qu'on en
 * cochait plusieurs — un film apparaissait alors comme disponible sur les
 * quatre plateformes cochées.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import type { TmdbRef } from "./tmdb-cache";
import { tmdbKey } from "./tmdb-cache";
import { resolveTmdbMeta, scheduleTmdbBackfill } from "./tmdb-resolver";
import { makeItemId, type CalendarItem } from "./calendar-types";

/** Fiches récupérées en direct pour un calendrier plateforme encore froid. */
const EPISODE_FETCH_BUDGET = 30;

export interface ProviderScope {
  region: string;
  from: string;
  to: string;
}

interface SeriesRow {
  id?: number;
  name?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  mediaInfo?: { status?: number };
}

/** Statut Jellyseerr d'un média bloqué par tags — retiré comme sur le catalogue. */
const MEDIA_STATUS_BLOCKLISTED = 6;

/**
 * Prochains épisodes des séries en cours de diffusion sur une plateforme.
 * Les dates viennent de la mémoire des fiches : gratuit une fois chaude, et
 * ce qui manque est complété en tâche de fond pour la prochaine consultation.
 */
export async function buildProviderEpisodes(
  db: VigieDb,
  cfg: WorkerCfg,
  rows: SeriesRow[],
  opts: ProviderScope,
): Promise<{ items: CalendarItem[]; partial: boolean }> {
  const refs: TmdbRef[] = [];
  const posters = new Map<number, SeriesRow>();
  for (const r of rows) {
    if (!r.id || r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;
    refs.push({ mediaType: "tv", tmdbId: r.id });
    posters.set(r.id, r);
  }
  if (refs.length === 0) return { items: [], partial: false };

  const { meta, missing } = await resolveTmdbMeta(db, cfg, refs, {
    maxFetch: EPISODE_FETCH_BUDGET,
    region: opts.region,
  });
  if (missing.length > 0) scheduleTmdbBackfill(db, cfg, missing, opts.region);

  const items: CalendarItem[] = [];
  for (const ref of refs) {
    const m = meta.get(tmdbKey(ref));
    const date = m?.nextAirDate;
    if (!m || !date || date < opts.from || date > opts.to) continue;

    const src = posters.get(ref.tmdbId);
    items.push({
      id: makeItemId("tv", ref.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: ref.tmdbId,
      title: m.title || src?.name || "",
      posterPath: m.posterPath ?? src?.posterPath ?? null,
      backdropPath: m.backdropPath ?? src?.backdropPath ?? null,
      overview: m.overview ?? src?.overview ?? null,
      kind: "episode",
      seasonNumber: m.nextSeason,
      episodeNumber: m.nextEpisode,
      networks: m.networks,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false,
      // Les vraies plateformes de la série, pas celles qu'on a demandées.
      providerIds: m.providerIds ?? [],
      requestId: null,
      requestStatus: null,
    });
  }

  return { items, partial: missing.length > 0 };
}
