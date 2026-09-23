/* ------------------------------------------------------------------ */
/*  Seer Plugin — Suivi en direct des téléchargements                  */
/* ------------------------------------------------------------------ */

/*
 * Route volontairement minuscule : elle ne renvoie QUE les demandes réellement
 * en cours de téléchargement (zéro à trois lignes en pratique), pour pouvoir
 * être rafraîchie souvent sans jamais rejouer le coût de la liste complète.
 *
 * Elle vit sur sa propre clé de cache : un rafraîchissement de progression
 * n'invalide jamais la grosse liste fusionnée.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { DownloadProgress, RequestStatus } from "./types";
import { blockedDownloadIds, fetchServerQueue, type QueueResponse } from "./arr-queue";
import { cached, peek } from "./cache";
import { getUser, type WorkerCfg, type SeerrRequestRow } from "./seerr-unified";
import { fetchSeerrRequestsPage } from "./seerr-requests-fetch";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { aggregateDownloads } from "./download-progress";
import { resolveRequestStatus } from "./request-status";
import { rowsCacheKey } from "./routes-requests-read";
import type { MergedRows } from "./requests-list";

const PROGRESS_TTL_MS = 10_000;

export interface ProgressItem {
  /** Même identifiant que dans la liste : 'seerr-<n>' ou l'uuid local. */
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  status: RequestStatus;
  download: DownloadProgress;
  downloads?: DownloadProgress[];
}

export function registerProgressRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {

  /* ── Tout ce que le serveur récupère, demandes des autres comprises ──
   *
   * Jellyseerr ne connaît que ses propres demandes : ce qu'un administrateur
   * ajoute directement dans Sonarr ou Radarr n'apparaît nulle part. On lit donc
   * les files en direct — ce qui expose l'activité de TOUT le serveur, d'où le
   * garde d'administration, posé ici et pas seulement dans l'interface. */
  app.get("/downloads", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig();
    const empty: QueueResponse = {
      updatedAt: new Date().toISOString(), items: [], total: 0, unreachable: [],
    };
    if (!config) return empty;

    // Une seule lecture de la file pour tout le monde (cf. arr-queue.ts).
    return fetchServerQueue(config);
  });

  app.get("/requests/progress", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig();
    if (!config) return { updatedAt: new Date().toISOString(), items: [] as ProgressItem[] };

    return cached(`seer-cache:${user.userId}:progress`, PROGRESS_TTL_MS, async () => {
      const rows = await collectActiveRows(prisma, config, user.userId, user.username);

      /* Les identifiants doivent coller à ceux de la liste, sinon le front ne
       * saurait pas à quelle carte rattacher la progression. */
      const localIds = new Map<number, string>();
      const seerrIds = rows.map((r) => r.id).filter((n) => Number.isFinite(n));
      if (seerrIds.length > 0) {
        const placeholders = seerrIds.map(() => "?").join(",");
        const found = await prisma.$queryRawUnsafe<Array<{ id: string; seerr_request_id: number }>>(
          `SELECT id, seerr_request_id FROM seer_requests
           WHERE jellyfin_user_id = ? AND seerr_request_id IN (${placeholders})`,
          user.userId, ...seerrIds,
        ).catch(() => []);
        for (const f of found) localIds.set(Number(f.seerr_request_id), f.id);
      }

      /* Ce que la file *arr dit bloqué (import refusé, source morte) et que
       * Jellyseerr ne relaie pas. Injoignable : on se fie à Jellyseerr seul. */
      const blocked = await blockedDownloadIds(config).catch(() => new Set<string>());

      const items: ProgressItem[] = [];
      for (const sr of rows) {
        const { summary, items: detail } = aggregateDownloads(sr.media?.downloadStatus, (id) => blocked.has(id));
        if (!summary) continue;

        /* Même verdict que la liste : une demande dont toutes les saisons
         * demandées sont arrivées est disponible, même si la série récupère
         * encore des saisons que personne ici n'a demandées. */
        const status = resolveRequestStatus(sr);
        /* Un téléchargement terminé sur une demande déjà disponible n'apprend
         * rien : l'afficher ferait une barre pleine sous un badge « Disponible »,
         * et surtout ferait poller le front pour rien. */
        if (status === "available" && (summary.percent ?? 0) >= 100) continue;

        items.push({
          id: localIds.get(sr.id) ?? `seerr-${sr.id}`,
          tmdbId: sr.media?.tmdbId ?? 0,
          mediaType: (sr.media?.mediaType ?? "movie") as "movie" | "tv",
          status,
          download: summary,
          downloads: detail.length > 1 ? detail : undefined,
        });
      }

      return { updatedAt: new Date().toISOString(), items };
    });
  });
}

/**
 * Un seul appel Jellyseerr : le filtre « processing » couvre l'immense majorité
 * des téléchargements en cours. On complète ensuite SANS appel supplémentaire
 * depuis la liste déjà chargée, pour ne pas rater un média passé en
 * « partiellement disponible » qui continue à récupérer des épisodes.
 */
async function collectActiveRows(
  prisma: PrismaClient,
  config: WorkerCfg,
  userId: string,
  username: string,
): Promise<SeerrRequestRow[]> {
  const out = new Map<number, SeerrRequestRow>();

  try {
    const seerUserId = await resolveJellyseerrUserId(config, prisma, userId, username);
    const page = await fetchSeerrRequestsPage(config, seerUserId, 100, 0, "processing");
    for (const r of page.rows) out.set(r.id, r);
  } catch { /* la liste déjà chargée sert de repli */ }

  const hit = peek<MergedRows>(rowsCacheKey(userId), true);
  if (hit) {
    for (const r of hit.seerrRows) {
      if (out.has(r.id)) continue;
      if ((r.media?.downloadStatus?.length ?? 0) > 0) out.set(r.id, r);
    }
  }

  return Array.from(out.values());
}
