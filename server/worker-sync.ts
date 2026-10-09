/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: status sync + auto-retry                     */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getRequestsToSync, updateRequestStatus, upsertContentClaim, purgeExpiredContentClaims } from "./db";
import { invalidateRequestCaches } from "./cache";
import { fetchMediaDetail } from "./anime";
import { releasedSuffix } from "./season-availability";
import { notifyAvailableSeasons, releaseGoneSeasons } from "./seer-availability-notify";
import { triggerSeerrJob } from "./arr-service";
import { arrKnows } from "./arr-advance";
import { isDowngrade } from "./arr-advance-plan";
import type { SeerRequest, SeerProfile } from "./types";
import { factsWithRequest } from "./live/live-state";
import { mapSeerrStatus } from "./seerr-status-map";
import { correctMediaStatus, correctSeasonStatus, type RequestFact } from "./live/title-truth";

const CLAIM_TTL_SECONDS = 1800; // 30 min — anti-doublon notif biblio (TTL glissant)

export interface WorkerConfig {
  seerrUrl: string;
  seerrApiKey: string;
  interval: number;
  syncEvery: number;
  profiles?: SeerProfile[];
  autoApprove?: boolean;
  defaultDailyLimit?: number | null;
  /** Lever le blocage Jellyseerr d'un titre masqué avant d'envoyer sa demande. */
  allowMaskedRequests?: boolean;
}

/* ── Sync statuses with Seerr ──────────────────────────────────────── */

export async function syncStatuses(prisma: PrismaClient, config: WorkerConfig): Promise<void> {
  const requests = await getRequestsToSync(prisma);
  await purgeExpiredContentClaims(prisma).catch(() => {});
  if (requests.length === 0) return;

  let availabilitySyncDone = false; // Part C : 1 availability-sync par passe max.

  for (const request of requests) {
    if (!request.seerrRequestId) continue;

    // Anti-doublon : Seer revendique ce contenu tant que la demande est active,
    // pour que le notifier biblio du core n'envoie pas de push doublon à cet
    // utilisateur (TTL glissant ; expire seul quand la demande devient dispo).
    await upsertContentClaim(
      prisma, request.tmdbId, request.jellyfinUserId,
      request.mediaType, request.title, CLAIM_TTL_SECONDS,
    ).catch(() => {});

    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) {
        if (res.status === 404) {
          // Supprimée côté Jellyseerr (par l'utilisateur ou un admin) : une
          // DÉCISION, pas une panne. Classée « failed », l'auto-retry la
          // recréait quelques minutes plus tard — la saison qu'on venait de
          // libérer réapparaissait « Demandée ». Terminal : ni retry, ni verrou.
          await updateRequestStatus(prisma, request.id, "deleted", {
            lastError: "Demande supprimée côté Jellyseerr",
          });
          invalidateRequestCaches(request.jellyfinUserId);
        }
        continue;
      }

      const data = (await res.json()) as {
        id: number; status: number;
        seasons?: Array<{ seasonNumber: number }>;
        media?: {
          id: number; status: number;
          downloadStatus?: Array<{ externalId: number; status: string }>;
        };
      };

      // Le média tel que Jellyfin l'a vraiment : supprimé de Jellyfin, un titre
      // « disponible » pour Jellyseerr redevient attendu — sans annonce d'arrivée.
      const own: RequestFact = { status: data.status, seasons: (data.seasons ?? []).map((s) => s.seasonNumber) };
      const facts = factsWithRequest(request.mediaType, request.tmdbId, own, (data.media?.downloadStatus?.length ?? 0) > 0);
      const mediaStatus = correctMediaStatus(request.mediaType, data.media?.status, facts);
      const globalStatus = mapSeerrStatus(data.status, mediaStatus, data.media?.downloadStatus);

      // Échec → retry/suppression (commun film/série).
      if (globalStatus === "failed" && request.status !== "failed") {
        await handleFailedSync(prisma, config, request, data);
        invalidateRequestCaches(request.jellyfinUserId);
        continue;
      }

      // Séries : disponibilité PAR-SAISON (le statut global reste « partiel »
      // tant que des saisons NON demandées manquent). Films : statut global.
      if (request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0) {
        await syncTvSeasons(prisma, config, request, globalStatus, mediaStatus, own);
      } else {
        await syncGlobal(prisma, request, globalStatus, mediaStatus);
      }

      // Part C : accélérer la réconciliation par-saison côté Jellyseerr
      // (Sonarr → mediaInfo.seasons), SANS écrire dans Sonarr. 1×/passe.
      if (!availabilitySyncDone && request.mediaType === "tv" &&
          (globalStatus === "partially_available" || globalStatus === "downloading")) {
        availabilitySyncDone = true;
        await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}

/** Applique un changement de statut global + notif (film, ou série sans dispo par-saison). */
async function syncGlobal(
  prisma: PrismaClient, request: SeerRequest,
  newStatus: SeerRequest["status"], mediaStatus?: number,
): Promise<void> {
  if (newStatus === request.status) return;
  // Sonarr ou Radarr ont déjà fait avancer la demande (arr-advance.ts) : un
  // Jellyseerr en retard ne la fait pas reculer, ni ne réannonce son départ.
  if (arrKnows(request.mediaType) && isDowngrade(request.status, newStatus)) return;
  const extra: Record<string, unknown> = { seerrMediaStatus: mediaStatus };
  if (newStatus === "available") extra.completedAt = new Date();
  await updateRequestStatus(prisma, request.id, newStatus, extra as any);
  invalidateRequestCaches(request.jellyfinUserId);

  const notif = statusNotification(request, newStatus);
  if (notif) {
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: notif.title, body: notif.message, refId: request.id,
      },
    });
  }
  console.log(`[SeerWorker] "${request.title}" status: ${request.status} → ${newStatus}`);
}

/**
 * Séries : croise les saisons DEMANDÉES avec la disponibilité par-saison de
 * Jellyseerr, notifie le delta des saisons devenues dispo (même si le média
 * global reste « partiel »), et passe la demande à « available » quand TOUTES
 * les saisons demandées sont là.
 */
async function syncTvSeasons(
  prisma: PrismaClient, config: WorkerConfig, request: SeerRequest,
  fallbackStatus: SeerRequest["status"], mediaStatus: number | undefined, own: RequestFact,
): Promise<void> {
  const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", request.tmdbId);
  // Une saison supprimée de Jellyfin ne compte plus pour arrivée (live/title-truth.ts).
  const facts = factsWithRequest("tv", request.tmdbId, own);
  const mediaSeasons = detail?.mediaInfo?.seasons?.map((s) => ({
    ...s, status: correctSeasonStatus(s.seasonNumber, s.status, facts) ?? s.status,
  }));

  // Saisons demandées que Jellyseerr dit SUPPRIMÉES : libérées (null = demande close).
  const kept = await releaseGoneSeasons(prisma, request, mediaSeasons);
  if (!kept) return;
  request = kept;

  const newStatus = await notifyAvailableSeasons(prisma, request, mediaSeasons);

  // Aucune saison demandée encore dispo (ou pas de granularité) → repli global.
  if (newStatus === null) {
    await syncGlobal(prisma, request, fallbackStatus, mediaStatus);
    return;
  }

  // Statut : toutes les saisons demandées dispo → available ; sinon partiel.
  if (newStatus !== request.status && !(arrKnows("tv") && isDowngrade(request.status, newStatus))) {
    const extra: Record<string, unknown> = { seerrMediaStatus: mediaStatus };
    if (newStatus === "available") extra.completedAt = new Date();
    await updateRequestStatus(prisma, request.id, newStatus, extra as any);
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" status: ${request.status} → ${newStatus}`);
  }
}

async function handleFailedSync(
  prisma: PrismaClient, config: WorkerConfig,
  request: SeerRequest, data: { media?: { status: number } },
): Promise<void> {
  const retryN = request.retryCount + 1;

  if (retryN < request.maxRetries) {
    await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
      method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});

    if (request.seerrMediaId) {
      await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
        method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      retryN, request.id,
    );

    // Pas de notif sur les tentatives auto (anti-spam) — seul l'échec définitif notifie.
    console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
  } else {
    await updateRequestStatus(prisma, request.id, "failed", {
      seerrMediaStatus: data.media?.status, retryCount: retryN,
    } as any);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: request.title,
        body: `Échec définitif pour « ${request.title} » après ${request.maxRetries} tentatives`,
        refId: request.id,
      },
    });
    console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
  }
}

/* ── Auto-retry failed requests ──────────────────────────────────── */

export async function retryFailedRequests(prisma: PrismaClient): Promise<void> {
  const failed = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; retry_count: number; max_retries: number }>>(
    // Les lignes héritées de l'ancien classement (404 → « failed ») ne sont
    // plus recréées non plus : une suppression côté Jellyseerr est acquise.
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries
       AND (last_error IS NULL OR last_error != 'Request no longer exists on Seerr') ORDER BY id ASC LIMIT 3`,
  );

  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry, req.id,
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Réexporté : le mapping vit dans seerr-status-map.ts. */
export { mapSeerrStatus };

function statusNotification(
  request: SeerRequest, newStatus: string,
): { type: string; title: string; message: string } | null {
  switch (newStatus) {
    // « En route », jamais « téléchargement » : l'application mobile affiche
    // ces notifications et n'écrit ce mot nulle part (cf. CLAUDE.md du core).
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `« ${request.title} » est en route` };
    case "available": {
      const suffix = releasedSuffix(request.mediaType === "movie" ? "m" : "f", false);
      return { type: "request_available", title: request.title, message: `« ${request.title} » ${suffix}` };
    }
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour « ${request.title} » a été refusée` };
    default:
      return null;
  }
}
