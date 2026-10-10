/* ------------------------------------------------------------------ */
/*  Vigie — Un titre supprimé de Jellyfin emporte sa demande : décider  */
/* ------------------------------------------------------------------ */

/*
 * Toujours, sans réglage (décision de l'administrateur, 2026-10-10 — c'était
 * une option, désactivée d'office) : quand un titre est supprimé de Jellyfin,
 * sa demande disparaît aussi — de Vigie et de Jellyseerr —, Sonarr ou Radarr
 * cessent de le surveiller, et le titre se redemande, saison par saison s'il
 * le faut. Gardée, elle le laissait « Demandé » pour toujours : impossible de
 * le redemander. Ce module décide QUOI faire ; auto-forget.ts le fait, par la
 * file de nettoyage de Vigie (la même que « Supprimer »).
 *
 * Supprimer est irréversible : chaque garde compte.
 *   - Un délai de grâce : un fichier remplacé (mise à niveau) part avant que
 *     son remplaçant n'arrive ; dix minutes couvrent l'attente du serveur.
 *   - Jellyfin redemandé juste avant d'agir, et ce que Sonarr ou Radarr font
 *     encore descendre attend (auto-forget.ts).
 *   - Une VAGUE de départs (un disque débranché, un partage réseau perdu) ne
 *     supprime RIEN : plus de `MASS_TITLES` titres partis à moins d'une heure
 *     les uns des autres — ni pendant l'heure, ni après. Ces titres-là se
 *     redemandent quand même : redemander retire la demande d'avant.
 *   - Seules les demandes nées AVANT le départ du titre : une demande faite
 *     après est une REDEMANDE, jamais retirée.
 * Le passé compte aussi : la liste du serveur garde trente jours de départs,
 * et un titre supprimé avant cette règle était justement bloqué.
 */

import type { Departure } from "./library-keys";
import { REQUEST, isLiveRequest, madeBefore } from "./title-truth";

export { madeBefore };

export const FORGET_GRACE_MS = 10 * 60_000;
export const MASS_WINDOW_MS = 60 * 60_000;
export const MASS_TITLES = 20;

export interface PlanInput {
  departures: readonly Departure[];
  now: number;
  graceMs?: number;
}

export interface Candidates {
  /** Les titres partis dont la demande peut être supprimée maintenant. */
  ready: Departure[];
  /** Combien de titres sont tenus à l'écart : partis dans une vague. */
  held: number;
}

const keyOf = (d: Departure) => `${d.mediaType}:${d.tmdbId}`;

/**
 * Les titres partis dans une vague : plus de `MASS_TITLES` départs tiennent
 * dans une même heure. Fenêtre glissante sur les départs triés.
 */
export function waveOf(departures: readonly Departure[]): Set<string> {
  const sorted = [...departures].sort((a, b) => a.at - b.at);
  const wave = new Set<string>();
  let start = 0;
  let markedTo = -1;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end].at - sorted[start].at > MASS_WINDOW_MS) start++;
    if (end - start + 1 <= MASS_TITLES) continue;
    for (let k = Math.max(start, markedTo + 1); k <= end; k++) wave.add(keyOf(sorted[k]));
    markedTo = end;
  }
  return wave;
}

/** Les titres partis dont la demande peut être supprimée maintenant. */
export function forgetCandidates({ departures, now, graceMs = FORGET_GRACE_MS }: PlanInput): Candidates {
  const wave = waveOf(departures);
  const ready = departures.filter((d) => !wave.has(keyOf(d)) && now - d.at >= graceMs);
  return { ready, held: wave.size };
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
  /** Sa création chez Jellyseerr (ms) : née après le départ, c'est une redemande. */
  createdAt?: number | null;
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
 *   - un film parti : la demande part ;
 *   - des saisons parties (la série entière comprise) : une demande qui ne
 *     couvrait qu'elles part ; une demande terminée (ses autres saisons sont
 *     déjà là) part aussi ; une demande qui attend encore d'autres saisons
 *     les garde — seules les saisons parties la quittent ;
 *   - une demande qui n'attend QUE des saisons jamais arrivées n'a rien perdu :
 *     elle reste (supprimer la saison 1 n'annule pas la saison 2 en route) ;
 *   - une demande sans saison (« toute la série », d'avant) suit la série
 *     entière.
 * Sonarr ne cesse de surveiller QUE les saisons parties. Refusées, en échec,
 * en 4K : rien.
 */
export function planJobs(dep: Departure, requests: readonly ForgetRequest[]): ForgetJob[] {
  const jobs: ForgetJob[] = [];
  for (const r of requests) {
    if (!isLiveRequest(r) || !madeBefore(r.createdAt, dep.at)) continue;
    const base = { localId: r.localId, jellyfinUserId: r.jellyfinUserId };
    if (dep.mediaType === "movie") {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    if (r.seasons.length === 0) {
      if (dep.whole) jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    const gone = r.seasons.filter((s) => dep.seasons.includes(s));
    if (gone.length === 0) continue;
    const whole = gone.length === r.seasons.length || r.status === REQUEST.COMPLETED;
    jobs.push({ ...base, seerrRequestId: whole ? r.seerrRequestId : null, seasons: gone, whole });
  }
  return jobs;
}
