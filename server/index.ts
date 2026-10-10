/* ------------------------------------------------------------------ */
/*  Seer Plugin — Backend module (entry point)                         */
/*  Loaded dynamically by Tentacle plugin backend loader               */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { ensureTables } from "./db";
import { readPluginConfig, writePluginConfig, defaultDailyLimit, navLabelsOf } from "./plugin-config";
import { applyNavLabel } from "./nav-label";
import { specialSeasonsEnabled, specialSeasonsQuick } from "./seerr-settings";
import { startWorker, stopWorker } from "./worker";
import { registerRequestRoutes } from "./routes-requests";
import { registerBulkRoutes } from "./routes-bulk";
import { registerProfileRoutes } from "./routes-profiles";
import { registerUsersRoutes } from "./routes-users";
import { registerUserSyncRoutes } from "./routes-user-sync";
import { registerOwnershipRoutes } from "./routes-ownership";
import { registerConnectionRoutes } from "./routes-connection";
import { registerAvailabilityRoutes } from "./routes-availability";
import { registerProgressRoutes } from "./routes-progress";
import { registerAllRequestsRoutes } from "./routes-requests-all";
import { registerCalendarRoutes } from "./routes-calendar";
import { registerMiscRoutes } from "./routes-misc";
import { registerProxyRoutes } from "./routes-proxy";
import { registerSearchRoutes } from "./routes-search";
import { registerTitleRoutes } from "./routes-titles";
import { registerTitleSeasonRoutes } from "./routes-titles-seasons";
import { registerTitleGapRoutes } from "./routes-titles-gaps";
import { onTitleRequested } from "./titles/request-listener";
import { markActivity, startLiveSync, stopLiveSync } from "./live/live-sync";
import { coreLibraryStore } from "./live/library-store";
import { createAutoForget, forgetPolicyOf } from "./live/auto-forget";
import { liveState } from "./live/live-state";
import { registerLiveRoutes } from "./live/routes-live";

const __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

interface PluginBackendContext {
  pluginId: string;
  getPrisma: () => import("@prisma/client").PrismaClient;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** Venu après dans Tentacle : absent d'un cœur d'avant (cf. titles/request-listener.ts). */
  recommendations?: {
    titleRequested?: (userId: string, title: { mediaType: "movie" | "tv"; tmdbId: number }) => Promise<void>;
  };
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
    allowMaskedRequests: config.allowMaskedRequests === true,
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
  applyNavLabel(__pluginDir, ctx.pluginId, navLabelsOf(getPluginConfig(ctx)));

  // Un titre demandé sort des recommandations du compte, côté Tentacle.
  onTitleRequested(ctx.recommendations?.titleRequested ?? null);

  liveState.setPolicy(forgetPolicyOf(getPluginConfig(ctx)));
  startWorker(prisma, () => getWorkerConfig(ctx));
  // Jellyfin et Jellyseerr en direct : suppressions, demandes retirées (live/live-sync.ts).
  startLiveSync({
    db: prisma,
    store: coreLibraryStore(prisma),
    getWorkerConfig: () => getWorkerConfig(ctx),
    afterPass: createAutoForget(prisma, () => getPluginConfig(ctx)),
  });
  // Les réglages de Jellyseerr lus d'avance : `GET /config` ne les attend pas.
  void getWorkerConfig(ctx)
    .then((w) => (w ? specialSeasonsEnabled(w.seerrUrl, w.seerrApiKey) : false))
    .catch(() => false);
  app.addHook("onClose", async () => { stopWorker(); stopLiveSync(); });
  app.addHook("preHandler", ctx.requireAuth);
  // Quelqu'un se sert de Vigie (ou de ses cartes dans Tentacle) : la boucle en direct accélère.
  app.addHook("onRequest", async () => { markActivity(); });

  /* ── Config ────────────────────────────────────────────────────── */

  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = (request as any).user;
    // Ce que le client propose : la saison 0 si Jellyseerr la laisse demander,
    // les titres masqués si l'administrateur l'a permis.
    const worker = await getWorkerConfig(ctx);
    const requests = {
      specialSeasons: worker ? await specialSeasonsQuick(worker.seerrUrl, worker.seerrApiKey) : false,
      maskedRequests: config.allowMaskedRequests === true,
    };
    // Admins voient toute la config (pour la page admin)
    if (user?.isAdmin) {
      return { ...config, navLabels: navLabelsOf(config), isAdmin: true, ...requests };
    }
    // Non-admins : infos non-sensibles. `isAdmin` dit au client quoi proposer ;
    // `navLabels`, les noms que l'administrateur a donnés à l'onglet.
    return {
      url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false,
      navLabels: navLabelsOf(config), ...requests,
    };
  });

  app.put("/config", { preHandler: ctx.requireAdmin }, async (request, reply) => {
    const saved = writePluginConfig(__pluginDir, ctx.pluginId, request.body);
    if (!saved) return reply.status(404).send({ error: "Plugin not found in installed.json" });
    // « Une série supprimée part en entier » : ce que les fiches disent change tout de suite.
    liveState.setPolicy(forgetPolicyOf(saved));
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
  registerUsersRoutes(app, prisma, gwc, ctx.requireAdmin, () => defaultDailyLimit(getPluginConfig(ctx)));
  registerUserSyncRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerOwnershipRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerConnectionRoutes(app, ctx.requireAdmin);
  registerAvailabilityRoutes(app, prisma, gwc);
  registerProgressRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerAllRequestsRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, prisma, gwc);

  registerMiscRoutes(app, prisma, gwc, ctx.requireAdmin);
  await registerSearchRoutes(app, prisma, gwc);
  // Le contrat `titles` de Tentacle : l'état et la demande d'un titre, pour ses cartes.
  registerTitleRoutes(app, prisma, gwc);
  registerTitleSeasonRoutes(app, prisma, gwc);
  registerTitleGapRoutes(app, prisma, gwc);
  registerLiveRoutes(app);

  console.log("[SeerBackend] Routes registered");
}
