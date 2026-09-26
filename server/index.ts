/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module (entry point)                         */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { ensureTables } from "./db";
import { readPluginConfig, writePluginConfig, defaultDailyLimit } from "./plugin-config";
import { applyNavLabel, cleanNavLabel } from "./nav-label";
import { startWorker, stopWorker } from "./worker";
import { registerRequestRoutes } from "./routes-requests";
import { registerBulkRoutes } from "./routes-bulk";
import { registerProfileRoutes } from "./routes-profiles";
import { registerUsersRoutes } from "./routes-users";
import { registerAvailabilityRoutes } from "./routes-availability";
import { registerProgressRoutes } from "./routes-progress";
import { registerCalendarRoutes } from "./routes-calendar";
import { registerMiscRoutes } from "./routes-misc";
import { registerProxyRoutes } from "./routes-proxy";
import { registerSearchRoutes } from "./routes-search";

const __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

interface PluginBackendContext {
  pluginId: string;
  getPrisma: () => import("@prisma/client").PrismaClient;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

function getPluginConfig(ctx: PluginBackendContext): Record<string, unknown> {
  return readPluginConfig(__pluginDir, ctx.pluginId);
}

async function getWorkerConfig(ctx: PluginBackendContext) {
  const config = getPluginConfig(ctx);
  const url = config.url as string;
  const apiKey = config.apiKey as string;
  if (!url || !apiKey) return null;
  const profiles = (config.profiles as any[] | undefined) ?? [];
  return {
    seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey, interval: 60_000, syncEvery: 2, profiles,
    autoApprove: config.autoApprove === true,
    defaultDailyLimit: defaultDailyLimit(config),
  };
}

/* ── Main plugin registration ────────────────────────────────────── */

export default async function seerBackend(
  app: FastifyInstance,
  ctx: PluginBackendContext,
): Promise<void> {
  const prisma = ctx.getPrisma();

  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");

  // Une mise à jour vient peut-être de remplacer le manifeste : le nom choisi
  // pour l'onglet y est réécrit à chaque démarrage (cf. nav-label.ts).
  applyNavLabel(__pluginDir, ctx.pluginId, getPluginConfig(ctx).navLabel);

  startWorker(prisma, () => getWorkerConfig(ctx));
  app.addHook("onClose", async () => { stopWorker(); });
  app.addHook("preHandler", ctx.requireAuth);

  /* ── Config ────────────────────────────────────────────────────── */

  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = (request as any).user;
    // Admins voient toute la config (pour la page admin)
    if (user?.isAdmin) {
      return { ...config, isAdmin: true };
    }
    // Non-admins : infos non-sensibles. `isAdmin` dit au client quoi proposer ;
    // `navLabel`, le nom que l'administrateur a donné à l'onglet.
    return {
      url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false,
      navLabel: cleanNavLabel(config.navLabel),
    };
  });

  app.put("/config", { preHandler: ctx.requireAdmin }, async (request, reply) => {
    const saved = writePluginConfig(__pluginDir, ctx.pluginId, request.body);
    if (!saved) return reply.status(404).send({ error: "Plugin not found in installed.json" });
    return saved;
  });

  /* ── Proxys Jellyseerr (routes-proxy.ts) ───────────────────────── */

  registerProxyRoutes(app, () => getPluginConfig(ctx));

  /* ── Request & bulk routes (from split modules) ────────────────── */

  const gwc = () => getWorkerConfig(ctx);
  registerRequestRoutes(app, prisma, gwc);
  registerBulkRoutes(app, prisma, gwc);
  registerProfileRoutes(app, () => getPluginConfig(ctx), () => {
    const c = getPluginConfig(ctx);
    const url = c.url as string; const apiKey = c.apiKey as string;
    if (!url || !apiKey) return null;
    return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey };
  });
  registerUsersRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerAvailabilityRoutes(app, prisma, gwc);
  registerProgressRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, prisma, gwc);

  registerMiscRoutes(app, prisma, gwc, ctx.requireAdmin);
  await registerSearchRoutes(app, prisma, gwc);

  console.log("[SeerBackend] Routes registered");
}
