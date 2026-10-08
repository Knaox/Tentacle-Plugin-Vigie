/* ------------------------------------------------------------------ */
/*  Seer Plugin — Routes de lecture (liste fusionnée + stats)          */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import { getAllRequests, getUserRequests } from "./db";
import { cached, peek } from "./cache";
import { getUser, type WorkerCfg, localToUnified } from "./seerr-unified";
import {
  type MergedRows, buildMergedRows, collectTmdbRefs, hydrateRows,
  filterAndPaginate, metaToDetail,
} from "./requests-list";
import { resolveTmdbMeta, scheduleTmdbBackfill, pendingBackfillCount } from "./tmdb-resolver";
import { tmdbKey } from "./tmdb-cache";
import { arrVerdicts, restat, withArrStatus, type ArrVerdict } from "./arr-truth";
import { localRequestedSeasons } from "./titles/local-seasons";

/** Liste brute fraîche 1 min, servable 10 min pendant le rafraîchissement. */
const ROWS_TTL_MS = 60_000;
const ROWS_STALE_MS = 600_000;

/** Fiches manquantes récupérées en direct : seulement celles de la page affichée. */
const PAGE_META_BUDGET = 20;

export const rowsCacheKey = (userId: string) => `seer-cache:${userId}:rows`;

/** Les lignes brutes d'un compte — partagées par la liste et le suivi en direct. */
export function loadMergedRows(
  db: VigieDb,
  cfg: WorkerCfg,
  user: ReturnType<typeof getUser>,
  log?: (err: unknown, msg: string) => void,
): Promise<MergedRows> {
  return cached(rowsCacheKey(user.userId), ROWS_TTL_MS, () => buildMergedRows(db, cfg, user, log), { staleMs: ROWS_STALE_MS });
}

export function registerRequestReadRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {

  const loadRows = (cfg: WorkerCfg, user: ReturnType<typeof getUser>) =>
    loadMergedRows(db, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));

  /* ── GET /requests — Jellyseerr + locales en attente ; ce qui attend encore,
   *    Sonarr et Radarr disent où il en est (cf. arr-truth.ts) ── */
  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query as {
      page?: string; limit?: string; status?: string; type?: string; q?: string;
    };

    if (user.isAdmin && query.status === "all_users") {
      const list = await getAllRequests(db, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        mediaType: query.type,
      });
      return { ...list, results: list.results.map(localToUnified) };
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const config = await getWorkerConfig();
    if (!config) {
      const local = await getUserRequests(db, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }

    const rows = await loadRows(config, user);
    const refs = collectTmdbRefs(rows);

    // 1) Lecture SQL seule : instantanée, aucun appel réseau.
    const { meta, missing } = await resolveTmdbMeta(db, config, refs, { maxFetch: 0 });
    const hydrated = hydrateRows(rows, meta, user);
    /* Sonarr et Radarr disent où en sont les demandes qui attendent encore :
     * en route, arrivées — sans attendre que Jellyseerr le constate. */
    const verdicts = await arrVerdicts(config, hydrated).catch(() => new Map<string, ArrVerdict>());
    let items = withArrStatus(hydrated, verdicts);
    let result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });

    /* 2) Seules les fiches VISIBLES sur cette page sont récupérées en direct.
     *    C'est ce qui remplace les ~430 appels simultanés d'avant : au pire une
     *    vague bornée de 20, le reste part en tâche de fond. */
    if (missing.length > 0) {
      const visible = new Set(
        result.results.map((r) => tmdbKey({ mediaType: r.mediaType, tmdbId: r.tmdbId })),
      );
      const onPage = missing.filter((r) => visible.has(tmdbKey(r)));

      if (onPage.length > 0) {
        const filled = await resolveTmdbMeta(db, config, onPage, { maxFetch: PAGE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = withArrStatus(hydrateRows(rows, meta, user), verdicts);
        result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });
      }

      scheduleTmdbBackfill(db, config, missing);
    }

    return {
      ...result,
      stats: restat(rows.stats, hydrated, verdicts),
      // > 0 : des titres manquent encore, le front repasse plus vite.
      metaPending: pendingBackfillCount(),
    };
  });

  /* ── GET /requests/stats ──
   * Conservé pour les bundles déjà déployés, mais ne fait plus aucun appel
   * réseau propre : il relit la liste déjà chargée. La seconde pagination
   * complète de toutes les demandes a disparu. */
  app.get("/requests/stats", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig();

    const empty = { total: 0, byStatus: {} as Record<string, number>, byType: { movie: 0, tv: 0 } };
    if (!config) return empty;

    const hit = peek<MergedRows>(rowsCacheKey(user.userId), true);
    if (hit) return hit.stats;

    const rows = await loadRows(config, user);
    return rows.stats;
  });

  /* ── GET /requests/lookup — saisons demandées LOCALEMENT pour un tmdbId ──
   * La fiche verrouille une saison demandée IMMÉDIATEMENT et durablement
   * (survit au refresh), sans attendre que Jellyseerr connaisse la demande
   * (cf. titles/local-seasons.ts, partagé avec la feuille de Tentacle). */
  app.get("/requests/lookup", async (request) => {
    const user = getUser(request);
    const q = request.query as { mediaType?: string; tmdbId?: string };
    const tmdbId = Number(q.tmdbId);
    if (q.mediaType !== "tv" || !Number.isFinite(tmdbId) || tmdbId <= 0) return { seasons: [] };
    return { seasons: await localRequestedSeasons(db, user.userId, tmdbId) };
  });

}

/** Réexporté pour la route de progression, qui réutilise la liste déjà chargée. */
export type { MergedRows };
export { metaToDetail };
