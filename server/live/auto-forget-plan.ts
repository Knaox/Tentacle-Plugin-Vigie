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
 *   - Une suppression n'est pas une panne : Vigie demande à Jellyfin si les
 *     dossiers de ses bibliothèques répondent (storage-health.ts). Pendant
 *     une panne (NAS débranché, partage perdu, disque mort), RIEN ne part.
 *   - Ce qui est SUSPECT — parti autour d'une panne (l'heure d'avant
 *     comprise), ou dans une VAGUE (plus de `MASS_TITLES` titres en une
 *     heure) — attend que Jellyfin ait relu toute sa bibliothèque APRÈS
 *     (Vigie lance lui-même cette analyse, dossiers revenus). Ce qui n'est
 *     toujours pas revenu ensuite a bien été supprimé : ça part, autant de
 *     titres qu'il y en a.
 *   - Seules les demandes nées AVANT le départ — de CHAQUE saison, à sa date :
 *     une demande faite après est une REDEMANDE, jamais retirée.
 * Le passé compte aussi : la liste du serveur garde trente jours de départs,
 * et un titre supprimé avant cette règle était justement bloqué.
 *
 * Réglage « Une série supprimée part en entier » (`wholeSeries`, désactivé
 * d'office) : une série dont plus rien ne reste dans Jellyfin emporte TOUTES
 * ses demandes d'avant, même pour des saisons ou des épisodes encore
 * attendus — Sonarr cesse de la surveiller, rien de ses prochaines sorties
 * n'arrive. Une redemande, elle, reste.
 */

import type { Departure } from "./library-keys";
import { REQUEST, isLiveRequest, madeBefore } from "./title-truth";

export { madeBefore };

export const FORGET_GRACE_MS = 10 * 60_000;
export const MASS_WINDOW_MS = 60 * 60_000;
export const MASS_TITLES = 20;

/** Une vague : du premier au dernier de ses départs (ms). */
export interface WaveWindow {
  start: number;
  end: number;
}

export interface PlanInput {
  /** TOUS les départs : une vague se lit sur l'ensemble, demandes ou non. */
  departures: readonly Departure[];
  /** Ceux dont on décide (une demande d'avant vit encore) — par défaut, tous. */
  candidates?: readonly Departure[];
  now: number;
  graceMs?: number;
  /** Les vagues déjà vues : leurs titres restent suspects même revenus en partie. */
  knownWaves?: readonly WaveWindow[];
  /** Les pannes observées (fin = maintenant si elle dure). */
  outages?: readonly WaveWindow[];
  /** Les dossiers de Jellyfin, maintenant (défaut : « ok »). */
  storage?: "ok" | "down" | "unknown";
  /** Fin de la dernière analyse complète de la bibliothèque par Jellyfin (ms). */
  lastScanEnd?: number | null;
}

export interface Candidates {
  /** Les titres partis dont la demande peut être supprimée maintenant. */
  ready: Departure[];
  /** Combien de candidats attendent : panne en cours, ou suspects pas encore confirmés. */
  held: number;
  /** Toutes les vagues, connues et nouvelles — à retenir pour la passe suivante. */
  waves: WaveWindow[];
  /** Les fenêtres suspectes qu'aucune analyse de Jellyfin n'a encore suivies. */
  unconfirmed: WaveWindow[];
  /** Une analyse de Jellyfin confirmerait des suspects : à lancer. */
  scanNeeded: boolean;
}

/**
 * Les vagues : plus de `MASS_TITLES` départs dans une même heure. Fenêtre
 * glissante sur les départs triés ; deux fenêtres qui se touchent n'en font
 * qu'une.
 */
export function wavesOf(departures: readonly Departure[]): WaveWindow[] {
  const sorted = [...departures].sort((a, b) => a.at - b.at);
  const waves: WaveWindow[] = [];
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end].at - sorted[start].at > MASS_WINDOW_MS) start++;
    if (end - start + 1 <= MASS_TITLES) continue;
    const last = waves[waves.length - 1];
    if (last && sorted[start].at <= last.end) last.end = sorted[end].at;
    else waves.push({ start: sorted[start].at, end: sorted[end].at });
  }
  return waves;
}

/** Les vagues réunies, celles qui se chevauchent fondues. */
export function mergeWaves(waves: readonly WaveWindow[]): WaveWindow[] {
  const out: WaveWindow[] = [];
  for (const w of [...waves].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

export const inWave = (at: number, waves: readonly WaveWindow[]) => waves.some((w) => at >= w.start && at <= w.end);

/**
 * Les fenêtres suspectes : les vagues, et les pannes élargies à l'heure qui
 * les précède (Vigie voit la panne une minute après les premiers départs).
 * Une analyse de Jellyfin finie APRÈS une fenêtre la confirme.
 */
export function unconfirmedWindows(waves: readonly WaveWindow[], outages: readonly WaveWindow[], lastScanEnd: number | null): WaveWindow[] {
  const windows = mergeWaves([...waves, ...outages.map((o) => ({ start: o.start - MASS_WINDOW_MS, end: o.end }))]);
  return windows.filter((w) => lastScanEnd === null || lastScanEnd <= w.end);
}

/** Les titres partis dont la demande peut être supprimée maintenant. */
export function forgetCandidates({
  departures, candidates = departures, now, graceMs = FORGET_GRACE_MS, knownWaves = [], outages = [],
  storage = "ok", lastScanEnd = null,
}: PlanInput): Candidates {
  const waves = mergeWaves([...knownWaves, ...wavesOf(departures)]);
  const unconfirmed = unconfirmedWindows(waves, outages, lastScanEnd);
  const graced = candidates.filter((d) => now - d.at >= graceMs);
  if (storage !== "ok") return { ready: [], held: graced.length, waves, unconfirmed, scanNeeded: false };
  const ready = graced.filter((d) => !inWave(d.at, unconfirmed));
  // Une fenêtre finie depuis la grâce (les suppressions ont cessé) : Jellyfin peut relire.
  const scanNeeded = graced.length > ready.length && unconfirmed.some((w) => now - w.end >= graceMs);
  return { ready, held: graced.length - ready.length, waves, unconfirmed, scanNeeded };
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
  /** Sa création chez Jellyseerr (ms ou ISO) : née après le départ, c'est une redemande. */
  createdAt?: number | string | null;
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
  /** La série entière part (réglage `wholeSeries`) : Sonarr cesse de la surveiller toute. */
  wholeSeries?: boolean;
}

/** Quand cette saison est partie. */
function seasonDeparture(dep: Departure, season: number): number {
  return dep.seasonAt?.get(season) ?? dep.at;
}

/**
 * Les saisons de la demande que le départ a CONSOMMÉES : parties, chacune
 * après la demande. Une redemande d'une saison partie plus tôt n'est jamais
 * comptée, même si une autre saison est partie depuis.
 */
export function spentSeasonsOf(r: Pick<ForgetRequest, "seasons" | "createdAt">, dep: Departure): number[] {
  return r.seasons.filter((s) => dep.seasons.includes(s) && madeBefore(r.createdAt, seasonDeparture(dep, s)));
}

/** Le réglage `wholeSeries` s'applique-t-il à ce départ (une série dont plus rien ne reste) ? */
export function goesWhole(dep: Departure, wholeSeries: boolean): boolean {
  return wholeSeries && dep.mediaType === "tv" && dep.whole;
}

/** La demande a-t-elle quelque chose à perdre dans ce départ ? */
export function spentBy(
  r: Pick<ForgetRequest, "seasons" | "createdAt" | "status" | "is4k">, dep: Departure, wholeSeries = false,
): boolean {
  if (!isLiveRequest(r)) return false;
  if (goesWhole(dep, wholeSeries)) return madeBefore(r.createdAt, dep.at);
  if (dep.mediaType === "movie" || r.seasons.length === 0) {
    return (dep.mediaType === "movie" || dep.whole) && madeBefore(r.createdAt, dep.at);
  }
  return spentSeasonsOf(r, dep).length > 0;
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
export function planJobs(dep: Departure, requests: readonly ForgetRequest[], wholeSeries = false): ForgetJob[] {
  const jobs: ForgetJob[] = [];
  for (const r of requests) {
    if (!spentBy(r, dep, wholeSeries)) continue;
    const base = { localId: r.localId, jellyfinUserId: r.jellyfinUserId };
    if (goesWhole(dep, wholeSeries)) {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true, wholeSeries: true });
      continue;
    }
    if (dep.mediaType === "movie" || r.seasons.length === 0) {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    const gone = spentSeasonsOf(r, dep);
    const whole = gone.length === r.seasons.length || r.status === REQUEST.COMPLETED;
    jobs.push({ ...base, seerrRequestId: whole ? r.seerrRequestId : null, seasons: gone, whole });
  }
  return jobs;
}
