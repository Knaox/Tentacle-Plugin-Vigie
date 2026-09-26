/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker : envoi d'une demande à Jellyseerr             */
/* ------------------------------------------------------------------ */

/* Extrait de worker.ts pour tenir sous 300 lignes : la boucle du worker
 * reste là-bas, l'envoi d'une demande (profil, anime, compte Jellyseerr,
 * contenu déjà présent) vit ici. */

import type { PrismaClient } from "@prisma/client";
import { getNextQueued, updateRequestStatus, getRequestById, upsertContentClaim } from "./db";
import { fetchMediaDetail, isAnimeFromKeywords, fetchAnimeOverrides } from "./anime";
import { notifyAvailableSeasons, notifyMovieAvailable } from "./seer-availability-notify";
import type { WorkerConfig } from "./worker-sync";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { invalidateRequestCaches } from "./cache";
import type { SeerProfile } from "./types";

/* ── Process next queued request ───────────────────────────────────── */

/** Traite la prochaine demande en file. Retourne son id, ou null si rien à faire. */
export async function processNextRequest(
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
