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
import type { SeerRequest, SeerProfile } from "./types";

const CLAIM_TTL_SECONDS = 1800; // 30 min — anti-doublon notif biblio (TTL glissant)

export interface WorkerConfig {
  seerrUrl: string;
  seerrApiKey: string;
  interval: number;
  syncEvery: number;
  profiles?: SeerProfile[];
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
        media?: {
          id: number; status: number;
          downloadStatus?: Array<{ externalId: number; status: string }>;
        };
      };

      const globalStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);

      // Échec → retry/suppression (commun film/série).
      if (globalStatus === "failed" && request.status !== "failed") {
        await handleFailedSync(prisma, config, request, data);
        invalidateRequestCaches(request.jellyfinUserId);
        continue;
      }

      // Séries : disponibilité PAR-SAISON (le statut global reste « partiel »
      // tant que des saisons NON demandées manquent). Films : statut global.
      if (request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0) {
        await syncTvSeasons(prisma, config, request, globalStatus, data.media?.status);
      } else {
        await syncGlobal(prisma, request, globalStatus, data.media?.status);
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
  fallbackStatus: SeerRequest["status"], mediaStatus?: number,
): Promise<void> {
  const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", request.tmdbId);
  const mediaSeasons = detail?.mediaInfo?.seasons;

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
  if (newStatus !== request.status) {
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
       AND (last_error IS NULL OR last_error != 'Request no longer exists on Seerr') LIMIT 3`,
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

/**
 * Mapping Jellyseerr → status local. L'état du MÉDIA Jellyseerr (source de
 * vérité, y compris posé manuellement via « Marquer comme ») prime.
 *
 * Jellyseerr media.status :
 *   1 = UNKNOWN, 2 = PENDING, 3 = PROCESSING, 4 = PARTIALLY_AVAILABLE,
 *   5 = AVAILABLE, 6 = BLOCKLISTED, 7 = DELETED
 * Jellyseerr request.status :
 *   1 = PENDING_APPROVAL, 2 = APPROVED, 3 = DECLINED, 4 = FAILED, 5 = COMPLETED
 */
export function mapSeerrStatus(
  requestStatus: number, mediaStatus?: number,
  // `status` optionnel : Jellyseerr ne garantit pas le champ sur tous les items
  // de la file *arr (un grab tout juste envoyé peut arriver sans).
  downloadStatus?: Array<{ status?: string }>,
): SeerRequest["status"] {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";

  // Disponible / partiellement disponible AVANT les échecs de téléchargement :
  // un état posé (par Jellyseerr ou manuellement par l'utilisateur) ne doit
  // jamais être re-écrasé en « échec » — et donc auto-retenté — sur la foi
  // d'un downloadStatus périmé.
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";

  // Média dégradé DELETED par l'availability-sync Jellyseerr (introuvable dans
  // Jellyfin et sans fichier *arr) : badge « Supprimé » côté Jellyseerr — on
  // affiche pareil, et surtout PAS « échec » (pas d'auto-retry destructif).
  if (mediaStatus === 7) return "deleted";

  // Média marqué « Demandée » (UNKNOWN) — posé à la main via « Marquer comme »
  // ou par Jellyseerr. État FINAL tant que rien ne bouge : un downloadStatus
  // périmé (warning/failed résiduel dans la file *arr) ne doit JAMAIS le
  // requalifier « échec », sinon l'auto-retry supprime la demande Jellyseerr
  // qu'on vient précisément de requalifier (bug « la demande se supprime »).
  if (mediaStatus === 1) return "unavailable";

  // PROCESSING = approuvé, en cours d'acquisition. Jellyseerr n'affiche « en
  // traitement » que si un download est réellement actif — sans download
  // actif, son badge est « Demandé », on mappe pareil.
  //
  // Un download qui COINCE (source morte, import refusé, client en pause…)
  // reste un download : il est BLOQUÉ, jamais en échec. Le classer « failed »
  // déclenchait l'auto-retry, qui supprimait la demande Jellyseerr pour la
  // recréer — tout le contraire de ce qu'attend un titre à qui il ne manque
  // qu'une source. Le signal « bloqué » voyage avec l'avancement (`stalled`,
  // cf. download-progress.ts), là où l'affichage le lit.
  if (mediaStatus === 3) {
    return downloadStatus && downloadStatus.length > 0 ? "downloading" : "unavailable";
  }
  if (requestStatus === 1) return "sent_to_seer";
  return "approved";
}

function statusNotification(
  request: SeerRequest, newStatus: string,
): { type: string; title: string; message: string } | null {
  switch (newStatus) {
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `« ${request.title} » est en cours de téléchargement` };
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
