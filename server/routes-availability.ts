/* ------------------------------------------------------------------ */
/*  Seer Plugin — Route groupée de disponibilité                       */
/* ------------------------------------------------------------------ */

/*
 * La liste du catalogue ne porte pas les dates de sortie typées : il faut la
 * fiche détaillée. Un appel par carte ferait 20 requêtes par écran — hors de
 * question. On groupe donc : une seule requête pour tout un écran, servie
 * depuis la mémoire durable des fiches (tmdb-cache) la plupart du temps.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { WorkerCfg } from "./seerr-unified";
import type { TmdbRef } from "./tmdb-cache";
import { tmdbKey } from "./tmdb-cache";
import { resolveTmdbMeta, scheduleTmdbBackfill, DEFAULT_REGION } from "./tmdb-resolver";
import { classifyAvailability, type AvailabilityVerdict } from "./availability";
import { gapsOf, partialSeriesSeasons, type SeriesGaps } from "./series-gaps";

/*
 * Plafond de sécurité. La grille défile à l'infini et envoie sa liste ENTIÈRE
 * à chaque page chargée : au-delà, les cartes n'auraient plus de pastille du
 * tout. Soixante ne tenait plus dès la troisième page — d'où ce doublement, et
 * surtout la trace quand on coupe : une troncature muette se lit comme une
 * couverture complète.
 */
const MAX_ITEMS = 120;
/** Fiches récupérées en direct par appel : le reste part en tâche de fond. */
const FETCH_BUDGET = 12;

interface Body {
  items?: Array<{ mediaType?: string; tmdbId?: number }>;
  region?: string;
}

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {

  app.post("/availability", async (request) => {
    const body = (request.body ?? {}) as Body;
    const asked = Array.isArray(body.items) ? body.items : [];
    const raw = asked.slice(0, MAX_ITEMS);
    if (asked.length > MAX_ITEMS) {
      console.warn(`[Seer] /availability : ${asked.length} titres demandés, ${MAX_ITEMS} traités`);
    }

    const refs: TmdbRef[] = [];
    for (const it of raw) {
      const tmdbId = Number(it?.tmdbId);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      refs.push({ mediaType: it.mediaType, tmdbId });
    }
    if (refs.length === 0) return { results: [] as AvailabilityVerdict[] };

    const config = await getWorkerConfig();
    const region = typeof body.region === "string" && /^[a-z]{2}$/i.test(body.region)
      ? body.region.toUpperCase()
      : DEFAULT_REGION;

    const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, {
      maxFetch: FETCH_BUDGET,
      region,
    });

    // Ce qui reste sera là au prochain passage : la grille n'attend pas.
    if (missing.length > 0) scheduleTmdbBackfill(prisma, config, missing, region);

    const results: AvailabilityVerdict[] = [];
    for (const ref of refs) {
      const m = meta.get(tmdbKey(ref));
      if (m) results.push(classifyAvailability(m));
    }

    return { results, pending: missing.length };
  });

  /*
   * Ce qui manque à chaque série en partie là — des saisons entières, des
   * épisodes de certaines — pour tout le serveur d'un coup : une soixantaine
   * d'entrées de deux listes de numéros, que chaque affiche lit sans appel.
   */
  app.get("/series/gaps", async () => {
    const seasons = await partialSeriesSeasons(await getWorkerConfig());
    const items: Record<string, SeriesGaps> = {};
    for (const [tmdbId, states] of seasons) {
      const gaps = gapsOf(states);
      if (gaps) items[tmdbId] = gaps;
    }
    return { items };
  });
}
