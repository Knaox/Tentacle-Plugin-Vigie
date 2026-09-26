/* ------------------------------------------------------------------ */
/*  Vigie — Routes de la synchro des comptes                            */
/* ------------------------------------------------------------------ */

/*
 * Synchroniser maintenant, créer les comptes Jellyseerr qui manquent, et les
 * trois décisions que la synchro ne prend jamais seule : relier un compte,
 * oublier un compte supprimé de Jellyfin, supprimer un compte Jellyseerr.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getUserSettings } from "./db";
import { deleteJellyseerrUser, resolveJellyseerrUserId, SeerrAccountError } from "./jellyseerr-user";
import { fetchJellyfinAccounts, normalizeJellyfinId } from "./jellyfin-users";
import { runUserSync } from "./user-sync";
import { invalidateRequestCaches } from "./cache";

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };
type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

/** Le compte n°1 de Jellyseerr est son propriétaire (cf. user-sync-plan.ts). */
const SEERR_OWNER_ID = 1;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function registerUserSyncRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: Guard,
): void {
  const seerCfg = async (): Promise<WorkerCfg | null> => {
    const cfg = await getWorkerConfig();
    return cfg ? { seerrUrl: cfg.seerrUrl, seerrApiKey: cfg.seerrApiKey } : null;
  };

  /* Synchroniser maintenant — et, sur demande, créer les comptes Jellyseerr
   * qui manquent (tous, ou ceux listés). */
  app.post("/admin/users/sync", { preHandler: requireAdmin }, async (request) => {
    const body = (request.body ?? {}) as { importMissing?: boolean | string[] };
    const importMissing = Array.isArray(body.importMissing)
      ? body.importMissing.filter((id): id is string => typeof id === "string")
      : body.importMissing === true;
    return runUserSync(prisma, await seerCfg(), { trigger: "manual", importMissing });
  });

  /* Relier un compte à Jellyseerr : retrouvé, rattaché, ou créé. */
  app.post("/admin/users/:jellyfinUserId/link", { preHandler: requireAdmin }, async (request, reply) => {
    const cfg = await seerCfg();
    if (!cfg) return reply.status(503).send({ message: "Jellyseerr n'est pas configuré" });
    const { jellyfinUserId } = request.params as { jellyfinUserId: string };
    const settings = await getUserSettings(prisma, jellyfinUserId);
    const account = (await fetchJellyfinAccounts(prisma).catch(() => []))
      .find((a) => normalizeJellyfinId(a.id) === normalizeJellyfinId(jellyfinUserId));
    try {
      const seerrId = await resolveJellyseerrUserId(
        cfg, prisma, jellyfinUserId, account?.name || settings?.username || jellyfinUserId,
      );
      invalidateRequestCaches(jellyfinUserId);
      return { seerrId };
    } catch (err) {
      // Une cause connue a sa phrase traduite côté page (clé i18n), et le détail brut reste dans `message`.
      const errorKey = err instanceof SeerrAccountError ? `seer:admErr_${err.code.replace(/-/g, "_")}` : undefined;
      return reply.status(502).send({ message: errorText(err), errorKey });
    }
  });

  /* Oublier un compte : ses permissions partent, son historique reste. Refusé
   * tant que le compte existe dans Jellyfin — la synchro le recréerait. */
  app.delete("/admin/users/:jellyfinUserId", { preHandler: requireAdmin }, async (request, reply) => {
    const { jellyfinUserId } = request.params as { jellyfinUserId: string };
    let accounts;
    try {
      accounts = await fetchJellyfinAccounts(prisma);
    } catch (err) {
      return reply.status(503).send({ message: `Jellyfin injoignable : ${errorText(err)}` });
    }
    if (accounts.some((a) => normalizeJellyfinId(a.id) === normalizeJellyfinId(jellyfinUserId))) {
      return reply.status(409).send({ message: "Ce compte existe encore dans Jellyfin" });
    }
    await prisma.$executeRawUnsafe(`DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`, jellyfinUserId);
    invalidateRequestCaches(jellyfinUserId);
    return { ok: true };
  });

  /* Supprimer un compte Jellyseerr — et, avec lui, SES demandes dans
   * Jellyseerr. Jamais le propriétaire, jamais un compte encore relié à un
   * compte Jellyfin vivant. */
  app.delete("/admin/seerr-users/:seerrId", { preHandler: requireAdmin }, async (request, reply) => {
    const cfg = await seerCfg();
    if (!cfg) return reply.status(503).send({ message: "Jellyseerr n'est pas configuré" });
    const seerrId = Number((request.params as { seerrId: string }).seerrId);
    if (!Number.isInteger(seerrId) || seerrId <= 0) return reply.status(400).send({ message: "Identifiant invalide" });
    if (seerrId === SEERR_OWNER_ID) return reply.status(403).send({ message: "Le propriétaire de Jellyseerr ne se supprime pas" });

    const linked = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string }>>(
      `SELECT jellyfin_user_id FROM seer_user_settings WHERE jellyseerr_user_id = ?`, seerrId,
    );
    if (linked.length > 0) {
      const alive = new Set((await fetchJellyfinAccounts(prisma).catch(() => [])).map((a) => normalizeJellyfinId(a.id)));
      if (linked.some((l) => alive.has(normalizeJellyfinId(l.jellyfin_user_id)))) {
        return reply.status(409).send({ message: "Ce compte Jellyseerr sert encore un compte Jellyfin" });
      }
    }
    try {
      await deleteJellyseerrUser(cfg, seerrId);
    } catch (err) {
      return reply.status(502).send({ message: errorText(err) });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE seer_user_settings SET jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyseerr_user_id = ?`,
      seerrId,
    );
    invalidateRequestCaches();
    return { ok: true };
  });
}
