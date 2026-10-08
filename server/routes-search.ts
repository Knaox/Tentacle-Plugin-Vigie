/* ------------------------------------------------------------------ */
/*  Vigie — Routes de la recherche                                     */
/* ------------------------------------------------------------------ */

/*
 *   GET /search           — la recherche du catalogue de Vigie.
 *                           `mode=instant` : l'index seul, en millisecondes ;
 *                           `mode=full` (défaut) : l'index + tout TMDB.
 *   GET /search/provider  — le contrat générique de la recherche de Tentacle
 *                           (barre globale, bibliothèques). Déclaré dans
 *                           `plugin.json` → `search`. Répond TOUJOURS vite :
 *                           la réponse complète si elle est prête, sinon celle
 *                           de l'index avec `complete: false` — Tentacle
 *                           redemande un peu plus tard.
 *   GET /search/person    — même contrat, pour une filmographie : ce qu'une
 *                           personne a fait et que la bibliothèque n'a pas.
 *                           Déclaré dans `plugin.json` → `search.person`.
 *                           `role` (facultatif) : le crédit Jellyfin par
 *                           lequel on arrive — ses œuvres passent devant.
 *   GET /search/collection — même contrat, pour une saga : les volets que la
 *                           bibliothèque n'a pas (`tmdb` = la saga TMDB),
 *                           chacun avec son `tmdbId` pour prendre son rang
 *                           sur la fiche d'un film. `search.collection`.
 */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import { fullIfReady, fullSearch, instantSearch, warmSearch, type SearchContext, type SearchOptions } from "./search/service";
import { presentHub, presentProvider } from "./search/respond";
import { genreFacets, providerFacets } from "./search/facets";
import { titleIndexBuilding } from "./search/title-crawl";
import { personProvider, readRole } from "./search/person-credits";
import { collectionProvider } from "./search/collection-parts";

const MAX_QUERY = 120;
const MAX_PAGE = 20;

interface SearchQuery {
  q?: string;
  name?: string;
  tmdb?: string;
  mode?: string;
  exact?: string;
  page?: string;
  lang?: string;
  showBlocked?: string;
  type?: string;
  limit?: string;
  /** Filmographie : le type Jellyfin du crédit par lequel Tentacle arrive. */
  role?: string;
}

function readLang(raw: string | undefined): string {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): Promise<void> {
  async function context(): Promise<SearchContext | null> {
    const cfg = await getWorkerConfig();
    return cfg ? { db, cfg } : null;
  }

  // L'index et les statuts se chargent dès le démarrage : la première recherche
  // après un redémarrage n'a pas à les attendre, ni à se passer de correction.
  void context().then((ctx) => { if (ctx) warmSearch(ctx); }).catch(() => undefined);

  app.get("/search", async (request, reply) => {
    const startedAt = Date.now();
    const query = request.query as SearchQuery;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const opts: SearchOptions = {
      lang: readLang(query.lang),
      page: Math.min(Math.max(1, Number(query.page) || 1), MAX_PAGE),
      showBlocked: query.showBlocked === "1",
      exact: query.exact === "1",
    };
    const instant = query.mode === "instant";
    const ranked = instant ? instantSearch(ctx, q, opts) : await fullSearch(ctx, q, opts);
    const facets = opts.page === 1 && q.trim().length >= 2
      ? [...genreFacets(q, opts.lang), ...(await providerFacets(ctx.cfg, q, opts.lang, !instant))]
      : [];
    return presentHub(ranked, opts.page, facets, titleIndexBuilding(), startedAt, opts.showBlocked);
  });

  app.get("/search/provider", async (request, reply) => {
    const query = request.query as SearchQuery;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const lang = readLang(query.lang);
    const type = query.type === "movie" || query.type === "series" ? query.type : null;
    const limit = Math.min(Math.max(1, Number(query.limit) || 8), 20);
    const opts: SearchOptions = { lang, page: 1, showBlocked: false };
    const ranked = fullIfReady(ctx, q, opts) ?? instantSearch(ctx, q, opts);
    return presentProvider(ranked, type, limit, lang, todayIso());
  });

  app.get("/search/person", async (request, reply) => {
    const query = request.query as SearchQuery;
    const name = (query.name ?? "").trim().slice(0, MAX_QUERY);
    const tmdb = Number(query.tmdb);
    const tmdbId = Number.isInteger(tmdb) && tmdb > 0 ? tmdb : null;
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const empty = { query: name, correction: null, complete: true, items: [], moreHref: null };
    if (!name && tmdbId === null) return empty;
    try {
      return await personProvider(ctx.cfg, {
        name,
        tmdbId,
        lang: readLang(query.lang),
        limit: Math.min(Math.max(1, Number(query.limit) || 20), 40),
        type: query.type === "movie" || query.type === "series" ? query.type : null,
        role: readRole(query.role),
      });
    } catch {
      // Jellyseerr injoignable : la filmographie de Tentacle s'affiche sans nous.
      return empty;
    }
  });

  app.get("/search/collection", async (request, reply) => {
    const query = request.query as SearchQuery;
    const tmdb = Number(query.tmdb);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const empty = { query: String(query.tmdb ?? ""), correction: null, complete: true, items: [], moreHref: null };
    if (!Number.isInteger(tmdb) || tmdb <= 0) return empty;
    try {
      return await collectionProvider(ctx.cfg, {
        collectionId: tmdb,
        lang: readLang(query.lang),
        limit: Math.min(Math.max(1, Number(query.limit) || 20), 40),
        today: todayIso(),
      });
    } catch {
      // Jellyseerr injoignable : la saga de Tentacle s'affiche sans nous.
      return empty;
    }
  });
}
