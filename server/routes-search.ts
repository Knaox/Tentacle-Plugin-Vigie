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
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { WorkerCfg } from "./seerr-unified";
import { fullIfReady, fullSearch, instantSearch, type SearchContext, type SearchOptions } from "./search/service";
import { presentHub, presentProvider } from "./search/respond";
import { genreFacets, providerFacets } from "./search/facets";
import { titleIndexBuilding } from "./search/title-crawl";
import { ensureSearchTables } from "./search/title-store";

const MAX_QUERY = 120;
const MAX_PAGE = 20;

interface SearchQuery {
  q?: string;
  mode?: string;
  page?: string;
  lang?: string;
  showBlocked?: string;
  type?: string;
  limit?: string;
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
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): Promise<void> {
  await ensureSearchTables(prisma);

  async function context(): Promise<SearchContext | null> {
    const cfg = await getWorkerConfig();
    return cfg ? { prisma, cfg } : null;
  }

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
    };
    const instant = query.mode === "instant";
    const ranked = instant ? instantSearch(ctx, q, opts) : await fullSearch(ctx, q, opts);
    const facets = opts.page === 1 && q.trim().length >= 2
      ? [...genreFacets(q, opts.lang), ...(await providerFacets(ctx.cfg, q, opts.lang, !instant))]
      : [];
    return presentHub(ranked, opts.page, facets, titleIndexBuilding(), startedAt);
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
}
