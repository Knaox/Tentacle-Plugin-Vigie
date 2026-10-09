/* ------------------------------------------------------------------ */
/*  Seer Plugin — Background queue worker (main loop + request sender) */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { syncStatuses, retryFailedRequests, type WorkerConfig } from "./worker-sync";
import { processCleanupQueue } from "./worker-cleanup";
import { processNextRequest } from "./worker-send";
import { warmTmdbCache, seedTmdbCacheOnce, discoverSeerrRefs } from "./worker-tmdb";
import { runUserSync, AUTO_SYNC_EVERY_MINUTES } from "./user-sync";
import { advanceFromArr } from "./arr-advance";
import { deferredRequestIds } from "./live/seerr-unblock";

let timer: ReturnType<typeof setInterval> | null = null;
let cycleCount = 0;
let prismaRef: PrismaClient | null = null;
let getConfigRef: (() => Promise<WorkerConfig | null>) | null = null;
let requestQueueBusy = false;
let cleanupQueueBusy = false;

/** File d'envoi : jusqu'à 10 demandes par passe (bulk retry, rafale d'ajouts). */
async function runRequestQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  if (requestQueueBusy) return;
  requestQueueBusy = true;
  try {
    // `seen` : une demande repassée en retry_pending pendant la passe n'est pas
    // re-traitée immédiatement (elle garde son rythme d'un retry par tick).
    // Celles qui attendent Jellyseerr (live/seerr-unblock.ts) repasseront plus tard.
    const seen = new Set<string>(deferredRequestIds());
    for (let i = 0; i < 10; i++) {
      const processedId = await processNextRequest(prisma, config, seen);
      if (!processedId) return;
      seen.add(processedId);
    }
  } finally {
    requestQueueBusy = false;
  }
}

async function runCleanupQueue(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  if (cleanupQueueBusy) return;
  cleanupQueueBusy = true;
  try {
    await processCleanupQueue(prisma, config);
  } finally {
    cleanupQueueBusy = false;
  }
}

export function startWorker(
  prisma: PrismaClient,
  getConfig: () => Promise<WorkerConfig | null>,
): void {
  if (timer) return;
  prismaRef = prisma;
  getConfigRef = getConfig;

  async function tick() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;
    cycleCount++;

    try { await runRequestQueue(prisma, config); }
    catch (err) { console.error("[SeerWorker] Error processing request:", err); }

    // Sonarr et Radarr d'abord : ce qu'ils savent n'attend plus Jellyseerr.
    try { await advanceFromArr(prisma, config); }
    catch (err) { console.error("[SeerWorker] Error reading Sonarr/Radarr:", err); }

    if (cycleCount % config.syncEvery === 0) {
      try { await syncStatuses(prisma, config); }
      catch (err) { console.error("[SeerWorker] Error syncing statuses:", err); }
    }

    try { await retryFailedRequests(prisma); }
    catch (err) { console.error("[SeerWorker] Error retrying failed requests:", err); }

    try { await runCleanupQueue(prisma, config); }
    catch (err) { console.error("[SeerWorker] Error processing cleanup queue:", err); }

    /* La synchro des comptes (user-sync.ts) : une passe peu après le démarrage,
     * puis toutes les demi-heures. Un compte supprimé dans Jellyseerr ou dans
     * Jellyfin n'attend plus qu'un administrateur pense au bouton. */
    if (cycleCount === 2 || cycleCount % AUTO_SYNC_EVERY_MINUTES === 0) {
      try { await runUserSync(prisma, config, { trigger: "auto" }); }
      catch (err) { console.error("[SeerWorker] Error syncing users:", err); }
    }

    // Réchauffage des fiches TMDB — 1 tick sur 5 (~5 min), budget borné.
    if (cycleCount % 5 === 0) {
      try { await warmTmdbCache(prisma, config); }
      catch (err) { console.error("[SeerWorker] Error warming TMDB cache:", err); }
    }

    /* Les demandes faites hors du plugin n'entrent dans la mémoire des fiches
     * que si quelqu'un ouvre l'agenda. Une demi-heure suffit : une sortie ne se
     * décide pas à la minute, et le remplissage part ensuite en tâche de fond. */
    if (cycleCount % 30 === 0) {
      try {
        const n = await discoverSeerrRefs(prisma, config);
        if (n > 0) console.log(`[SeerWorker] ${n} fiches découvertes hors du plugin`);
      } catch (err) { console.error("[SeerWorker] Error discovering Seerr refs:", err); }
    }
  }

  setTimeout(() => { void seedTmdbCacheOnce(prisma); tick(); }, 5000);
  timer = setInterval(() => { tick(); }, 60_000);
  console.log("[SeerWorker] Started");
}

/**
 * Réveille le worker immédiatement (appelé par les routes après un enqueue :
 * suppression, bulk, nouvelle demande). Sans ce kick, chaque action attendait
 * le prochain tick (60 s) — un bulk delete de 20 items prenait ~20 minutes.
 * Les gardes `*QueueBusy` empêchent tout chevauchement avec le tick périodique.
 */
export function kickWorkerNow(): void {
  const prisma = prismaRef;
  const getConfig = getConfigRef;
  if (!prisma || !getConfig) return;
  setTimeout(async () => {
    try {
      const config = await getConfig();
      if (!config || !config.seerrUrl || !config.seerrApiKey) return;
      await Promise.all([
        runRequestQueue(prisma, config)
          .catch((err) => console.error("[SeerWorker] Kick request queue failed:", err)),
        runCleanupQueue(prisma, config)
          .catch((err) => console.error("[SeerWorker] Kick cleanup queue failed:", err)),
      ]);
    } catch (err) {
      console.error("[SeerWorker] Kick failed:", err);
    }
  }, 50);
}

export function stopWorker(): void {
  if (timer) { clearInterval(timer); timer = null; console.log("[SeerWorker] Stopped"); }
}

export function isWorkerRunning(): boolean {
  return timer !== null;
}
