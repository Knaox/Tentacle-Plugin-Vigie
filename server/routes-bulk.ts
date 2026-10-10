/* ------------------------------------------------------------------ */
/*  Seer Plugin — Bulk action routes (delete, retry)                   */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  getRequestById, createRequest, deleteRequestById,
  enqueueCleanup, updateRequestStatus,
} from "./db";
import { kickWorkerNow } from "./worker";
import { originOf } from "./titles/request-origin";
import { parseRequestId } from "./seerr-unified";
import { deleteSeerrOnlyRequest } from "./request-delete-seerr";

interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

function getUser(request: FastifyRequest): JellyfinUser {
  return (request as any).user;
}

export function registerBulkRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<{ seerrUrl: string; seerrApiKey: string } | null>,
): void {

  app.post("/requests/bulk-delete", async (request, reply) => {
    const user = getUser(request);
    const body = request.body as { ids: string[] };
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }

    let deleted = 0;
    let errors = 0;

    for (const id of body.ids.slice(0, 50)) {
      try {
        const parsed = parseRequestId(id);
        if (parsed.kind === "seerr") {
          // Née dans Jellyseerr, sans ligne locale : comme la suppression d'une demande.
          const config = await getWorkerConfig();
          const done = config
            ? await deleteSeerrOnlyRequest(prisma, config, user, parsed.seerrId, { deleteFiles: false })
            : null;
          if (done?.ok) deleted++; else errors++;
          continue;
        }
        const req = await getRequestById(prisma, id);
        if (!req) { errors++; continue; }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) { errors++; continue; }
        if (req.status === "deleting" || req.status === "processing") { errors++; continue; }

        await updateRequestStatus(prisma, id, "deleting");
        await enqueueCleanup(prisma, {
          action: "delete", mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
          seerrRequestId: req.seerrRequestId, seerrMediaId: req.seerrMediaId,
          // Cohérent avec la suppression unitaire : on arrête le suivi sans
          // supprimer les fichiers (lib partagée). Scopé aux saisons de la demande
          // pour ne jamais toucher d'autres saisons de la série.
          deleteFiles: false,
          seasons: req.mediaType === "tv" && req.seasons && req.seasons.length > 0 ? req.seasons : null,
          requestId: id,
          jellyfinUserId: req.jellyfinUserId,
        });
        deleted++;
      } catch { errors++; }
    }

    if (deleted > 0) kickWorkerNow();
    return { success: true, deleted, errors };
  });

  app.post("/requests/bulk-retry", async (request, reply) => {
    const user = getUser(request);
    const body = request.body as { ids: string[]; profileId?: string | null };
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }

    const newProfileId = body.profileId;
    const config = await getWorkerConfig();
    let retried = 0;
    let errors = 0;

    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(prisma, id);
        if (!req) { errors++; continue; }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) { errors++; continue; }
        if (["deleting", "processing", "available"].includes(req.status)) { errors++; continue; }

        // Supprimer request + media Seerr (PAS Sonarr/Radarr)
        if (config) {
          if (req.seerrRequestId) {
            await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
              method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(10_000),
            }).catch(() => {});
          }
          if (req.seerrMediaId) {
            await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
              method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(10_000),
            }).catch(() => {});
          }
        }

        await deleteRequestById(prisma, id);

        const newReq = await createRequest(prisma, {
          jellyfinUserId: req.jellyfinUserId, username: req.username,
          mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
          posterPath: req.posterPath, backdropPath: req.backdropPath,
          overview: req.overview, year: req.year, seasons: req.seasons, priority: 1,
          profileId: newProfileId !== undefined ? newProfileId : req.profileId,
          origin: originOf(req),
        });

        retried++;
      } catch { errors++; }
    }

    if (retried > 0) kickWorkerNow();
    return { success: true, retried, errors };
  });
}
