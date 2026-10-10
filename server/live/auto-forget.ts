/* ------------------------------------------------------------------ */
/*  Vigie — Un titre supprimé de Jellyfin emporte sa demande : le faire */
/* ------------------------------------------------------------------ */

/*
 * Appelé après chaque passe de la boucle en direct. Les décisions sont dans
 * auto-forget-plan.ts ; ici, les dernières gardes (Jellyfin redemandé juste
 * avant d'agir, rien qui descende encore chez Sonarr ou Radarr, les vagues
 * retenues) et les gestes, par la file de nettoyage de Vigie — celle de
 * « Supprimer », avec l'action `forget` (worker-cleanup.ts) : la demande
 * Jellyseerr part, la ligne locale aussi, Sonarr ou Radarr cessent de
 * surveiller — sans rien retirer qui y ait encore des fichiers, et jamais ce
 * qu'une redemande attend. Jamais un fichier supprimé.
 *
 * Redemander un titre parti n'attend rien de tout cela (`forgetSpentNow`) :
 * le geste vaut accord, la demande d'avant part tout de suite.
 */

import type { PrismaClient } from "@prisma/client";
import type { WorkerCfg } from "../seerr-unified";
import type { PluginConfig } from "../plugin-config";
import { addSeasonsToRequest, enqueueCleanup, updateRequestStatus } from "../db";
import { getTmdbMetaBulk } from "../tmdb-cache";
import { invalidateRequestCaches } from "../cache";
import { kickWorkerNow } from "../worker";
import { queueSnapshot, type QueueResponse } from "../arr-queue";
import { checkInJellyfin } from "./jellyfin-check";
import { liveState, type ForgetPolicy } from "./live-state";
import { requestIndex } from "./request-index";
import { openLocalRequestsFor } from "./local-requests";
import { requestTime } from "./title-truth";
import { forgetCandidates, planJobs, spentBy, type ForgetRequest, type WaveWindow } from "./auto-forget-plan";
import type { Departure } from "./library-keys";

/** Un titre traité n'est pas repris avant que la file de nettoyage ait eu le temps d'agir. */
const COOLDOWN_MS = 15 * 60_000;
const WAVE_WARN_EVERY_MS = 6 * 60 * 60_000;
/** Au plus autant de titres par passe — le reste à la passe suivante. */
const TITLES_PER_PASS = 5;
/** Une vague retenue est oubliée avec les départs que le serveur garde (30 jours). */
const WAVE_MEMORY_MS = 31 * 86_400_000;

async function titleOf(db: PrismaClient, dep: Departure, fallback: string | null): Promise<string> {
  if (fallback) return fallback;
  const meta = await getTmdbMetaBulk(db, [{ mediaType: dep.mediaType, tmdbId: dep.tmdbId }]).catch(() => null);
  return meta?.get(`${dep.mediaType}:${dep.tmdbId}`)?.title || `${dep.mediaType === "movie" ? "Film" : "Série"} #${dep.tmdbId}`;
}

/** Le nettoyage déjà en file pour cette demande Jellyseerr, s'il y en a un. */
async function pendingCleanupOf(db: PrismaClient, seerrRequestId: number): Promise<string | null> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    "SELECT id FROM seer_cleanup_queue WHERE status = 'pending' AND seerr_request_id = ? ORDER BY created_at DESC LIMIT 1",
    seerrRequestId,
  );
  return rows[0]?.id ?? null;
}

/** Une demande d'avant le départ vit encore : il y a quelque chose à retirer. */
function hasSpentRequest(dep: Departure): boolean {
  return (requestIndex.requestsFor(dep.mediaType, dep.tmdbId) ?? []).some((r) => spentBy(r, dep, liveState.policy.wholeSeries));
}

/** Le réglage de l'administrateur, tel que la règle le lit. */
export function forgetPolicyOf(config: PluginConfig): ForgetPolicy {
  return { wholeSeries: config.deleteWholeSeries === true };
}

/**
 * Sonarr ou Radarr font-ils descendre ce qui est parti (un remplacement, un
 * nouveau téléchargement) ? Alors rien ne presse : le titre revient. File
 * illisible : on ne sait pas, on n'attend pas — Jellyfin a déjà répondu.
 */
function arriving(queue: QueueResponse | null, dep: Departure): boolean {
  if (!queue) return false;
  return queue.items.some((e) => e.mediaType === dep.mediaType && e.tmdbId === dep.tmdbId
    && (dep.mediaType === "movie" || e.seasonNumber === null || dep.seasons.includes(e.seasonNumber)));
}

export function createAutoForget(db: PrismaClient, readConfig: () => PluginConfig) {
  const handled = new Map<string, number>();
  let lastWaveWarn = 0;
  let lastWaveSize = 0;
  // Les vagues vues : un disque revenu en partie ne fait pas de ses derniers absents des suppressions.
  let waves: WaveWindow[] = [];

  return async function autoForget(cfg: WorkerCfg, now: number): Promise<void> {
    // Le réglage, relu à chaque passe (installed.json peut changer sans passer par l'administration).
    liveState.setPolicy(forgetPolicyOf(readConfig()));
    if (!requestIndex.ready || !liveState.libraryReadable) return;
    for (const [key, at] of handled) if (now - at > COOLDOWN_MS) handled.delete(key);

    const plan = forgetCandidates({ departures: liveState.departures(), now, knownWaves: waves });
    waves = plan.waves.filter((w) => now - w.end < WAVE_MEMORY_MS);
    if (plan.held > 0 && (plan.held !== lastWaveSize || now - lastWaveWarn > WAVE_WARN_EVERY_MS)) {
      lastWaveWarn = now;
      console.warn(
        `[VigieLive] ${plan.held} titres partis de Jellyfin en moins d'une heure : trop pour être une suppression voulue `
        + "(disque ou partage débranché ?). Leurs demandes ne sont pas supprimées d'office ; les redemander les remplace.",
      );
    }
    lastWaveSize = plan.held;

    // Seulement les titres dont une demande d'AVANT le départ vit encore : une redemande reste.
    const pending = plan.ready
      .filter((d) => !handled.has(`${d.mediaType}:${d.tmdbId}`))
      .filter(hasSpentRequest);
    if (pending.length === 0) return;
    // Ce que Sonarr ou Radarr font redescendre attend : on repassera, sans rien marquer.
    const queue = await queueSnapshot(cfg).catch(() => null);
    const targets = pending.filter((d) => !arriving(queue, d)).slice(0, TITLES_PER_PASS);
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
      enqueued += (await forgetTitle(db, effective, "le titre a quitté Jellyfin")).length;
    }
    if (enqueued > 0) {
      invalidateRequestCaches();
      kickWorkerNow();
    }
  };
}

/**
 * Redemander un titre parti de Jellyfin : ses demandes d'avant le départ
 * partent TOUT DE SUITE, avant que la nouvelle ne parte — le geste de
 * l'utilisateur vaut accord (ni grâce, ni vague), pour ce qu'il redemande
 * seulement (`seasons` : les saisons demandées d'une série ; aucune : toute
 * la série). Seulement ce que Jellyfin a CONFIRMÉ parti. Rend les nettoyages
 * en file : la nouvelle demande attend le dernier (`pending_cleanup_id`),
 * sans quoi Jellyseerr la refuserait comme un doublon.
 */
export async function forgetSpentNow(
  db: PrismaClient, mediaType: "movie" | "tv", tmdbId: number, seasons?: readonly number[] | null,
): Promise<string[]> {
  if (!requestIndex.ready || !liveState.libraryReadable) return [];
  const dep = liveState.departures().find((d) => d.mediaType === mediaType && d.tmdbId === tmdbId);
  if (!dep) return [];
  const fact = liveState.libraryFact(mediaType, tmdbId);
  let effective: Departure;
  if (fact.state === "gone") effective = dep;
  else if (fact.state === "present" && mediaType === "tv") effective = { ...dep, seasons: dep.seasons.filter((s) => fact.goneSeasons.has(s)), whole: false };
  else return [];
  // Une série qui part en entier (réglage) part en entier, quelle que soit la saison redemandée.
  if (mediaType === "tv" && seasons && seasons.length > 0 && !(effective.whole && liveState.policy.wholeSeries)) {
    effective = { ...effective, seasons: effective.seasons.filter((s) => seasons.includes(s)), whole: false };
  }
  if (mediaType === "tv" && effective.seasons.length === 0) return [];
  if (!hasSpentRequest(effective)) return [];
  const jobs = await forgetTitle(db, effective, "redemandé");
  if (jobs.length > 0) invalidateRequestCaches();
  return jobs;
}

/** Met en file la suppression des demandes d'un titre parti. Rend les nettoyages mis en file. */
async function forgetTitle(db: PrismaClient, dep: Departure, why: string): Promise<string[]> {
  const indexed = requestIndex.requestsFor(dep.mediaType, dep.tmdbId) ?? [];
  const locals = await openLocalRequestsFor(db, dep.mediaType, dep.tmdbId);
  const localBySeerr = new Map(locals.filter((l) => l.seerrRequestId).map((l) => [l.seerrRequestId as number, l]));
  const requests: ForgetRequest[] = indexed.map((r) => {
    const local = localBySeerr.get(r.id) ?? null;
    return {
      seerrRequestId: r.id, status: r.status, seasons: r.seasons, is4k: r.is4k,
      localId: local?.id ?? null,
      jellyfinUserId: local?.jellyfinUserId ?? r.requestedBy.jellyfinUserId,
      createdAt: requestTime(r.createdAt),
    };
  });
  const jobs = planJobs(dep, requests, liveState.policy.wholeSeries);
  if (jobs.length === 0) return [];
  const title = await titleOf(db, dep, locals[0]?.title ?? null);
  const enqueued: string[] = [];
  for (const job of jobs) {
    const already = job.seerrRequestId !== null ? await pendingCleanupOf(db, job.seerrRequestId) : null;
    if (already) {
      enqueued.push(already);
      continue;
    }
    const cleanupId = await enqueueCleanup(db, {
      action: job.wholeSeries ? "forget-series" : "forget", mediaType: dep.mediaType, tmdbId: dep.tmdbId, title,
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
    enqueued.push(cleanupId);
  }
  const what = dep.mediaType === "movie" || dep.whole ? "supprimé" : `saison(s) ${dep.seasons.join(", ")} supprimée(s)`;
  console.log(`[VigieLive] « ${title} » ${what} de Jellyfin — ${enqueued.length} demande(s) retirée(s) de Jellyseerr et de Vigie (${why})`);
  return enqueued;
}
