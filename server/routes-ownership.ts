/* ------------------------------------------------------------------ */
/*  Vigie — Réattribuer les demandes à leurs vrais auteurs              */
/* ------------------------------------------------------------------ */

/* Extrait de routes-users.ts pour tenir sous 300 lignes. L'outil avancé de la
 * page d'administration : il ne tourne jamais tout seul. */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { updateUserSettings } from "./db";
import {
  resolveJellyseerrUserId,
  createPlaceholderJellyseerrUser,
  invalidateStaleJellyseerrCache,
} from "./jellyseerr-user";
import { invalidateRequestCaches } from "./cache";
import { pickBestUsernameFor, reassignSeerrRequestOwnership } from "./seerr-ownership";

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

export function registerOwnershipRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  /* ────────────────────────────────────────────────────────────────
   * POST /admin/sync-requests-ownership
   * Pour chaque demande locale ayant un seerr_request_id, vérifie que
   * le propriétaire Jellyseerr correspond au demandeur Jellyfin.
   * Si non, tente :
   *   - PUT /api/v1/request/{id} avec userId: cible
   *   - sinon DELETE + POST avec userId: cible (sans toucher au media)
   *
   * Si le user Jellyfin n'existe plus (import-from-jellyfin échoue),
   * on crée un user "placeholder" Jellyseerr (username local) pour
   * conserver la trace. Quand l'user recrée son compte Jellyfin avec
   * le même username, resolveJellyseerrUserId réconciliera ce placeholder.
   * ──────────────────────────────────────────────────────────────── */
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });

      // 0) Invalide les jellyseerr_user_id cachés morts (user supprimé côté Jellyseerr).
      //    Sans ça, resolveJellyseerrUserId retournerait un ID stale et tout le sync
      //    pointerait vers un user inexistant.
      try {
        await invalidateStaleJellyseerrCache(config, prisma);
      } catch { /* non bloquant */ }

      let alreadyOk = 0;
      let reassigned = 0;
      let recreated = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = new Set<string>();
      const errors: Array<{ requestId: string; reason: string }> = [];

      // 1) Liste toutes les demandes locales avec un seerr_request_id
      const rows = await prisma.$queryRawUnsafe<Array<{
        id: string; jellyfin_user_id: string; username: string;
        seerr_request_id: number | null; seerr_media_id: number | null;
        media_type: string; tmdb_id: number; seasons: unknown;
      }>>(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id, seasons
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`,
      );

      // 2) Pour chaque user distinct, déterminer son meilleur username (priorité au plus
      //    récent et qui ne ressemble PAS à un UUID Jellyfin — préserve un placeholder
      //    propre quand le compte Jellyfin a été supprimé).
      const distinctUsers = new Map<string, string>();
      for (const r of rows) {
        if (distinctUsers.has(r.jellyfin_user_id)) continue;
        const best = await pickBestUsernameFor(prisma, r.jellyfin_user_id, r.username);
        distinctUsers.set(r.jellyfin_user_id, best);
      }

      // 3) Résoudre tous les jellyseerrUserId cibles
      const targetByJellyfin = new Map<string, number>();
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          // User Jellyfin probablement supprimé → créer un placeholder avec le vrai username
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(prisma, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: new Date(),
              username: jfUsername,
            });
            targetByJellyfin.set(jfUserId, placeholder.id);
            orphansCreated++;
          } catch (err) {
            errors.push({
              requestId: jfUserId,
              reason: err instanceof Error ? err.message : "placeholder creation failed",
            });
          }
        }
      }

      // 4) Pour chaque request, comparer et réassigner OU recréer si manquante côté Jellyseerr
      for (const r of rows) {
        if (!r.seerr_request_id) continue;
        const target = targetByJellyfin.get(r.jellyfin_user_id);
        if (!target) { failed++; continue; }

        // Parse seasons si JSON stocké
        let parsedSeasons: number[] | null = null;
        if (r.seasons) {
          try {
            parsedSeasons = typeof r.seasons === "string"
              ? JSON.parse(r.seasons)
              : (r.seasons as number[]);
          } catch { parsedSeasons = null; }
        }

        try {
          const result = await reassignSeerrRequestOwnership(
            config, r.seerr_request_id, target,
            {
              mediaType: r.media_type as "movie" | "tv",
              tmdbId: r.tmdb_id,
              seasons: parsedSeasons,
            },
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else if (result.method === "create-missing") {
            recreated++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId, r.id,
              );
            }
          } else {
            reassigned++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.method === "recreate" && result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId, r.id,
              );
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            requestId: r.id,
            reason: err instanceof Error ? err.message : "reassign failed",
          });
        }
      }

      // 5) Invalider les caches des users touchés (+ vues partagées)
      for (const uid of usersTouched) invalidateRequestCaches(uid);

      return {
        total: rows.length,
        reassigned,
        recreated,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20), // limiter le payload
      };
    },
  );
}
