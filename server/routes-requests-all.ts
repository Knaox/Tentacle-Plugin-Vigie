/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes de tous les comptes (administrateur)           */
/* ------------------------------------------------------------------ */

/*
 * « Tous les comptes », dans « Mes demandes » : l'administrateur voit chaque
 * demande du serveur — qui l'a faite, quand, où elle en est —, la cherche par
 * titre ou par compte, et la gère comme les siennes (supprimer, relancer,
 * marquer : les actions acceptent déjà l'administrateur sur la demande d'un
 * autre). Réservé à l'administrateur ici, et pas seulement dans l'interface.
 *
 * Aucune lecture de plus : ce sont les lignes de l'agenda commun, en cache une
 * minute (calendar-everyone.ts).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getAllRequests } from "./db";
import { cached } from "./cache";
import { getUser, localToUnified, type SeerrRequestRow, type WorkerCfg } from "./seerr-unified";
import { hydrateRows, type RequesterOf } from "./requests-list";
import { requestsPage } from "./requests-page";
import { loadEveryoneRows } from "./calendar-everyone";
import { progressOf } from "./routes-progress";

const PROGRESS_TTL_MS = 10_000;

/** Le nom de chaque demandeur : celui que Vigie connaît, sinon celui que Jellyseerr affiche. */
interface SettingsRow { jellyfin_user_id: string; username: string | null; jellyseerr_user_id: number | null }

export async function requesterResolver(prisma: PrismaClient): Promise<RequesterOf> {
  const rows: SettingsRow[] = await prisma.$queryRawUnsafe<SettingsRow[]>(
    `SELECT jellyfin_user_id, username, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`,
  ).catch(() => [] as SettingsRow[]);
  const byId = new Map<number, SettingsRow>(rows.map((r: SettingsRow) => [Number(r.jellyseerr_user_id), r]));
  return (sr: SeerrRequestRow) => {
    const by = sr.requestedBy;
    const known = by ? byId.get(by.id) : undefined;
    return {
      jellyfinUserId: known?.jellyfin_user_id ?? by?.jellyfinUserId ?? "",
      username: known?.username || by?.jellyfinUsername || by?.displayName || by?.username || (by ? `#${by.id}` : "?"),
    };
  };
}

export function registerAllRequestsRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const warn = (err: unknown, msg: string) => app.log?.warn?.({ err }, msg);

  /* ── GET /admin/requests — même page que « Mes demandes », pour tous les
   *    comptes ; la recherche porte aussi sur le demandeur. ── */
  app.get("/admin/requests", { preHandler: requireAdmin }, async (request) => {
    const user = getUser(request);
    const query = request.query as { page?: string; limit?: string; status?: string; type?: string; q?: string };
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const config = await getWorkerConfig();
    if (!config) {
      const local = await getAllRequests(prisma, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }
    const rows = await loadEveryoneRows(prisma, config, warn);
    return requestsPage(
      prisma, config, rows, user,
      { page, limit, status: query.status, type: query.type, q: query.q, byRequester: true },
      await requesterResolver(prisma),
    );
  });

  /* ── GET /admin/requests/progress — l'avancement de ce qui arrive, pour
   *    tous les comptes (mêmes identifiants que la liste). ── */
  app.get("/admin/requests/progress", { preHandler: requireAdmin }, async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig();
    if (!config) return { updatedAt: new Date().toISOString(), items: [] };
    return cached("seer:progress:everyone", PROGRESS_TTL_MS, async () => {
      const rows = await loadEveryoneRows(prisma, config, warn);
      return progressOf(config, hydrateRows(rows, new Map(), user, await requesterResolver(prisma)));
    });
  });
}
