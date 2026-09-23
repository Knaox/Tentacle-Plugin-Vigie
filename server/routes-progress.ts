/* ------------------------------------------------------------------ */
/*  Seer Plugin — Suivi en direct des téléchargements                  */
/* ------------------------------------------------------------------ */

/*
 * Route volontairement minuscule : elle ne renvoie QUE les demandes dont
 * Sonarr ou Radarr ont quelque chose à dire — ce qui descend, ce qui
 * s'importe, ce qui vient d'arriver — pour pouvoir être rafraîchie souvent
 * sans jamais rejouer le coût de la liste complète.
 *
 * Sonarr et Radarr sont la source de vérité : la file lue en direct (celle
 * que voient les administrateurs), puis les fichiers. Jellyseerr n'est plus
 * attendu pour dire qu'un titre est là (cf. arr-truth.ts).
 *
 * Elle vit sur sa propre clé de cache : un rafraîchissement de progression
 * n'invalide jamais la grosse liste fusionnée.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { DownloadProgress, RequestStatus } from "./types";
import { fetchServerQueue, type QueueResponse } from "./arr-queue";
import { cached } from "./cache";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { hydrateRows } from "./requests-list";
import { loadMergedRows } from "./routes-requests-read";
import { IN_FLIGHT, arrVerdicts } from "./arr-truth";

const PROGRESS_TTL_MS = 10_000;

export interface ProgressItem {
  /** Même identifiant que dans la liste : 'seerr-<n>' ou l'uuid local. */
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  /** Le statut que lui donnent Sonarr et Radarr — il prime sur celui de la liste. */
  status: RequestStatus;
  /** Ce qui descend ou s'importe ; absent quand la demande vient d'arriver. */
  download?: DownloadProgress;
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
      const rows = await loadMergedRows(prisma, config, user, (err, msg) => app.log?.warn?.({ err }, msg));
      /* Les lignes de la liste, telles quelles : mêmes identifiants (le front
       * rattache chaque avancement à sa carte), mêmes saisons demandées. */
      const requests = hydrateRows(rows, new Map(), user).filter((r) => IN_FLIGHT.has(r.status));
      const verdicts = await arrVerdicts(config, requests);

      const items: ProgressItem[] = [];
      for (const r of requests) {
        const verdict = verdicts.get(r.id);
        // Rien qui descende, rien de neuf : rien à suivre.
        if (!verdict || (!verdict.download && verdict.status === r.status)) continue;
        items.push({
          id: r.id,
          tmdbId: r.tmdbId,
          mediaType: r.mediaType,
          status: verdict.status,
          download: verdict.download ?? undefined,
          downloads: verdict.downloads,
        });
      }
      return { updatedAt: new Date().toISOString(), items };
    });
  });
}
