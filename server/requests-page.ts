/* ------------------------------------------------------------------ */
/*  Vigie — Une page de demandes, d'un compte ou de tous                */
/* ------------------------------------------------------------------ */

/*
 * « Mes demandes » et la vue de l'administrateur (tous les comptes) servent
 * la même page, à partir des mêmes lignes brutes : titres et affiches lus en
 * base d'abord (aucun appel), Sonarr et Radarr pour ce qui attend encore,
 * puis seules les fiches VISIBLES sur la page récupérées en direct — au pire
 * une vague bornée, le reste part en tâche de fond.
 */

import type { PrismaClient } from "@prisma/client";
import type { JellyfinUser, WorkerCfg } from "./seerr-unified";
import {
  collectTmdbRefs, filterAndPaginate, hydrateRows,
  type ListQuery, type MergedRows, type RequesterOf,
} from "./requests-list";
import { resolveTmdbMeta, scheduleTmdbBackfill, pendingBackfillCount } from "./tmdb-resolver";
import { tmdbKey } from "./tmdb-cache";
import { arrVerdicts, restat, withArrStatus, type ArrVerdict } from "./arr-truth";

/** Fiches manquantes récupérées en direct : seulement celles de la page affichée. */
const PAGE_META_BUDGET = 20;

export async function requestsPage(
  prisma: PrismaClient,
  config: WorkerCfg,
  rows: MergedRows,
  viewer: JellyfinUser,
  query: ListQuery,
  requesterOf?: RequesterOf,
) {
  const refs = collectTmdbRefs(rows);

  // 1) Lecture SQL seule : instantanée, aucun appel réseau.
  const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, { maxFetch: 0 });
  const hydrated = hydrateRows(rows, meta, viewer, requesterOf);
  /* Sonarr et Radarr disent où en sont les demandes qui attendent encore :
   * en route, arrivées — sans attendre que Jellyseerr le constate. */
  const verdicts = await arrVerdicts(config, hydrated).catch(() => new Map<string, ArrVerdict>());
  let items = withArrStatus(hydrated, verdicts);
  let result = filterAndPaginate(items, query);

  // 2) Seules les fiches VISIBLES sur cette page sont récupérées en direct.
  if (missing.length > 0) {
    const visible = new Set(result.results.map((r) => tmdbKey({ mediaType: r.mediaType, tmdbId: r.tmdbId })));
    const onPage = missing.filter((r) => visible.has(tmdbKey(r)));
    if (onPage.length > 0) {
      const filled = await resolveTmdbMeta(prisma, config, onPage, { maxFetch: PAGE_META_BUDGET });
      for (const [k, v] of filled.meta) meta.set(k, v);
      items = withArrStatus(hydrateRows(rows, meta, viewer, requesterOf), verdicts);
      result = filterAndPaginate(items, query);
    }
    scheduleTmdbBackfill(prisma, config, missing);
  }

  return {
    ...result,
    stats: restat(rows.stats, hydrated, verdicts),
    // > 0 : des titres manquent encore, le front repasse plus vite.
    metaPending: pendingBackfillCount(),
  };
}
