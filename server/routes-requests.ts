/* ------------------------------------------------------------------ */
/*  Seer Plugin — Request routes (création, suppression) + sous-modules */
/* ------------------------------------------------------------------ */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  getRequestById,
  enqueueCleanup,
  updateRequestStatus,
  addSeasonsToRequest,
} from "./db";
import type { CreateRequestBody } from "./types";
import { invalidateRequestCaches } from "./cache";
import { kickWorkerNow } from "./worker";
import { getUser, type WorkerCfg, parseRequestId, fetchSeerrRequestById } from "./seerr-unified";
import { registerRequestReadRoutes } from "./routes-requests-read";
import { registerRequestActionRoutes } from "./routes-requests-actions";
import { registerRequestForgetRoute } from "./routes-requests-forget";
import { submitRequest } from "./request-submit";

export function registerRequestRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  registerRequestReadRoutes(app, prisma, getWorkerConfig);
  registerRequestActionRoutes(app, prisma, getWorkerConfig);
  registerRequestForgetRoute(app, prisma, getWorkerConfig);

  /* ── POST /requests — les règles du compte, puis la file (request-submit.ts) ── */
  app.post("/requests", async (request, reply) => {
    const result = await submitRequest(prisma, getWorkerConfig, getUser(request), request.body as CreateRequestBody);
    return reply.status(result.status).send(result.body);
  });

  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = (request.body as { seasons?: number[]; deleteFiles?: boolean } | null) ?? {};
    const deleteFiles = body.deleteFiles === true; // défaut: false (juste Jellyseerr)
    const parsed = parseRequestId(id);

    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
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

      await enqueueCleanup(prisma, {
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
        await addSeasonsToRequest(prisma, parsed.id, remaining);
      } else {
        await updateRequestStatus(prisma, parsed.id, "deleting");
      }
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return { success: true, status: partial ? "updated" : "deleting" };
    }

    // ── Demande venant directement de Jellyseerr (pas de pendant local) ──
    const config = await getWorkerConfig();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });

    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });

    // Verrou ownership : on compare via seer_user_settings.jellyseerr_user_id
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe<Array<{ jellyseerr_user_id: number | null }>>(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId,
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }

    // Même logique de partiel que la branche locale : retirer certaines
    // saisons d'une demande Jellyseerr n'efface PAS la demande entière —
    // la réconciliation du worker l'édite (PUT saisons restantes).
    const seerrMediaType = seerrReq.media?.mediaType ?? "movie";
    const seerrSeasons = (seerrReq.seasons ?? [])
      .map((s) => s.seasonNumber)
      .filter((n) => typeof n === "number");
    const isSeasonSpecific = seerrMediaType === "tv" && !!body.seasons && body.seasons.length > 0;
    const removing = isSeasonSpecific
      ? body.seasons!
      : (seerrMediaType === "tv" && seerrSeasons.length > 0 ? seerrSeasons : null);
    const remaining = isSeasonSpecific ? seerrSeasons.filter((s) => !removing!.includes(s)) : [];
    const partial = isSeasonSpecific && remaining.length > 0;

    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: seerrMediaType,
      tmdbId: seerrReq.media?.tmdbId ?? 0,
      title: `#${seerrReq.id}`,
      seerrRequestId: partial ? null : seerrReq.id,
      seerrMediaId: seerrReq.media?.id ?? null,
      deleteFiles,
      seasons: removing,
      requestId: null,
      jellyfinUserId: user.userId,
    });

    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return { success: true, status: partial ? "updated" : "deleting" };
  });

}
