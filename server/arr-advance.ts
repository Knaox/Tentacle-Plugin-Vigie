/* ------------------------------------------------------------------ */
/*  Vigie — Sonarr et Radarr font avancer les demandes, et l'annoncent  */
/* ------------------------------------------------------------------ */

/*
 * Une passe par minute, avant la synchro Jellyseerr : pour chaque demande
 * encore attendue, ce que la file et les fichiers de Sonarr ou de Radarr en
 * disent (arr-advance-plan.ts décide). Un fichier rangé est annoncé à la passe
 * suivante — plus d'attente du relais de Jellyseerr, de son scan de Jellyfin,
 * puis de la synchro de Vigie.
 *
 * Le coût reste borné : la file est lue une fois pour toutes les demandes
 * (partagée avec l'affichage) ; les fichiers ne sont relus à chaque passe que
 * pour ce qui est dans la file, vient d'en sortir ou se télécharge — le reste
 * une passe sur cinq.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerRequest } from "./types";
import type { WorkerCfg } from "./seerr-unified";
import { rowToRequest } from "./db-helpers";
import { updateRequestStatus, setNotifiedSeasons, upsertContentClaim } from "./db";
import { invalidateRequestCaches } from "./cache";
import { queueSnapshot } from "./arr-queue";
import { deletedFromJellyfin, matchQueue } from "./arr-truth";
import { goneFromJellyfin, goneSeasonsOf } from "./live/live-state";
import { radarrHasFile } from "./radarr-movies";
import { sonarrSeriesFacts } from "./sonarr-episodes";
import { mapLimit } from "./concurrency";
import { decideAdvance, seasonFacts, type AdvanceDecision } from "./arr-advance-plan";
import { releasedSuffix, seasonNotification } from "./season-availability";

const CANDIDATES = ["sent_to_seer", "approved", "unavailable", "downloading", "partially_available"];
const CONCURRENCY = 4;
/** Ce qui ne bouge pas se relit une passe sur cinq (~5 min). */
const IDLE_EVERY_PASSES = 5;
/** Sorti de la file : relu à chaque passe, le temps que le fichier soit rangé. */
const AFTER_QUEUE_PASSES = 3;
/** Même durée que la synchro Jellyseerr (worker-sync.ts). */
const CLAIM_TTL_SECONDS = 1800;

let passCount = 0;
/** Demande → passes restantes depuis sa sortie de la file. */
const leftQueue = new Map<string, number>();
let reachable = { radarr: false, sonarr: false };

/**
 * Sonarr (séries) ou Radarr (films) ont-ils répondu à la dernière passe ?
 * Tant que oui, un Jellyseerr en retard ne fait pas reculer une demande
 * qu'ils ont fait avancer (cf. worker-sync.ts).
 */
export function arrKnows(mediaType: "movie" | "tv"): boolean {
  return mediaType === "movie" ? reachable.radarr : reachable.sonarr;
}

/** Vrai pendant quelques passes après la sortie de la file. */
function justLeft(id: string, inQueue: boolean): boolean {
  if (inQueue) {
    leftQueue.set(id, AFTER_QUEUE_PASSES);
    return false;
  }
  const left = leftQueue.get(id);
  if (left === undefined) return false;
  if (left <= 1) leftQueue.delete(id);
  else leftQueue.set(id, left - 1);
  return true;
}

export async function advanceFromArr(db: VigieDb, cfg: WorkerCfg): Promise<void> {
  passCount++;
  const queue = await queueSnapshot(cfg).catch(() => null);
  reachable = {
    radarr: !!queue && !queue.unreachable.includes("radarr"),
    sonarr: !!queue && !queue.unreachable.includes("sonarr"),
  };
  if (!queue || (!reachable.radarr && !reachable.sonarr)) return;

  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN (${CANDIDATES.map(() => "?").join(", ")}) AND tmdb_id > 0
     ORDER BY updated_at DESC, id ASC LIMIT 500`,
    ...CANDIDATES,
  );
  const requests = rows.map(rowToRequest);
  const alive = new Set(requests.map((r) => r.id));
  for (const id of leftQueue.keys()) if (!alive.has(id)) leftQueue.delete(id);
  const idleTurn = passCount % IDLE_EVERY_PASSES === 1;

  await mapLimit(requests, CONCURRENCY, async (req) => {
    if (!arrKnows(req.mediaType)) return;
    const inQueue = matchQueue(req, queue.items).length > 0;
    const recent = justLeft(req.id, inQueue);
    if (!inQueue && !recent && !idleTurn && req.status !== "downloading") return;
    try {
      await apply(db, req, await decide(cfg, req, inQueue));
    } catch (err) {
      console.warn(`[SeerArr] "${req.title}" :`, err);
    }
  });
}

async function decide(cfg: WorkerCfg, req: SeerRequest, inQueue: boolean): Promise<AdvanceDecision> {
  const base = { status: req.status, notifiedSeasons: req.notifiedSeasons, inQueue };
  // Supprimé de Jellyfin : Radarr et Sonarr croient à leur fichier jusqu'à leur
  // prochaine relecture du disque — il ne prouve pas une arrivée.
  const deleted = deletedFromJellyfin(req);
  if (req.mediaType === "movie") {
    const hasFile = deleted ? false : await radarrHasFile(cfg, req.tmdbId);
    return decideAdvance({ ...base, mediaType: "movie", movieHasFile: hasFile });
  }
  const raw = await sonarrSeriesFacts(cfg, req.tmdbId).catch(() => null);
  const facts = raw && deleted ? withoutDeletedSeasons(raw, req.tmdbId) : raw;
  return decideAdvance({
    ...base,
    mediaType: "tv",
    seasons: facts && facts.size > 0 ? seasonFacts(facts, req.seasons) : null,
  });
}

/** Les épisodes des saisons supprimées de Jellyfin, sans leur fichier. */
function withoutDeletedSeasons<T extends { hasFile: boolean }>(facts: ReadonlyMap<string, T>, tmdbId: number): Map<string, T> {
  const whole = goneFromJellyfin("tv", tmdbId);
  const gone = goneSeasonsOf(tmdbId);
  const out = new Map<string, T>();
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    out.set(key, fact.hasFile && (whole || gone.has(season)) ? { ...fact, hasFile: false } : fact);
  }
  return out;
}

/**
 * Les notifications gardent MOT POUR MOT le format de la synchro Jellyseerr :
 * le serveur Tentacle reconnaît une annonce de disponibilité à « sur Tentacle
 * TV » et en lit les saisons (seerAvailabilityGuard.ts). Le départ se dit
 * « en route » — jamais « téléchargement », que l'application mobile
 * n'affiche nulle part.
 */
export function arrivalNotifications(req: SeerRequest, d: AdvanceDecision): Array<{ title: string; body: string }> {
  const out: Array<{ title: string; body: string }> = [];
  if (d.notifyDownloading) out.push({ title: req.title, body: `« ${req.title} » est en route` });
  if (d.notifyMovie) out.push({ title: req.title, body: `« ${req.title} » ${releasedSuffix("m", false)}` });
  if (d.notifySeasons.length > 0) {
    const requested = req.seasons ?? [];
    const arrived = (d.notified ?? req.notifiedSeasons ?? []).filter((s) => requested.includes(s)).length;
    const n = seasonNotification(req, d.notifySeasons, arrived);
    out.push({ title: n.title, body: n.message });
  }
  return out;
}

async function apply(db: VigieDb, req: SeerRequest, d: AdvanceDecision): Promise<void> {
  const notifications = arrivalNotifications(req, d);
  if (d.status === null && d.notified === null && notifications.length === 0) return;

  if (d.status) {
    await updateRequestStatus(db, req.id, d.status, d.completed ? { completedAt: new Date() } : undefined);
    console.log(`[SeerArr] "${req.title}" status: ${req.status} → ${d.status}`);
  }
  // Annonce d'abord, mémoire ensuite : un échec entre les deux réannoncerait
  // plutôt que de taire une arrivée.
  for (const n of notifications) {
    await db.core.notification.create({
      data: { jellyfinUserId: req.jellyfinUserId, type: "request_status", title: n.title, body: n.body, refId: req.id },
    });
  }
  if (d.notified) await setNotifiedSeasons(db, req.id, d.notified);
  invalidateRequestCaches(req.jellyfinUserId);
  // Le notifier du serveur annonce l'arrivée dans Jellyfin au demandeur tant
  // que la revendication court : on la prolonge au moment où tout se joue.
  await upsertContentClaim(db, req.tmdbId, req.jellyfinUserId, req.mediaType, req.title, CLAIM_TTL_SECONDS)
    .catch(() => {});
}
