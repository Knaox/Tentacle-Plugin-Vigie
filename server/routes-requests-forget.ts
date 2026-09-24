/* ------------------------------------------------------------------ */
/*  Seer Plugin — Retirer une demande, et rien d'autre                 */
/* ------------------------------------------------------------------ */

/*
 * « À vérifier » : une demande en échec, ou dont la suppression a échoué,
 * encombre la liste. La retirer ne touche NI Jellyfin NI Sonarr/Radarr : pas
 * de fichier supprimé, pas de surveillance désactivée. Seule la demande
 * disparaît — sa fiche de demande dans Jellyseerr (ce que Jellyseerr en
 * supprime n'atteint pas Sonarr ni Radarr) et sa ligne dans la file du
 * plugin. Un nettoyage *arr encore en attente pour elle est abandonné : c'est
 * lui qui toucherait Sonarr.
 *
 * Réservé aux demandes « À vérifier » côté plugin : les autres ont leur
 * suppression complète, qui passe par la file de nettoyage.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { cancelCleanupsForRequest, deleteRequestById, getRequestById } from "./db";
import { invalidateRequestCaches } from "./cache";
import { fetchSeerrRequestById, getUser, parseRequestId, type WorkerCfg } from "./seerr-unified";

/** Les statuts du groupe « À vérifier » (voir `groupOf` côté client). */
const FORGETTABLE = new Set(["failed", "delete_failed"]);

async function deleteSeerrRequest(config: WorkerCfg, seerrRequestId: number): Promise<void> {
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { /* déjà partie, ou Jellyseerr injoignable : la ligne locale part quand même */ });
}

export function registerRequestForgetRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  app.post("/requests/:id/forget", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const parsed = parseRequestId(id);
    const config = await getWorkerConfig();

    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      if (!FORGETTABLE.has(req.status)) {
        return reply.status(409).send({ errorKey: "seer:errNotForgettable", message: "Only requests to check can be removed alone" });
      }
      if (config && req.seerrRequestId) await deleteSeerrRequest(config, req.seerrRequestId);
      await cancelCleanupsForRequest(prisma, parsed.id);
      await deleteRequestById(prisma, parsed.id);
      invalidateRequestCaches(req.jellyfinUserId);
      if (req.jellyfinUserId !== user.userId) invalidateRequestCaches(user.userId);
      return { success: true };
    }

    // Demande venue de Jellyseerr sans pendant local : retirer, c'est supprimer
    // sa fiche de demande — sinon elle reviendrait à la prochaine lecture.
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) {
      invalidateRequestCaches(user.userId);
      return { success: true };
    }
    if (!user.isAdmin) {
      const rows = await prisma.$queryRawUnsafe<Array<{ jellyseerr_user_id: number | null }>>(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId,
      );
      const myId = rows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    await deleteSeerrRequest(config, seerrReq.id);
    invalidateRequestCaches(user.userId);
    return { success: true };
  });
}
