/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module (entry point)                         */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { ensureTables } from "./db";
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

/*
 * `installed.json` était relu et re-parsé À CHAQUE requête HTTP (et à chaque
 * tick du worker) : ~300 µs de lecture synchrone sur le thread d'événements,
 * sur le chemin de /requests, /seerr/*, /proxy et /config. On garde le contenu
 * en mémoire, invalidé par la date de modification du fichier — le PUT /config
 * réécrit le fichier, donc le mtime change et la relecture se fait toute seule.
 */
let cfgCache: { mtimeMs: number; value: Record<string, unknown> } | null = null;

function getPluginConfig(ctx: PluginBackendContext): Record<string, unknown> {
  try {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return {};
    const mtimeMs = statSync(installedPath).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;

    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p: { pluginId?: string; id?: string }) =>
        p.pluginId === ctx.pluginId || p.id === ctx.pluginId,
    );
    const value = plugin?.config || {};
    cfgCache = { mtimeMs, value };
    return value;
  } catch { return {}; }
}

async function getWorkerConfig(ctx: PluginBackendContext) {
  const config = getPluginConfig(ctx);
  const url = config.url as string;
  const apiKey = config.apiKey as string;
  if (!url || !apiKey) return null;
  const profiles = (config.profiles as any[] | undefined) ?? [];
  return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey, interval: 60_000, syncEvery: 2, profiles };
}

/* ── Main plugin registration ────────────────────────────────────── */

export default async function seerBackend(
  app: FastifyInstance,
  ctx: PluginBackendContext,
): Promise<void> {
  const prisma = ctx.getPrisma();

  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");

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
    // Non-admins : infos non-sensibles. `isAdmin` dit au client quoi proposer.
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false };
  });

  app.put("/config", { preHandler: ctx.requireAdmin }, async (request) => {
    // Sauvegarder la config dans installed.json via le host
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return { error: "installed.json not found" };
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p: { pluginId?: string; id?: string }) =>
        p.pluginId === ctx.pluginId || p.id === ctx.pluginId,
    );
    if (!plugin) return { error: "Plugin not found" };
    plugin.config = request.body;
    writeFileSync(installedPath, JSON.stringify(installed, null, 2));
    return plugin.config;
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
