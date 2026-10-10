/* ------------------------------------------------------------------ */
/*  Seer Plugin — Worker: cleanup queue (suppression via Jellyseerr)   */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";
import {
  getPendingCleanups, updateCleanupJob, enqueueCleanup,
  clearPendingCleanup, deleteRequestById, updateRequestStatus,
  type CleanupJob,
} from "./db";
import { triggerSeerrJob } from "./arr-service";
import { cleanArrForJob } from "./cleanup-arr";
import { getSeerrMedia, resetGoneMedia } from "./seerr-media";
import { reconcileSeerrSeasons } from "./seerr-reconcile";
import { invalidateRequestCaches } from "./cache";
import type { WorkerConfig } from "./worker-sync";
import { departedSeasonsOf, forgetGuardReady, isRerequest, movieBack, sparedSeasons, wholeSeriesStillGone } from "./live/forget-guard";
import { isAutoForget } from "./db-cleanup";

const CLEANUP_BATCH = 25;

/**
 * Traite TOUT le backlog éligible par lots (au lieu d'un seul job par tick,
 * qui faisait durer une suppression groupée de 20 demandes ~20 minutes).
 * Un job qui échoue reçoit un next_retry_at futur et sort du lot suivant —
 * pas de boucle infinie. Cap de sécurité à 4 lots (100 jobs) par passe.
 * Rend le nombre de jobs traités.
 */
export async function processCleanupQueue(db: VigieDb, config: WorkerConfig): Promise<number> {
  let done = 0;
  for (let pass = 0; pass < 4; pass++) {
    const jobs = await getPendingCleanups(db, CLEANUP_BATCH);
    if (jobs.length === 0) return done;
    for (const job of jobs) {
      await processCleanupJob(db, config, job);
      done++;
    }
    if (jobs.length < CLEANUP_BATCH) return done;
  }
  return done;
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
      // Jellyfin a eu le temps de rescanner : si le titre n'y est plus du tout,
      // le média périmé de Jellyseerr est remis à zéro (seerr-media.ts).
      await resetGoneMedia(config, job.mediaType, job.tmdbId, job.title);
      await updateCleanupJob(db, job.id, "completed");
      invalidateForJob(job);
      console.log(`[SeerWorker] availability-sync re-déclenchée pour "${job.title}"`);
      return;
    }
    // === Le retrait d'une demande consommée (action « forget », titre supprimé
    // de Jellyfin) ne touche jamais ce qu'une redemande attend, ni ce qui est
    // revenu entre-temps (live/forget-guard.ts) ; « toute la série » ne vise
    // que ses saisons parties.
    const forget = isAutoForget(job.action);
    // Juste après un démarrage, rien n'est encore lu : il attend la passe suivante, sans compter d'essai.
    if (forget && !forgetGuardReady()) return;
    let target = job;
    let spareArr = false;
    if (forget && job.mediaType === "movie") spareArr = movieBack(job.tmdbId);
    else if (job.action === "forget-series" && wholeSeriesStillGone(job.tmdbId, job.seerrRequestId)) {
      // Réglage « une série supprimée part en entier » : Sonarr cesse de la surveiller toute.
      target = { ...job, seasons: null };
    } else if (forget) {
      const aimed = job.seasons ?? departedSeasonsOf(job.tmdbId);
      const spared = sparedSeasons(job.tmdbId, aimed, job.seerrRequestId);
      target = { ...job, seasons: aimed.filter((s) => !spared.has(s)) };
      spareArr = target.seasons!.length === 0;
    }

    // === Radarr et Sonarr (cleanup-arr.ts) : le film retiré, les saisons plus
    // surveillées, la série retirée quand plus rien n'y est surveillé. Rien si
    // le titre n'y a jamais été ajouté. Un refus lève : le job est relancé (les
    // gestes sont idempotents).
    const media = await getSeerrMedia(config, job.mediaType, job.tmdbId);
    const arr = spareArr ? "kept" : await cleanArrForJob(config, target, media);
    console.log(
      `[SeerWorker] *arr pour "${job.title}" : ${arr} ` +
      `(saisons=${job.seasons ? JSON.stringify(job.seasons) : "toutes"}, fichiers supprimés=${job.deleteFiles})`,
    );

    // === Supprimer la demande Jellyseerr (obligatoire — retry si échec). ===
    // 404 = déjà supprimée → OK. Tout autre échec → throw pour relancer le job,
    // afin de ne jamais laisser une demande orpheline dans Jellyseerr. Le média
    // n'est remis à zéro qu'ensuite, et seulement si Jellyfin n'a plus le titre.
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
    if (job.mediaType === "tv" && target.seasons && target.seasons.length > 0) {
      await reconcileSeerrSeasons(db, config, job.tmdbId, target.seasons, forget
        ? { spare: (r) => isRerequest(r, "tv", job.tmdbId), lockedGoesWhole: true }
        : {});
    }

    // === Un titre que Jellyfin n'a plus du tout, sans plus aucune demande :
    // Jellyseerr le disait encore « disponible » ou « en partie » — remis à zéro.
    await resetGoneMedia(config, job.mediaType, job.tmdbId, job.title);

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
