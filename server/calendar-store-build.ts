/* ------------------------------------------------------------------ */
/*  Seer Plugin — Assemblage du calendrier maître                      */
/* ------------------------------------------------------------------ */

/*
 * LE cache demandé : le calendrier général est construit UNE fois pour toute
 * l'instance, et chaque vue (globale, mes demandes, celles de tout le monde)
 * n'est plus qu'une tranche filtrée de ce résultat. Budget réseau d'un build
 * à froid : ~15 pages de découverte + 2 appels Sonarr + les demandes de
 * l'instance (souvent déjà en cache) + ≤55 fiches — une fois par 6 h et par
 * région, là où l'ancien code payait jusqu'à ~85 appels PAR combinaison de
 * filtres.
 *
 * Le store est NEUTRE : `requestId`/`requestStatus` restent nuls, aucun
 * plafond par série n'y est appliqué. Statuts, pastilles et plafonds relèvent
 * du service — jamais figés dans une entrée partagée par tous les comptes.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import { cached } from "./cache";
import { detectAnimeLoose } from "./tmdb-traits";
import { tmdbKey, type TmdbRef } from "./tmdb-cache";
import { resolveTmdbMeta, scheduleTmdbBackfill } from "./tmdb-resolver";
import { loadEveryoneRows } from "./calendar-everyone";
import { buildPersonalCalendar } from "./calendar-personal";
import { buildProviderEpisodes } from "./calendar-providers";
import { attachAirTimes, sonarrWindowEpisodes, type SonarrWindowEpisode } from "./sonarr-schedule";
import {
  discoverUpcomingMovies, discoverRecentMovies, discoverTvFirsts,
  discoverTvReturning, discoverTvTopProviders, discoverRowsToItems,
  type DiscoverRow,
} from "./calendar-store-sources";
import { type CalendarItem, makeItemId, sortCalendarItems } from "./calendar-types";

/** Fiches des demandes récupérées en direct au build — le reste part en fond. */
const REQUESTS_FETCH_BUDGET = 60;
/** Garde-fou mémoire : ~600 o par entrée, au-delà on tronque après tri. */
const MAX_STORE_ITEMS = 4000;

export interface CalendarStore {
  region: string;
  from: string;
  to: string;
  items: CalendarItem[];
  /** true = des fiches manquent encore ; le store se redonne un TTL court. */
  partial: boolean;
  builtAt: string;
}

export async function buildCalendarStore(
  db: VigieDb,
  cfg: WorkerCfg,
  region: string,
  from: string,
  to: string,
  warn?: (err: unknown, msg: string) => void,
): Promise<CalendarStore> {
  const today = new Date().toISOString().slice(0, 10);

  /* 1) Sources en parallèle — chacune déjà cachée individuellement.
   *
   * Une source qui LÈVE (guichet muet) est remplacée par du vide, mais le
   * store se déclare alors incomplet : TTL court, bandeau, reconstruction
   * chaque minute. Sans ce marquage, une panne au démarrage gravait un
   * calendrier maigre et satisfait pour six heures — le seul scénario qui ne
   * se soignait pas tout seul. */
  let degraded = false;
  const fail = (name: string) => (err: unknown) => {
    degraded = true;
    warn?.(err, `[seer] source « ${name} » en échec — calendrier maître incomplet`);
  };

  const [movUp, movRecent, tvFirsts, tvReturning, tvProviders, sonarrEps, rows] =
    await Promise.all([
      sourceOrFallback(discoverUpcomingMovies(cfg), [], fail("films à venir")),
      sourceOrFallback(discoverRecentMovies(cfg, from, today), [], fail("films récents")),
      sourceOrFallback(discoverTvFirsts(cfg, from), [], fail("débuts de séries")),
      sourceOrFallback(discoverTvReturning(cfg), [], fail("séries en cours")),
      sourceOrFallback(discoverTvTopProviders(cfg, region), [], fail("plateformes")),
      sourceOrFallback(sonarrWindowEpisodes(cfg, from, to), [], fail("calendrier Sonarr")),
      // Ne lève jamais : repli local interne + drapeau seerrUnreachable.
      loadEveryoneRows(db, cfg, warn),
    ]);
  if (rows.seerrUnreachable === true) degraded = true;

  /* 2) Demandes de tout le monde → dates typées, films passés compris.
   * `buildPersonalCalendar` porte toute la logique de fraîcheur (fiches
   * amorcées à redemander, remplissage de fond) — on le réutilise tel quel et
   * on NEUTRALISE ses statuts : le store ne porte l'identité de personne. */
  const requests = await buildPersonalCalendar(db, cfg, rows, {
    from, to, includeSettled: true, maxFetch: REQUESTS_FETCH_BUDGET, region,
  });
  const requestItems = requests.items.map((it) => ({
    ...it, requestId: null, requestStatus: null,
  }));

  /* 3) Épisodes Sonarr (passé compris), habillés par les fiches. */
  const { items: sonarrItems, missing: sonarrMissing } =
    await sonarrEpisodesToItems(db, sonarrEps, from, to);
  if (sonarrMissing.length > 0) scheduleTmdbBackfill(db, cfg, sonarrMissing, region);

  /* 4) Prochains épisodes des séries en cours (popularité + plateformes). */
  const seriesRows = dedupeRows([...tvReturning, ...tvProviders]);
  const episodes = await buildProviderEpisodes(db, cfg, seriesRows, { region, from, to });

  /* 5) Premières et sorties salle, fenêtre appliquée. */
  const discoverItems = [
    ...discoverRowsToItems(movUp, "movie", from, to),
    ...discoverRowsToItems(movRecent, "movie", from, to),
    ...discoverRowsToItems(tvFirsts, "tv", from, to),
  ];

  /* 6) Fusion — l'ordre EST la préférence pour les entrées non datées par
   * Sonarr : fiches d'abord (dates régionales justes), découverte en dernier. */
  const merged = dedupeStoreItems([
    ...requestItems, ...sonarrItems, ...episodes.items, ...discoverItems,
  ]);

  /* 7) Enrichissement final depuis la mémoire des fiches, SQL seul. */
  await enrichFromMeta(db, cfg, merged, region);

  let items = sortCalendarItems(merged);
  if (items.length > MAX_STORE_ITEMS) {
    warn?.(null, `[seer] store ${region} tronqué : ${items.length} → ${MAX_STORE_ITEMS} entrées`);
    items = items.slice(0, MAX_STORE_ITEMS);
  }

  const res = await attachAirTimes(cfg, { from, to, items, partial: false });

  return {
    region, from, to,
    items: res.items,
    partial: requests.partial || episodes.partial || sonarrMissing.length > 0 || degraded,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Un échec de source ne vaut JAMAIS « rien à signaler » : repli fourni par
 * l'appelant, échec signalé pour que le résultat se déclare incomplet.
 * Le cache de la source, lui, n'a rien stocké — sa dernière bonne valeur
 * reste servie et le prochain passage réessaie.
 */
export async function sourceOrFallback<T>(
  p: Promise<T>,
  fallback: T,
  onFail: (err: unknown) => void,
): Promise<T> {
  try {
    return await p;
  } catch (err) {
    onFail(err);
    return fallback;
  }
}

/** Une ligne de découverte par identifiant — un doublon ferait doubler les refs. */
function dedupeRows(rows: DiscoverRow[]): DiscoverRow[] {
  const seen = new Set<number>();
  const out: DiscoverRow[] = [];
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * Dédoublonnage du store. L'`id` ne suffit pas : il contient la DATE, or le
 * même épisode porte souvent deux dates — celle de la chaîne d'origine (TMDB)
 * et le jour réel (Sonarr), à un jour d'écart.
 *
 *  - épisodes identifiés (S/E connus) : clé (type, tmdbId, SxE), la version
 *    qui connaît l'instant exact (`airDateUtc`, donc Sonarr) gagne ;
 *  - épisodes anonymes (fiche sans numéro) : jetés si un épisode identifié de
 *    la même série tombe le même jour, sinon gardés tels quels ;
 *  - tout le reste : clé (type, tmdbId, kind), premier arrivé gagne — d'où
 *    l'importance de l'ordre d'entrée, fiches avant découverte.
 */
export function dedupeStoreItems(items: CalendarItem[]): CalendarItem[] {
  const byKey = new Map<string, CalendarItem>();
  const identifiedDays = new Set<string>();
  const anonymous: CalendarItem[] = [];

  for (const it of items) {
    if (it.kind === "episode" && (it.seasonNumber == null || it.episodeNumber == null)) {
      anonymous.push(it);
      continue;
    }
    const key = it.kind === "episode"
      ? `${it.mediaType}:${it.tmdbId}:S${it.seasonNumber}E${it.episodeNumber}`
      : `${it.mediaType}:${it.tmdbId}:${it.kind}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, it);
    else if (!prev.airDateUtc && it.airDateUtc) byKey.set(key, it);
  }

  for (const it of byKey.values()) {
    if (it.kind === "episode") identifiedDays.add(`${it.tmdbId}:${it.date}`);
  }
  for (const it of anonymous) {
    const key = `${it.mediaType}:${it.tmdbId}:episode:${it.date}`;
    if (identifiedDays.has(`${it.tmdbId}:${it.date}`) || byKey.has(key)) continue;
    byKey.set(key, it);
  }

  return Array.from(byKey.values());
}

/** Épisodes Sonarr → entrées, habillées depuis la mémoire des fiches. */
async function sonarrEpisodesToItems(
  db: VigieDb,
  eps: SonarrWindowEpisode[],
  from: string,
  to: string,
): Promise<{ items: CalendarItem[]; missing: TmdbRef[] }> {
  if (eps.length === 0) return { items: [], missing: [] };

  const refs: TmdbRef[] = Array.from(new Set(eps.map((e) => e.tmdbId)))
    .map((tmdbId) => ({ mediaType: "tv" as const, tmdbId }));
  // SQL seul : le build ne paie pas un appel par série suivie — une fiche
  // absente part en remplissage de fond et l'épisode attendra le prochain tour.
  const { meta, missing } = await resolveTmdbMeta(db, null, refs, { maxFetch: 0 });

  const items: CalendarItem[] = [];
  for (const e of eps) {
    const m = meta.get(tmdbKey({ mediaType: "tv", tmdbId: e.tmdbId }));
    if (!m || !m.title) continue;
    const date = e.airDate ?? e.airDateUtc.slice(0, 10);
    if (date < from || date > to) continue;

    items.push({
      id: makeItemId("tv", e.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: e.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind: "episode",
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      networks: m.networks,
      providerIds: m.providerIds ?? [],
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: detectAnimeLoose(m),
      requestId: null,
      requestStatus: null,
    });
  }

  return { items, missing };
}

/**
 * Complète note, langue, plateformes et verdict animé depuis les fiches déjà
 * en mémoire (`maxFetch: 0`). C'est ce qui rend les filtres fiables sur les
 * entrées venues de la découverte, dont la ligne d'origine est plus pauvre
 * qu'une fiche.
 */
async function enrichFromMeta(
  db: VigieDb,
  cfg: WorkerCfg,
  items: CalendarItem[],
  region: string,
): Promise<void> {
  const refs = items.map((i) => ({ mediaType: i.mediaType, tmdbId: i.tmdbId }));
  const { meta } = await resolveTmdbMeta(db, cfg, refs, { maxFetch: 0, region });

  for (const it of items) {
    const m = meta.get(tmdbKey({ mediaType: it.mediaType, tmdbId: it.tmdbId }));
    if (!m) continue;
    if (it.providerIds.length === 0 && m.providerIds?.length) it.providerIds = m.providerIds;
    if (it.voteAverage == null && m.voteAverage != null) it.voteAverage = m.voteAverage;
    if (it.popularity == null && m.popularity != null) it.popularity = m.popularity;
    if (!it.originalLanguage && m.originalLanguage) it.originalLanguage = m.originalLanguage;
    if (it.isAnime !== true && detectAnimeLoose(m)) it.isAnime = true;
  }
}
