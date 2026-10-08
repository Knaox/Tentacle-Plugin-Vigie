/* ------------------------------------------------------------------ */
/*  Seer Plugin — Admin user management routes                         */
/* ------------------------------------------------------------------ */

/*
 * La liste des comptes et leurs permissions. La synchro vit dans
 * routes-user-sync.ts, la réattribution des demandes dans routes-ownership.ts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import { getOrCreateUserSettings, getUserSettings, updateUserSettings } from "./db";
import { buildUsersOverview } from "./users-overview";

type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

interface UpdateUserBody {
  blocked?: boolean;
  /** `null` : le plafond par défaut ; `-1` : illimité ; sinon un plafond propre. */
  dailyLimit?: number | string | null;
  allowMovies?: boolean;
  allowTv?: boolean;
  allowAnime?: boolean;
  username?: string;
}

/**
 * Le plafond saisi, remis en forme. Vide ou 0 : le plafond par défaut
 * (`null`) ; négatif : illimité (`-1`) ; sinon un entier positif.
 */
export function normalizeDailyLimit(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n === 0) return null;
  return n < 0 ? -1 : n;
}

export function registerUsersRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
  getDefaultDailyLimit: () => number | null,
): void {

  app.get("/admin/users", { preHandler: requireAdmin }, async () => {
    const cfg = await getWorkerConfig();
    return buildUsersOverview(
      db,
      cfg ? { seerrUrl: cfg.seerrUrl, seerrApiKey: cfg.seerrApiKey } : null,
      { dailyLimit: getDefaultDailyLimit() },
    );
  });

  app.put("/admin/users/:jellyfinUserId", { preHandler: requireAdmin }, async (request) => {
    const { jellyfinUserId } = request.params as { jellyfinUserId: string };
    const body = (request.body as UpdateUserBody) ?? {};

    // La ligne n'existe pas encore (compte jamais synchronisé) : on la crée, au
    // nom transmis par la page plutôt qu'à l'identifiant brut.
    const current = await getUserSettings(db, jellyfinUserId);
    if (!current) {
      const name = (typeof body.username === "string" && body.username.trim()) || jellyfinUserId;
      await getOrCreateUserSettings(db, jellyfinUserId, name);
    }

    await updateUserSettings(db, jellyfinUserId, {
      blocked: body.blocked,
      dailyLimit: normalizeDailyLimit(body.dailyLimit),
      allowMovies: body.allowMovies,
      allowTv: body.allowTv,
      allowAnime: body.allowAnime,
    });
    return getUserSettings(db, jellyfinUserId);
  });
}
