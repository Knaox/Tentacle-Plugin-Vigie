/* ------------------------------------------------------------------ */
/*  Seer Plugin — Request routes (création, suppression) + sous-modules */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import {
  getRequestById,
  enqueueCleanup,
  updateRequestStatus,
  addSeasonsToRequest,
} from "./db";
import type { CreateRequestBody } from "./types";
import { invalidateRequestCaches } from "./cache";
import { kickWorkerNow } from "./worker";
import { getUser, type WorkerCfg, parseRequestId } from "./seerr-unified";
import { deleteSeerrOnlyRequest } from "./request-delete-seerr";
import { registerRequestReadRoutes } from "./routes-requests-read";
import { registerRequestActionRoutes } from "./routes-requests-actions";
import { registerRequestForgetRoute } from "./routes-requests-forget";
import { submitRequest } from "./request-submit";

export function registerRequestRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  registerRequestReadRoutes(app, db, getWorkerConfig);
  registerRequestActionRoutes(app, db, getWorkerConfig);
  registerRequestForgetRoute(app, db, getWorkerConfig);

  /* ── POST /requests — les règles du compte, puis la file (request-submit.ts) ── */
  app.post("/requests", async (request, reply) => {
    const result = await submitRequest(db, getWorkerConfig, getUser(request), request.body as CreateRequestBody);
    return reply.status(result.status).send(result.body);
  });

  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[]; deleteFiles?: boolean } | null) ?? {};
    const deleteFiles = body.deleteFiles === true; // défaut: false (juste Jellyseerr)
    const parsed = parseRequestId(id);

    if (parsed.kind === "local") {
      const req = await getRequestById(db, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }

      // Suppression « douce » : on route TOUT (film, série entière, saison) via la
      // cleanup queue. Le worker désactive la surveillance *arr (+ supprime les
      // fichiers si deleteFiles) sans jamais retirer la série/le film.
      const reqSeasons = req.seasons ?? [];
      const isSeasonSpecific = req.mediaType === "tv" && !!body.seasons && body.seasons.length > 0;
      // Défense : une suppression TV ne doit JAMAIS dépasser les saisons de CETTE
      // demande. Si aucune saison précise n'est fournie, on retombe sur les saisons
      // de la demande (et non sur « toute la série »). null seulement pour les films
      // ou les demandes TV sans saisons enregistrées (legacy).
      const removing = isSeasonSpecific
        ? body.seasons!
        : (req.mediaType === "tv" && reqSeasons.length > 0 ? reqSeasons : null);
      const remaining = isSeasonSpecific ? reqSeasons.filter((s) => !removing!.includes(s)) : [];
      // Partiel = on retire certaines saisons mais d'autres restent suivies.
      const partial = isSeasonSpecific && remaining.length > 0;

      await enqueueCleanup(db, {
        action: "delete", mediaType: req.mediaType, tmdbId: req.tmdbId, title: req.title,
        // En partiel on préserve la demande Jellyseerr et la ligne locale
        // (les saisons conservées restent suivies) ; on agit uniquement sur *arr.
        seerrRequestId: partial ? null : req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles,
        seasons: removing,
        requestId: partial ? null : parsed.id,
        // Propriétaire réel : un admin peut supprimer la demande d'un tiers,
        // et c'est SON cache à lui qu'il faut invalider, pas celui de tout le monde.
        jellyfinUserId: req.jellyfinUserId,
      });

      if (partial) {
        await addSeasonsToRequest(db, parsed.id, remaining);
      } else {
        await updateRequestStatus(db, parsed.id, "deleting");
      }
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return { success: true, status: partial ? "updated" : "deleting" };
    }

    // ── Demande venant directement de Jellyseerr (pas de pendant local) ──
    const config = await getWorkerConfig();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });

    const done = await deleteSeerrOnlyRequest(db, config, user, parsed.seerrId, { seasons: body.seasons, deleteFiles });
    if (!done.ok) return reply.status(done.code).send({ message: done.message });
    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return { success: true, status: done.status };
  });

}
