/* ------------------------------------------------------------------ */
/*  Seer Plugin — Calendrier « mes sorties »                           */
/* ------------------------------------------------------------------ */

/*
 * Le piège de ce mode, c'est le volume : une instance peut compter des
 * centaines de demandes, et aller chercher la fiche de chacune ferait
 * exactement le N+1 qu'on vient de supprimer ailleurs.
 *
 * On élague donc AVANT d'enrichir, en n'utilisant que ce qu'on a déjà en main
 * (le statut du média, présent dans la liste) :
 *   - un film déjà disponible n'a plus de « prochaine sortie » à annoncer ;
 *   - une série terminée ne diffusera plus rien.
 * Il ne reste qu'une poignée de titres réellement en attente.
 */

import type { PrismaClient } from "@prisma/client";
import type { RequestStatus } from "./types";
import type { TmdbMeta, TmdbRef } from "./tmdb-cache";
import { tmdbKey } from "./tmdb-cache";
import type { WorkerCfg } from "./seerr-unified";
import type { MergedRows } from "./requests-list";
import { resolveTmdbMeta, scheduleTmdbBackfill, DEFAULT_REGION } from "./tmdb-resolver";
import { needsDateRefresh, needsTraitsRefresh } from "./calendar-freshness";
import { resolveRequestStatus } from "./request-status";
import {
  type CalendarItem, type CalendarResponse, type CalendarKind,
  makeItemId, sortCalendarItems, capPerSeries,
} from "./calendar-types";

/** Fiches récupérées en direct pour un calendrier froid. */
const FETCH_BUDGET = 25;
const MAX_PER_SERIES = 3;

/** Statuts Jellyseerr de média n'annonçant plus rien : 5 = disponible. */
const SETTLED_MEDIA_STATUS = new Set([5]);

export interface PersonalCalendarOpts {
  from: string;
  to: string;
  maxFetch?: number;
  region?: string;
  /** true = garder aussi les demandes déjà satisfaites. */
  includeSettled?: boolean;
}

/** Ce qu'une liste de demandes donne au calendrier : les fiches à suivre, et
 * le statut à afficher pour chacune. */
export interface RequestRefs {
  refs: Map<string, TmdbRef>;
  statusByKey: Map<string, { status: RequestStatus; requestId: string | null }>;
}

/**
 * Élagage sur les seules données déjà en main — aucun appel réseau.
 * Extrait pour que le calendrier maître puisse filtrer sa tranche par les
 * demandes d'un utilisateur sans reconstruire tout le calendrier personnel.
 */
export function collectRequestRefs(rows: MergedRows, includeSettled: boolean): RequestRefs {
  const refs = new Map<string, TmdbRef>();
  const statusByKey = new Map<string, { status: RequestStatus; requestId: string | null }>();

  for (const sr of rows.seerrRows) {
    if (!sr.media?.tmdbId) continue;
    const ref: TmdbRef = { mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId };
    const key = tmdbKey(ref);

    if (!includeSettled
        && sr.media.mediaType === "movie"
        && SETTLED_MEDIA_STATUS.has(sr.media.status ?? 0)) continue;

    refs.set(key, ref);
    if (!statusByKey.has(key)) {
      const local = rows.localBySeerrId.get(sr.id);
      statusByKey.set(key, {
        status: resolveRequestStatus(sr, local, rows.seasonStates?.get(sr.media.tmdbId)),
        requestId: local?.id ?? `seerr-${sr.id}`,
      });
    }
  }

  for (const l of rows.localOnly) {
    if (!l.tmdbId) continue;
    const key = tmdbKey({ mediaType: l.mediaType, tmdbId: l.tmdbId });
    refs.set(key, { mediaType: l.mediaType, tmdbId: l.tmdbId });
    if (!statusByKey.has(key)) statusByKey.set(key, { status: l.status, requestId: l.id });
  }

  return { refs, statusByKey };
}

export async function buildPersonalCalendar(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  rows: MergedRows,
  opts: PersonalCalendarOpts,
): Promise<CalendarResponse> {
  const region = opts.region ?? DEFAULT_REGION;

  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);

  /* 2) Enrichissement borné : la mémoire des fiches sert déjà la plupart. */
  const list = Array.from(refs.values());
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, list, {
    maxFetch: opts.maxFetch ?? FETCH_BUDGET,
    region,
  });
  /* Une fiche connue mais sans aucune date n'est pas résolue pour autant : c'est
   * l'amorçage qui l'a posée là, avec son seul titre. La compter comme acquise
   * rendait le calendrier muet ET satisfait — personne ne la redemandait, et
   * rien ne signalait le manque. C'est ce qui faisait ressembler « Toutes les
   * demandes » à « À venir » : les demandes des autres, jamais passées par le
   * plugin, n'existaient qu'à l'état d'amorce. */
  const undated = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && needsDateRefresh(m);
  });
  const toFill = [...missing, ...undated];

  /* Les fiches antérieures aux colonnes de tri sont remises en file elles
   * aussi, mais SANS compter comme incomplètes : leurs dates, elles, sont
   * bonnes — le calendrier n'a rien à attendre, seuls les filtres gagnent à ce
   * qu'elles repassent. Les annoncer manquantes ferait tourner le sondage du
   * client pour rien. */
  const untyped = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && !needsDateRefresh(m) && needsTraitsRefresh(m);
  });

  if (toFill.length > 0 || untyped.length > 0) {
    scheduleTmdbBackfill(prisma, cfg, [...toFill, ...untyped], region);
  }

  /* 3) Construction, purement en mémoire. */
  const items: CalendarItem[] = [];
  for (const ref of list) {
    const m = meta.get(tmdbKey(ref));
    if (!m) continue;
    const ctx = statusByKey.get(tmdbKey(ref));
    for (const item of metaToCalendarItems(m, opts.from, opts.to)) {
      items.push({
        ...item,
        requestId: ctx?.requestId ?? null,
        requestStatus: ctx?.status ?? null,
      });
    }
  }

  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    /* Des lignes de repli (Jellyseerr muet) rendent le résultat incomplet au
     * même titre que des fiches manquantes : TTL court + sondage du client,
     * jusqu'à ce que la vraie liste revienne. */
    partial: toFill.length > 0 || rows.seerrUnreachable === true,
  };
}

type BareItem = Omit<CalendarItem, "requestId" | "requestStatus">;

/** Une fiche peut produire plusieurs entrées : au cinéma PUIS en ligne. */
export function metaToCalendarItems(m: TmdbMeta, from: string, to: string): BareItem[] {
  const out: BareItem[] = [];

  const push = (date: string | null, kind: CalendarKind, season?: number | null, episode?: number | null) => {
    if (!date || date < from || date > to) return;
    out.push({
      id: makeItemId(m.mediaType, m.tmdbId, kind, date),
      date,
      mediaType: m.mediaType,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      networks: m.networks,
      providerIds: m.providerIds,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false,
    });
  };

  if (m.mediaType === "movie") {
    push(m.digitalDate, "digital");
    push(m.theatricalDate, "theatrical");
    push(m.physicalDate, "physical");
    // Aucune date typée : la date de sortie annoncée reste la meilleure info.
    if (out.length === 0) push(m.releaseDate, "premiere");
  } else {
    push(m.nextAirDate, "episode", m.nextSeason, m.nextEpisode);
    if (m.releaseDate && (!m.nextAirDate || m.releaseDate !== m.nextAirDate)) {
      push(m.releaseDate, "premiere");
    }
  }

  return out;
}
