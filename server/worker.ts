/* ------------------------------------------------------------------ */
/*  Seer Plugin — Background queue worker (main loop + request sender) */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getNextQueued, updateRequestStatus, getRequestById, upsertContentClaim } from "./db";
import { fetchMediaDetail, isAnimeFromKeywords, fetchAnimeOverrides } from "./anime";
import { notifyAvailableSeasons, notifyMovieAvailable } from "./seer-availability-notify";
import { syncStatuses, retryFailedRequests, type WorkerConfig } from "./worker-sync";
import { processCleanupQueue } from "./worker-cleanup";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { warmTmdbCache, seedTmdbCacheOnce, discoverSeerrRefs } from "./worker-tmdb";
import { invalidateRequestCaches } from "./cache";
import { runUserSync, AUTO_SYNC_EVERY_MINUTES } from "./user-sync";
import type { SeerProfile } from "./types";

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
    const seen = new Set<string>();
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

/* ── Process next queued request ───────────────────────────────────── */

/** Traite la prochaine demande en file. Retourne son id, ou null si rien à faire. */
async function processNextRequest(
  prisma: PrismaClient,
  config: WorkerConfig,
  skipIds: ReadonlySet<string>,
): Promise<string | null> {
  const request = await getNextQueued(prisma);
  if (!request || skipIds.has(request.id)) return null;

  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || (fresh.status !== "queued" && fresh.status !== "retry_pending")) return request.id;

  await updateRequestStatus(prisma, request.id, "processing");

  try {
    const seerrBody: Record<string, unknown> = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId,
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }

    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);

    // Clean up declined/failed requests on Seerr (non destructif pour la
    // disponibilité : évite qu'une demande refusée bloque la nouvelle).
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
      }
    }

    // NOTE : on ne supprime PLUS le média Jellyseerr ici. Jellyseerr déduplique
    // nativement les saisons à la création (MediaRequest.request : existingSeasons
    // → finalSeasons), donc envoyer une demande sur un média partiel ne re-demande
    // QUE les nouvelles saisons et préserve la disponibilité existante. Supprimer
    // le média remettait existingSeasons à zéro et re-demandait tout (bug saison
    // partielle). La suppression légitime reste gérée par : retry forceRedownload
    // (routes-requests), retries auto (worker-sync), cleanup deleteFiles.

    // Anime detection
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId, rootFolder: overrides.rootFolder, tags: overrides.tags,
        });
        if (overrides.languageProfileId) seerrBody.languageProfileId = overrides.languageProfileId;
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }

    // Appliquer le profil personnalisé (surcharge anime si présent)
    if (request.profileId && config.profiles?.length) {
      const profile = config.profiles.find((p: SeerProfile) => p.id === request.profileId);
      if (profile) {
        if (request.mediaType === "movie") {
          if (profile.radarrServerId != null) seerrBody.serverId = profile.radarrServerId;
          if (profile.radarrProfileId != null) seerrBody.profileId = profile.radarrProfileId;
          if (profile.radarrRootFolder) seerrBody.rootFolder = profile.radarrRootFolder;
        } else {
          if (profile.sonarrServerId != null) seerrBody.serverId = profile.sonarrServerId;
          if (profile.sonarrProfileId != null) seerrBody.profileId = profile.sonarrProfileId;
          if (profile.sonarrRootFolder) seerrBody.rootFolder = profile.sonarrRootFolder;
          if (profile.sonarrLanguageProfileId != null) seerrBody.languageProfileId = profile.sonarrLanguageProfileId;
        }
        // Tags personnalisés : si définis, remplacent TOUS les tags (anime, défaut, etc.)
        if (profile.tags !== undefined) {
          seerrBody.tags = profile.tags.length > 0 ? profile.tags : [];
        }
        console.log(`[SeerWorker] Applied profile "${profile.name}" for "${request.title}" (tags: ${JSON.stringify(profile.tags ?? "default")})`);
      }
    }

    // Résolution du user Jellyseerr (lookup ou import) — la demande doit
    // apparaître au nom de l'utilisateur Jellyfin qui l'a déclenchée.
    const seerUserId = await resolveJellyseerrUserId(
      config, prisma, request.jellyfinUserId, request.username,
    );
    seerrBody.userId = seerUserId;

    // Send to Seerr
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Jellyseerr a déjà toutes les saisons demandées (local désynchronisé) :
      // ce n'est pas un échec, la demande est déjà satisfaite. On reflète l'état
      // du média plutôt que d'échouer + retry en boucle.
      if (text.includes("No seasons available to request")) {
        const mediaStatus = detail?.mediaInfo?.status;
        const localStatus =
          mediaStatus === 5 ? "available"
            : mediaStatus === 4 ? "partially_available"
              : "sent_to_seer";
        await updateRequestStatus(prisma, request.id, localStatus, {
          seerrMediaId: detail?.mediaInfo?.id,
          seerrMediaStatus: mediaStatus,
          sentAt: new Date(),
        });
        invalidateRequestCaches(request.jellyfinUserId);
        // Notifier la dispo MÊME si déjà présent (rien à télécharger) — sinon
        // une demande de contenu déjà en bibliothèque ne notifie jamais.
        if (request.mediaType === "tv") {
          await notifyAvailableSeasons(prisma, request, detail?.mediaInfo?.seasons);
        } else if (mediaStatus === 5) {
          await notifyMovieAvailable(prisma, request);
        }
        console.log(`[SeerWorker] "${request.title}" : saisons déjà présentes côté Jellyseerr — marqué ${localStatus}`);
        return request.id;
      }
      throw new Error(`Seerr returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as { id: number; media?: { id: number; status: number } };

    await updateRequestStatus(prisma, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: new Date(),
    });
    invalidateRequestCaches(request.jellyfinUserId);

    // Anti-doublon : revendiquer ce contenu dès l'envoi (couvre un téléchargement
    // très rapide avant la 1re passe de sync). Rafraîchi ensuite par syncStatuses.
    await upsertContentClaim(
      prisma, request.tmdbId, request.jellyfinUserId,
      request.mediaType, request.title, 1800,
    ).catch(() => {});

    // Pas de notif « demande envoyée » : on ne notifie qu'à partir du
    // téléchargement (voir statusNotification / syncTvSeasons).
    console.log(`[SeerWorker] Sent request for "${request.title}" (seerr #${data.id})`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = request.retryCount + 1;

    if (newRetryCount >= request.maxRetries) {
      await updateRequestStatus(prisma, request.id, "failed", {
        lastError: errMsg, retryCount: newRetryCount,
      });
      await prisma.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId, type: "request_status",
          title: request.title,
          body: `Votre demande pour « ${request.title} » a échoué après ${newRetryCount} tentatives`,
          refId: request.id,
        },
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      await updateRequestStatus(prisma, request.id, "retry_pending", {
        lastError: errMsg, retryCount: newRetryCount,
      });
      // Pas de notif sur les tentatives intermédiaires (anti-spam) — seul
      // l'échec définitif (ci-dessus, après maxRetries) notifie.
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
  return request.id;
}
