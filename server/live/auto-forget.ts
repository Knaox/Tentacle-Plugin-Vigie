/* ------------------------------------------------------------------ */
/*  Vigie — « Supprimer la demande avec le titre » : ce qu'on fait      */
/* ------------------------------------------------------------------ */

/*
 * Appelé après chaque passe de la boucle en direct, quand l'option est
 * active. Les décisions sont dans auto-forget-plan.ts ; ici, la dernière
 * garde (Jellyfin redemandé juste avant d'agir) et les gestes, par la file de
 * nettoyage de Vigie — celle de « Supprimer » : Sonarr ou Radarr cessent de
 * surveiller, la demande Jellyseerr part, la ligne locale aussi. Jamais un
 * fichier supprimé : il l'est déjà.
 */

import type { VigieDb } from "../storage/vigie-db";
import type { WorkerCfg } from "../seerr-unified";
import type { PluginConfig } from "../plugin-config";
import { addSeasonsToRequest, enqueueCleanup, updateRequestStatus } from "../db";
import { getTmdbMetaBulk } from "../tmdb-cache";
import { invalidateRequestCaches } from "../cache";
import { kickWorkerNow } from "../worker";
import { checkInJellyfin } from "./jellyfin-check";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import { openLocalRequestsFor } from "./local-requests";
import { isLiveRequest } from "./title-truth";
import { forgetCandidates, madeBefore, planJobs, type ForgetOptions, type ForgetRequest } from "./auto-forget-plan";
import type { Departure } from "./library-keys";

/** La date ISO d'une demande Jellyseerr, en ms ; `null` si elle manque. */
const msOf = (iso: string | null): number | null => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Un titre traité n'est pas repris avant que la file de nettoyage ait eu le temps d'agir. */
const COOLDOWN_MS = 15 * 60_000;
const MASS_WARN_EVERY_MS = 60 * 60_000;
/** Au plus autant de titres par passe — le reste à la passe suivante. */
const TITLES_PER_PASS = 5;

export function forgetOptionsOf(config: PluginConfig): ForgetOptions {
  const since = Number(config.deleteRequestsWithMediaSince);
  return {
    enabled: config.deleteRequestsWithMedia === true,
    since: Number.isFinite(since) && since > 0 ? since : null,
  };
}

async function titleOf(db: VigieDb, dep: Departure, fallback: string | null): Promise<string> {
  if (fallback) return fallback;
  const meta = await getTmdbMetaBulk(db, [{ mediaType: dep.mediaType, tmdbId: dep.tmdbId }]).catch(() => null);
  return meta?.get(`${dep.mediaType}:${dep.tmdbId}`)?.title || `${dep.mediaType === "movie" ? "Film" : "Série"} #${dep.tmdbId}`;
}

async function hasPendingCleanup(db: VigieDb, seerrRequestId: number): Promise<boolean> {
  const rows = await db.query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM seer_cleanup_queue WHERE status = 'pending' AND seerr_request_id = ?",
    seerrRequestId,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export function createAutoForget(db: VigieDb, readConfig: () => PluginConfig) {
  const handled = new Map<string, number>();
  let lastMassWarn = 0;

  return async function autoForget(_cfg: WorkerCfg, now: number): Promise<void> {
    const options = forgetOptionsOf(readConfig());
    if (!options.enabled || !requestIndex.ready || !liveState.libraryReadable) return;
    for (const [key, at] of handled) if (now - at > COOLDOWN_MS) handled.delete(key);

    const plan = forgetCandidates({ departures: liveState.departures(), options, now });
    if (plan.kind === "mass") {
      if (now - lastMassWarn > MASS_WARN_EVERY_MS) {
        lastMassWarn = now;
        console.warn(
          `[VigieLive] ${plan.count} titres partis de Jellyfin en moins d'une heure : trop pour être une suppression voulue `
          + "(disque ou partage débranché ?). Aucune demande n'est supprimée automatiquement.",
        );
      }
      return;
    }
    if (plan.kind !== "ready") return;

    // Seulement les titres dont une demande d'AVANT le départ vit encore : une redemande reste.
    const targets = plan.departures
      .filter((d) => !handled.has(`${d.mediaType}:${d.tmdbId}`))
      .filter((d) => (requestIndex.requestsFor(d.mediaType, d.tmdbId) ?? [])
        .some((r) => isLiveRequest(r) && madeBefore(msOf(r.createdAt), d.at)))
      .slice(0, TITLES_PER_PASS);
    if (targets.length === 0) return;

    // Dernière garde : Jellyfin, maintenant. Muet → rien ne se fait.
    const checks = await checkInJellyfin(db, targets.map((d) => ({ mediaType: d.mediaType, tmdbId: d.tmdbId, seasons: d.seasons })));
    let enqueued = 0;
    for (const dep of targets) {
      const key = `${dep.mediaType}:${dep.tmdbId}`;
      const check = checks.get(key);
      if (!check) continue;
      handled.set(key, now);
      let effective = dep;
      if (dep.mediaType === "movie" || dep.whole) {
        if (check.present) continue; // revenu (remplacé) : rien à faire
      } else {
        const gone = dep.seasons.filter((s) => !check.presentSeasons?.has(s));
        if (gone.length === 0) continue;
        effective = { ...dep, seasons: gone };
      }
      enqueued += await forgetTitle(db, effective);
    }
    if (enqueued > 0) {
      invalidateRequestCaches();
      kickWorkerNow();
    }
  };
}

/** Met en file la suppression des demandes d'un titre parti. Rend le nombre de demandes visées. */
async function forgetTitle(db: VigieDb, dep: Departure): Promise<number> {
  const indexed = requestIndex.requestsFor(dep.mediaType, dep.tmdbId) ?? [];
  const locals = await openLocalRequestsFor(db, dep.mediaType, dep.tmdbId);
  const localBySeerr = new Map(locals.filter((l) => l.seerrRequestId).map((l) => [l.seerrRequestId as number, l]));
  const requests: ForgetRequest[] = indexed.map((r) => {
    const local = localBySeerr.get(r.id) ?? null;
    return {
      seerrRequestId: r.id, status: r.status, seasons: r.seasons, is4k: r.is4k,
      localId: local?.id ?? null,
      jellyfinUserId: local?.jellyfinUserId ?? r.requestedBy.jellyfinUserId,
      createdAt: msOf(r.createdAt),
    };
  });
  const jobs = planJobs(dep, requests);
  if (jobs.length === 0) return 0;
  const title = await titleOf(db, dep, locals[0]?.title ?? null);
  let count = 0;
  for (const job of jobs) {
    if (job.seerrRequestId !== null && await hasPendingCleanup(db, job.seerrRequestId)) continue;
    await enqueueCleanup(db, {
      action: "delete", mediaType: dep.mediaType, tmdbId: dep.tmdbId, title,
      seerrRequestId: job.seerrRequestId, deleteFiles: false, seasons: job.seasons,
      requestId: job.whole ? job.localId : null, jellyfinUserId: job.jellyfinUserId,
    });
    if (job.localId) {
      if (job.whole) await updateRequestStatus(db, job.localId, "deleting");
      else {
        const local = locals.find((l) => l.id === job.localId);
        const remaining = (local?.seasons ?? []).filter((s) => !(job.seasons ?? []).includes(s));
        if (remaining.length > 0) await addSeasonsToRequest(db, job.localId, remaining);
      }
    }
    count++;
  }
  const what = dep.mediaType === "movie" || dep.whole ? "supprimé" : `saison(s) ${dep.seasons.join(", ")} supprimée(s)`;
  console.log(`[VigieLive] « ${title} » ${what} de Jellyfin — ${count} demande(s) retirée(s) de Jellyseerr et de Vigie (option « avec le titre »)`);
  return count;
}
