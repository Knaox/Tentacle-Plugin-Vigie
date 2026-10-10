/* ------------------------------------------------------------------ */
/*  Seer Plugin — Routes de lecture (liste fusionnée + stats)          */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import { getUserRequests } from "./db";
import { cached, peek } from "./cache";
import { getUser, type WorkerCfg, localToUnified } from "./seerr-unified";
import { type MergedRows, buildMergedRows, metaToDetail } from "./requests-list";
import { requestsPage } from "./requests-page";
import { localRequestedSeasons } from "./titles/local-seasons";

/** Liste brute fraîche 1 min, servable 10 min pendant le rafraîchissement. */
const ROWS_TTL_MS = 60_000;
const ROWS_STALE_MS = 600_000;

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
   *    Sonarr et Radarr disent où il en est (cf. arr-truth.ts). Les demandes de
   *    tous les comptes : GET /admin/requests (routes-requests-all.ts). ── */
  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query as {
      page?: string; limit?: string; status?: string; type?: string; q?: string;
    };
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const config = await getWorkerConfig();
    if (!config) {
      const local = await getUserRequests(db, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }

    const rows = await loadRows(config, user);
    return requestsPage(db, config, rows, user, { page, limit, status: query.status, type: query.type, q: query.q });
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
