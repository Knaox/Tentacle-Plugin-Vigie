/* ------------------------------------------------------------------ */
/*  Seer Plugin — Admin user management routes                         */
/* ------------------------------------------------------------------ */

/* La réattribution des demandes à leurs auteurs vit dans routes-ownership.ts. */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { listUsersWithStats, listJellyfinUsersWithStats, getOrCreateUserSettings, getUserSettings, updateUserSettings } from "./db";
import {
  resolveJellyseerrUserId,
  listAllJellyseerrUsers,
  invalidateStaleJellyseerrCache,
} from "./jellyseerr-user";
import { fetchJellyfinAccounts } from "./jellyfin-users";

interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

interface UpdateUserBody {
  blocked?: boolean;
  dailyLimit?: number | null;
  allowMovies?: boolean;
  allowTv?: boolean;
  allowAnime?: boolean;
}

export function registerUsersRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {

  app.get(
    "/admin/users",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      // Source autoritative : la liste réelle des users Jellyfin (jamais la DB locale seule).
      // Fallback : les users Jellyseerr ayant un jellyfinUserId (= déjà importés depuis Jellyfin).
      const config = await getWorkerConfig();

      let jellyfinUsers: Array<{ id: string; name: string }> = [];
      let jellyfinError: string | null = null;
      try {
        jellyfinUsers = await fetchJellyfinUsers(prisma);
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }

      // Compléter / fallback via Jellyseerr (users avec jellyfinUserId)
      if (config) {
        try {
          const seerUsers = await listAllJellyseerrUsers(config);
          const known = new Set(jellyfinUsers.map((u) => u.id));
          for (const su of seerUsers) {
            if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
            jellyfinUsers.push({
              id: su.jellyfinUserId,
              name: su.jellyfinUsername || su.username || su.jellyfinUserId,
            });
          }
        } catch { /* Jellyseerr inaccessible — on continue avec Jellyfin si on l'a */ }
      }

      if (jellyfinUsers.length === 0) {
        return reply.status(503).send({
          message: jellyfinError
            ? `Cannot list Jellyfin users: ${jellyfinError}`
            : "No source available to list Jellyfin users",
        });
      }

      // Pour chaque vrai user Jellyfin, charge (ou crée) les settings + stats
      return await listJellyfinUsersWithStats(prisma, jellyfinUsers);
    },
  );

  app.put(
    "/admin/users/:jellyfinUserId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jellyfinUserId } = request.params as { jellyfinUserId: string };
      const body = (request.body as UpdateUserBody) ?? {};

      // S'assure que la row existe SANS écraser le username existant
      const current = await getUserSettings(prisma, jellyfinUserId);
      const usernameForCreation = current?.username || jellyfinUserId;
      const existing = await getOrCreateUserSettings(prisma, jellyfinUserId, usernameForCreation);

      // Normalisation dailyLimit : 0/empty/string-vide → null
      let dailyLimit: number | null | undefined = body.dailyLimit;
      if (dailyLimit === 0 || (typeof dailyLimit === "string" && (dailyLimit as string) === "")) {
        dailyLimit = null;
      }
      if (typeof dailyLimit === "number" && Number.isNaN(dailyLimit)) dailyLimit = null;

      await updateUserSettings(prisma, jellyfinUserId, {
        blocked: body.blocked,
        dailyLimit,
        allowMovies: body.allowMovies,
        allowTv: body.allowTv,
        allowAnime: body.allowAnime,
      });

      // Renvoie la liste fraîche pour resync UI
      const all = await listUsersWithStats(prisma);
      const updated = all.find((u) => u.jellyfinUserId === jellyfinUserId);
      return updated ?? existing;
    },
  );

  app.post(
    "/admin/users/sync",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });

      // 0) Invalide les jellyseerr_user_id cachés qui ne pointent plus vers un user existant
      //    (ex: l'admin a supprimé le user côté Jellyseerr depuis la dernière sync)
      let invalidatedLinks = 0;
      try {
        invalidatedLinks = await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
        // Si l'API user Jellyseerr est en panne, on passe l'étape — non bloquant
      }

      // 1) Tente d'abord l'API admin Jellyfin (source la plus complète)
      let users: Array<{ id: string; name: string }> = [];
      let jellyfinError: string | null = null;
      try {
        users = await fetchJellyfinUsers(prisma);
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }

      // 2) Fallback / complément : liste les users Jellyseerr (qui ont chacun un jellyfinUserId)
      try {
        const seerUsers = await listAllJellyseerrUsers(config);
        const known = new Set(users.map((u) => u.id));
        for (const su of seerUsers) {
          if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
          users.push({
            id: su.jellyfinUserId,
            name: su.jellyfinUsername || su.username || su.jellyfinUserId,
          });
        }
      } catch {
        // Si Jellyseerr aussi échoue ET que Jellyfin a échoué, on relance l'erreur Jellyfin
        if (jellyfinError && users.length === 0) {
          return reply.status(503).send({ message: `Sync failed: ${jellyfinError}` });
        }
      }

      // 3) Crée une row seer_user_settings pour chacun (idempotent) — répare aussi les usernames
      //    précédemment corrompus (ex: stockés comme UUID Jellyfin si lookup avait échoué)
      let created = 0;
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      for (const u of users) {
        const existing = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string; username: string }>>(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
          u.id,
        );
        if (existing.length === 0) {
          created++;
          await getOrCreateUserSettings(prisma, u.id, u.name);
        } else if (u.name && u.name !== u.id && (
          isUuid.test(existing[0].username) || existing[0].username === u.id
        )) {
          // Répare un username qui est en fait un UUID
          await updateUserSettings(prisma, u.id, { username: u.name });
        }
      }

      // 4) Pour chaque user connu, tente le lookup/import Jellyseerr
      const all = await listUsersWithStats(prisma);
      let synced = 0;
      let failed = 0;
      for (const u of all) {
        try {
          await resolveJellyseerrUserId(config, prisma, u.jellyfinUserId, u.username);
          synced++;
        } catch {
          failed++;
        }
      }

      // 5) Nettoyage : retire les rows seer_user_settings dont le user n'existe plus
      //    NI côté Jellyfin NI côté Jellyseerr ET qui n'a aucune demande locale active.
      //    On garde les demandes pour la traçabilité — seule la row settings est supprimée.
      const aliveIds = new Set<string>(users.map((u) => u.id));
      let removed = 0;
      const allSettings = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string }>>(
        `SELECT jellyfin_user_id FROM seer_user_settings`,
      );
      for (const row of allSettings) {
        if (aliveIds.has(row.jellyfin_user_id)) continue;
        const hasReqs = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
          `SELECT COUNT(*) AS cnt FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status NOT IN ('deleted','delete_failed')`,
          row.jellyfin_user_id,
        );
        if (Number(hasReqs[0]?.cnt ?? 0) === 0) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`,
            row.jellyfin_user_id,
          );
          removed++;
        }
      }

      return {
        synced, failed, created, removed, invalidatedLinks,
        total: all.length,
        jellyfinAdminOk: jellyfinError === null,
      };
    },
  );

}

/**
 * Les comptes Jellyfin actifs, lus avec l'adresse et la clé que le serveur
 * Tentacle garde dans sa configuration (cf. jellyfin-users.ts) — plus dans
 * des variables d'environnement qu'il ne fournit plus.
 */
async function fetchJellyfinUsers(prisma: PrismaClient): Promise<Array<{ id: string; name: string }>> {
  const accounts = await fetchJellyfinAccounts(prisma);
  return accounts.filter((a) => !a.isDisabled).map((a) => ({ id: a.id, name: a.name }));
}
