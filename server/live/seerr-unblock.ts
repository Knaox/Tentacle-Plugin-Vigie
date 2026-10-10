/* ------------------------------------------------------------------ */
/*  Vigie — Redemander ce que Jellyfin a perdu et que Jellyseerr croit là */
/* ------------------------------------------------------------------ */

/*
 * Une série supprimée de Jellyfin reste, pour Jellyseerr, « disponible »
 * saison par saison jusqu'à sa synchronisation nocturne — et Jellyseerr
 * refuse de redemander une saison qu'il croit là (« No seasons available to
 * request »). Un film, lui, se redemande sans encombre.
 *
 * Vigie, qui sait la suppression (live-state.ts), débloque Jellyseerr avant
 * d'envoyer la demande :
 *   - la série est partie EN ENTIER et plus aucune demande ne la vise : la
 *     fiche que Jellyseerr en garde (statuts périmés) est retirée, la demande
 *     en recrée une neuve — tout de suite ;
 *   - sinon (d'autres saisons sont encore là) : Jellyseerr relance sa propre
 *     vérification (`availability-sync`, une fois par quart d'heure au plus)
 *     et la demande attend sa fin, quelques minutes, avant de partir.
 */

import type { MediaDetail } from "../anime";
import type { SeerRequest } from "../types";
import type { WorkerCfg } from "../seerr-unified";
import { triggerSeerrJob } from "../arr-service";
import { goneFromJellyfin, goneSeasonsOf, liveState } from "./live-state";
import { STATUS, isLiveRequest, spentRequest } from "./title-truth";

/** Une demande en attente de Jellyseerr repasse à ce rythme. */
const DEFER_MS = 2 * 60_000;
/** Au-delà, elle part quand même (le refus de Jellyseerr est alors traité comme avant). */
const MAX_WAIT_MS = 30 * 60_000;
const SYNC_EVERY_MS = 15 * 60_000;

const deferred = new Map<string, { until: number; since: number }>();
let lastSync = 0;

/** Les demandes qui attendent Jellyseerr — la file les saute à cette passe. */
export function deferredRequestIds(now = Date.now()): string[] {
  const out: string[] = [];
  for (const [id, d] of deferred) {
    if (now - d.since > MAX_WAIT_MS + DEFER_MS) deferred.delete(id);
    else if (d.until > now) out.push(id);
  }
  return out;
}

/** Les saisons demandées que Jellyfin a perdues mais que Jellyseerr croit encore prises. */
export function staleSeasons(request: Pick<SeerRequest, "mediaType" | "tmdbId" | "seasons">, detail: MediaDetail | null): number[] {
  if (request.mediaType !== "tv" || !request.seasons?.length) return [];
  const whole = goneFromJellyfin("tv", request.tmdbId);
  const gone = goneSeasonsOf(request.tmdbId);
  const held = new Map((detail?.mediaInfo?.seasons ?? []).map((s) => [s.seasonNumber, s.status]));
  return request.seasons.filter((s) => {
    if (!whole && !gone.has(s)) return false;
    const status = held.get(s);
    return status !== undefined && status !== STATUS.UNKNOWN && status !== STATUS.DELETED;
  });
}

function syncSoon(cfg: WorkerCfg, now: number): void {
  if (now - lastSync < SYNC_EVERY_MS) return;
  lastSync = now;
  void triggerSeerrJob(cfg.seerrUrl, cfg.seerrApiKey, "availability-sync");
  console.log("[VigieLive] Jellyseerr croit encore là des saisons supprimées de Jellyfin : vérification relancée (availability-sync)");
}

export type Unblock = "send" | "wait";

/**
 * Prépare Jellyseerr à recevoir la demande. « send » : elle peut partir ;
 * « wait » : elle repasse dans quelques minutes (la file ne l'attend pas).
 */
export async function unblockSeasons(
  cfg: WorkerCfg,
  request: Pick<SeerRequest, "id" | "title" | "tmdbId">,
  detail: MediaDetail | null,
  now = Date.now(),
): Promise<Unblock> {
  const mediaId = detail?.mediaInfo?.id;
  // Une demande consommée (d'avant la suppression) ne compte pas : elle part de toute façon.
  const library = liveState.libraryFact("tv", request.tmdbId, now);
  const live = (detail?.mediaInfo?.requests ?? []).some((r) => {
    const fact = { status: r.status, createdAt: r.createdAt, seasons: (r.seasons ?? []).map((s) => s.seasonNumber) };
    return isLiveRequest(fact) && !spentRequest(fact, library);
  });
  if (mediaId && goneFromJellyfin("tv", request.tmdbId) && !live) {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/media/${mediaId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (res && (res.ok || res.status === 404)) {
      deferred.delete(request.id);
      console.log(`[VigieLive] « ${request.title} » : fiche périmée de Jellyseerr retirée (série supprimée de Jellyfin) — la demande part`);
      return "send";
    }
  }
  const prior = deferred.get(request.id);
  const since = prior?.since ?? now;
  if (now - since >= MAX_WAIT_MS) {
    deferred.delete(request.id);
    return "send";
  }
  syncSoon(cfg, now);
  deferred.set(request.id, { until: now + DEFER_MS, since });
  return "wait";
}

/** Le refus « déjà là » de Jellyseerr porte-t-il sur des saisons que Jellyfin a perdues ? */
export function refusedForStaleSeasons(request: Pick<SeerRequest, "mediaType" | "tmdbId" | "seasons">, detail: MediaDetail | null): boolean {
  return staleSeasons(request, detail).length > 0;
}

/** Pour les tests. */
export function resetUnblock(): void {
  deferred.clear();
  lastSync = 0;
}
