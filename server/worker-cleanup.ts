/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: cleanup queue (suppression via Jellyseerr)   */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";
import {
  getPendingCleanups, updateCleanupJob, enqueueCleanup,
  clearPendingCleanup, deleteRequestById, updateRequestStatus,
  type CleanupJob,
} from "./db";
import {
  getArrServerConfig, getMediaExternalId,
  unmonitorSonarrSeasons, deleteSonarrSeasonFiles, cancelSonarrQueue,
  unmonitorRadarrMovie, deleteRadarrMovieFile, cancelRadarrQueue,
  triggerSeerrJob,
} from "./arr-service";
import { reconcileSeerrSeasons } from "./seerr-reconcile";
import { invalidateRequestCaches } from "./cache";
import type { WorkerConfig } from "./worker-sync";

const CLEANUP_BATCH = 25;

/**
 * Traite TOUT le backlog éligible par lots (au lieu d'un seul job par tick,
 * qui faisait durer une suppression groupée de 20 demandes ~20 minutes).
 * Un job qui échoue reçoit un next_retry_at futur et sort du lot suivant —
 * pas de boucle infinie. Cap de sécurité à 4 lots (100 jobs) par passe.
 */
export async function processCleanupQueue(db: VigieDb, config: WorkerConfig): Promise<void> {
  for (let pass = 0; pass < 4; pass++) {
    const jobs = await getPendingCleanups(db, CLEANUP_BATCH);
    if (jobs.length === 0) return;
    for (const job of jobs) {
      await processCleanupJob(db, config, job);
    }
    if (jobs.length < CLEANUP_BATCH) return;
  }
}

/**
 * N'invalide que le cache du propriétaire de la demande. L'invalidation globale
 * n'est conservée que pour les jobs anciens, créés avant que la file ne porte
 * l'identifiant utilisateur.
 */
function invalidateForJob(job: CleanupJob): void {
  invalidateRequestCaches(job.jellyfinUserId);
}

async function processCleanupJob(
  db: VigieDb,
  config: WorkerConfig,
  job: CleanupJob,
): Promise<void> {
  const headers = { "X-Api-Key": config.seerrApiKey };

  try {
    // Job « sync » différé : re-déclenche la réconciliation de disponibilité
    // Jellyseerr une fois que Jellyfin a eu le temps de rescanner.
    if (job.action === "sync") {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      await updateCleanupJob(db, job.id, "completed");
      invalidateForJob(job);
      console.log(`[SeerWorker] availability-sync re-déclenchée pour "${job.title}"`);
      return;
    }
    // === ÉTAPES *arr : on ne retire JAMAIS la série/le film de Sonarr/Radarr. ===
    // On agit en direct sur *arr : annuler la file → désactiver la surveillance
    // (toujours, empêche le re-téléchargement) → supprimer les fichiers (si demandé).
    // Best-effort : si le média n'a jamais été grabé (pas d'externalServiceId) ou
    // si *arr est injoignable, on saute proprement sans bloquer le reste.
    const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
    const [server, ext] = await Promise.all([
      getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType),
      getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId),
    ]);

    if (server && ext?.externalServiceId) {
      const arrId = ext.externalServiceId;
      if (job.mediaType === "movie") {
        await cancelRadarrQueue(server, arrId);
        const unmon = await unmonitorRadarrMovie(server, arrId);
        if (!unmon) throw new Error("Radarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteRadarrMovieFile(server, arrId);
          if (!del) throw new Error("Radarr delete file failed");
        }
      } else {
        await cancelSonarrQueue(server, arrId, job.seasons);
        const unmon = await unmonitorSonarrSeasons(server, arrId, job.seasons);
        if (!unmon) throw new Error("Sonarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteSonarrSeasonFiles(server, arrId, job.seasons);
          if (!del) throw new Error("Sonarr delete season files failed");
        }
      }
      console.log(
        `[SeerWorker] *arr cleanup for "${job.title}" (${arrType} #${arrId}, ` +
        `seasons=${job.seasons ? JSON.stringify(job.seasons) : "all"}, deleteFiles=${job.deleteFiles})`,
      );
    } else {
      console.log(`[SeerWorker] "${job.title}" : pas de cible *arr (jamais grabé) — skip ops *arr`);
    }

    // === Supprimer la demande Jellyseerr (obligatoire — retry si échec). ===
    // On ne touche PAS au média Jellyseerr (pas de removeSeries/deleteMovie ni
    // /media/file) : la disponibilité se re-synchronise seule côté Jellyseerr.
    // 404 = déjà supprimée → OK. Tout autre échec → throw pour relancer le job
    // (les ops *arr sont idempotentes), afin de ne jamais laisser une demande
    // orpheline dans Jellyseerr.
    if (job.seerrRequestId) {
      const delRes = await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`Jellyseerr request delete returned ${delRes.status}`);
      }
    }

    // === Réconciliation des saisons côté Jellyseerr (TV ciblée). ===
    // Les fichiers/la surveillance des saisons retirées viennent d'être coupés
    // pour tout le serveur ; on retire donc ces saisons de TOUTES les demandes
    // Jellyseerr qui les couvrent (PUT saisons restantes, ou DELETE si vide).
    // Sans cela, une suppression partielle (ex. S2 sur S1+S2) laissait S2
    // « demandée » pour toujours dans Jellyseerr.
    if (job.mediaType === "tv" && job.seasons && job.seasons.length > 0) {
      await reconcileSeerrSeasons(db, config, job.tmdbId, job.seasons);
    }

    // === Cleanup local ===
    await updateCleanupJob(db, job.id, "completed");

    if (job.requestId) {
      await deleteRequestById(db, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }

    await clearPendingCleanup(db, job.id);

    // Si on a supprimé des fichiers, on relance la réconciliation de disponibilité
    // Jellyseerr (par saison) au lieu d'attendre l'exécution planifiée. Best-effort.
    // NB : Jellyseerr ne basculera la saison en « indisponible » qu'une fois que
    // Jellyfin ne voit plus les épisodes (rescan déclenché par Sonarr→Jellyfin
    // « Connect », ou scan planifié Jellyfin).
    if (job.deleteFiles) {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      // Jellyfin n'a en général PAS encore vu la disparition des fichiers au
      // moment de ce premier déclenchement (rescan via Sonarr→Connect ou
      // monitoring temps réel) : on re-déclenche la synchro à +2 min et
      // +10 min pour que la saison bascule réellement « non disponible »
      // dans Jellyseerr sans attendre le job planifié.
      for (const delay of [120, 600]) {
        await enqueueCleanup(db, {
          action: "sync", mediaType: job.mediaType, tmdbId: job.tmdbId,
          title: job.title, deleteFiles: false, seasons: null, delaySeconds: delay,
          // Propagation obligatoire : sans elle, ces jobs enfants naîtraient
          // sans propriétaire et retomberaient sur l'invalidation globale.
          jellyfinUserId: job.jellyfinUserId,
        });
      }
    }

    // Les listes fusionnées (cache 60s par user) doivent refléter la suppression
    // sans attendre l'expiration du TTL.
    invalidateForJob(job);

    console.log(`[SeerWorker] Cleanup completed for "${job.title}"`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetry = job.retryCount + 1;

    if (newRetry >= job.maxRetries) {
      await updateCleanupJob(db, job.id, "failed", { lastError: errMsg, retryCount: newRetry });

      if (job.requestId) {
        await updateRequestStatus(db, job.requestId, "delete_failed", {
          lastError: `Échec suppression: ${errMsg}`,
        });
      }

      await clearPendingCleanup(db, job.id);
      console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
    } else {
      const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
      const nextRetry = new Date(Date.now() + delaySec * 1000);
      await updateCleanupJob(db, job.id, "pending", {
        lastError: errMsg, retryCount: newRetry, nextRetryAt: nextRetry,
      });
      console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
    }
  }
}
