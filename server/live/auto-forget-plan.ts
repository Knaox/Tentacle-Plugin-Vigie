/* ------------------------------------------------------------------ */
/*  Vigie — « Supprimer la demande avec le titre » : ce qu'on décide    */
/* ------------------------------------------------------------------ */

/*
 * L'option de l'administrateur (désactivée d'office) : quand un titre est
 * supprimé de Jellyfin, sa demande disparaît aussi — de Vigie et de
 * Jellyseerr —, et Sonarr ou Radarr cessent de le surveiller pour qu'il ne
 * revienne pas tout seul. Ce module décide QUOI faire ; auto-forget.ts le
 * fait, par la file de nettoyage de Vigie (la même que « Supprimer »).
 *
 * Supprimer est irréversible : chaque garde compte.
 *   - Seulement ce qui est parti APRÈS l'activation de l'option : l'activer
 *     ne purge pas, d'un coup, des semaines de suppressions passées.
 *   - Un délai de grâce : un fichier remplacé (mise à niveau) part avant que
 *     son remplaçant n'arrive ; dix minutes couvrent l'attente du serveur.
 *   - Jellyfin redemandé juste avant d'agir (auto-forget.ts).
 *   - Une vague de départs (un disque débranché, un partage réseau perdu) ne
 *     supprime RIEN : au-delà de `MASS_TITLES` titres partis en une heure,
 *     Vigie s'abstient et le dit dans le journal.
 */

import type { Departure } from "./library-keys";
import { REQUEST, isLiveRequest } from "./title-truth";

export const FORGET_GRACE_MS = 10 * 60_000;
export const MASS_WINDOW_MS = 60 * 60_000;
export const MASS_TITLES = 20;

export interface ForgetOptions {
  enabled: boolean;
  /** Quand l'option a été activée (ms). */
  since: number | null;
}

export interface PlanInput {
  departures: readonly Departure[];
  options: ForgetOptions;
  now: number;
  graceMs?: number;
}

export type Candidates =
  | { kind: "none" }
  /** Trop de départs d'un coup : rien n'est supprimé. */
  | { kind: "mass"; count: number }
  | { kind: "ready"; departures: Departure[] };

/** Les titres partis dont la demande peut être supprimée maintenant. */
export function forgetCandidates({ departures, options, now, graceMs = FORGET_GRACE_MS }: PlanInput): Candidates {
  if (!options.enabled || options.since === null) return { kind: "none" };
  const since = options.since;
  const recent = departures.filter((d) => d.at >= since && now - d.at <= MASS_WINDOW_MS);
  if (recent.length > MASS_TITLES) return { kind: "mass", count: recent.length };
  const ready = departures.filter((d) => d.at >= since && now - d.at >= graceMs);
  return ready.length > 0 ? { kind: "ready", departures: ready } : { kind: "none" };
}

/** Une demande Jellyseerr du titre, avec sa ligne locale quand Vigie l'a faite. */
export interface ForgetRequest {
  seerrRequestId: number;
  status: number;
  seasons: readonly number[];
  is4k?: boolean;
  /** La ligne de la file locale qui la suit, s'il y en a une. */
  localId: string | null;
  jellyfinUserId: string | null;
}

export interface ForgetJob {
  /** La demande Jellyseerr à supprimer — `null` : elle reste, seules des saisons la quittent. */
  seerrRequestId: number | null;
  localId: string | null;
  /**
   * Saisons dont Sonarr cesse la surveillance et que les demandes quittent
   * (séries) ; `null` pour un film. Jamais une saison encore là.
   */
  seasons: number[] | null;
  jellyfinUserId: string | null;
  /** Vrai : la demande entière part. Faux : seules ces saisons la quittent. */
  whole: boolean;
}

/**
 * Ce que devient chaque demande d'un titre parti :
 *   - un film parti, une série partie en entier : la demande part ;
 *   - des saisons parties : une demande qui ne couvrait qu'elles part ; une
 *     demande terminée (ses autres saisons sont déjà là) part aussi ; une
 *     demande qui attend encore d'autres saisons les garde — seules les
 *     saisons parties la quittent.
 * Sonarr ne cesse de surveiller QUE les saisons parties. Refusées, en échec,
 * en 4K : rien.
 */
export function planJobs(dep: Departure, requests: readonly ForgetRequest[]): ForgetJob[] {
  const jobs: ForgetJob[] = [];
  for (const r of requests) {
    if (!isLiveRequest(r)) continue;
    const base = { localId: r.localId, jellyfinUserId: r.jellyfinUserId };
    if (dep.mediaType === "movie") {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    if (dep.whole) {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: r.seasons.length > 0 ? [...r.seasons] : null, whole: true });
      continue;
    }
    const gone = r.seasons.filter((s) => dep.seasons.includes(s));
    if (gone.length === 0) continue;
    const whole = gone.length === r.seasons.length || r.status === REQUEST.COMPLETED;
    jobs.push({ ...base, seerrRequestId: whole ? r.seerrRequestId : null, seasons: gone, whole });
  }
  return jobs;
}
