/* ------------------------------------------------------------------ */
/*  Seer Plugin — Plateformes, file, statistiques, worker             */
/* ------------------------------------------------------------------ */

/* Extrait de index.ts pour tenir sous 300 lignes : routes annexes, sans
 * rapport avec le proxy Jellyseerr ni la configuration. */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getQueueStatus, getUserStats, getGlobalStats } from "./db";
import { isWorkerRunning } from "./worker";
import { cached, invalidate } from "./cache";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { userMarks } from "./user-marks";

export function registerMiscRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {

/* ── Ce que le compte a fait de chaque titre (user-marks.ts) ─────── */

app.get("/marks", async (request) => {
  const userId = getUser(request).userId;
  // `fresh=1` : un geste vient de changer Ma liste d'un titre déjà là — c'est
  // Jellyfin qui le dit, pas la copie d'il y a une minute.
  if ((request.query as { fresh?: string }).fresh === "1") invalidate(`vigie:marks:${userId}`);
  return userMarks(prisma, userId);
});

/* ── Watch providers, queue, stats, worker control ─────────────── */

const providerCache = new Map<string, { providers: number[]; expires: number }>();

app.post("/check-providers", async (request, reply) => {
  const body = request.body as { items: Array<{ tmdbId: number; mediaType: "movie" | "tv" }> };
  if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });

  const config = await getWorkerConfig();
  if (!config) return reply.status(503).send({ message: "Seerr not configured" });
  const seerrUrl = config.seerrUrl;
  const apiKey = config.seerrApiKey;

  const result: Record<number, number[]> = {};
  const toFetch: Array<{ tmdbId: number; mediaType: string }> = [];

  for (const item of body.items.slice(0, 200)) {
    const key = `${item.mediaType}-${item.tmdbId}`;
    const cached = providerCache.get(key);
    if (cached && Date.now() < cached.expires) { result[item.tmdbId] = cached.providers; }
    else { toFetch.push(item); }
  }

  const BATCH = 5;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const responses = await Promise.allSettled(
      batch.map(async (item) => {
        const res = await fetch(`${seerrUrl}/api/v1/${item.mediaType}/${item.tmdbId}`, {
          headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: [] as number[] };
        const data = (await res.json()) as {
          watchProviders?: Array<{ iso_3166_1: string; flatrate?: Array<{ id: number; providerId?: number }> }>;
        };
        const region = data.watchProviders?.find((w) => w.iso_3166_1 === "FR")
          ?? data.watchProviders?.find((w) => w.iso_3166_1 === "US");
        const ids = region?.flatrate?.map((p) => p.id ?? p.providerId ?? 0).filter(Boolean) ?? [];
        return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: ids };
      }),
    );
    for (const r of responses) {
      if (r.status === "fulfilled" && r.value) {
        const { tmdbId, mediaType, providers } = r.value;
        result[tmdbId] = providers;
        providerCache.set(`${mediaType}-${tmdbId}`, { providers, expires: Date.now() + 7 * 86400_000 });
      }
    }
  }
  return result;
});

app.get("/queue/status", async (request) => {
  const user = (request as any).user;
  const status = await getQueueStatus(prisma, user.isAdmin ? undefined : user.userId);
  return { ...status, workerRunning: isWorkerRunning() };
});

app.get("/stats", async (request) => {
  const user = (request as any).user;
  if (user.isAdmin) {
    const [personal, global] = await Promise.all([getUserStats(prisma, user.userId), getGlobalStats(prisma)]);
    return { personal, global };
  }
  return { personal: await getUserStats(prisma, user.userId) };
});

app.post("/worker/trigger", { preHandler: requireAdmin }, async () => {
  const config = await getWorkerConfig();
  if (!config) return { message: "Seerr not configured" };
  const next = await getQueueStatus(prisma);
  return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
});
}
