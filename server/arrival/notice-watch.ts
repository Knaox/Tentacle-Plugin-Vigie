/* ------------------------------------------------------------------ */
/*  Vigie — Ni fausse joie, ni fausse alerte : les fenêtres d'annonce   */
/* ------------------------------------------------------------------ */

/*
 * « En route » partait dès que Sonarr prenait le titre dans sa file — et
 * Sonarr bloquait souvent dans la foulée (client qui refuse, source sans
 * personne pour la partager). Un blocage passager (une source qui revient)
 * aurait de même alerté pour rien. Deux règles pures, horloge injectée, que
 * le worker applique à chaque passe (une par minute) :
 *
 *   - le DÉPART s'annonce quand le titre est en route depuis
 *     DEPARTURE_CONFIRM_MS SANS interruption, et que des octets sont
 *     réellement arrivés entre la première lecture et celle-ci ;
 *   - un BLOCAGE s'annonce quand la même cause tient sa durée
 *     (`confirmMs` de blocked-causes.ts) sans interruption.
 *
 * Pourquoi trois minutes pour le départ. Sonarr et Radarr relisent leur
 * client toutes les minutes (« Refresh Monitored Downloads ») ; un client qui
 * refuse le fichier, ou une source morte (qBittorrent la dit « stalled »
 * après une à deux minutes sans pair), se voit donc au plus tard à la
 * deuxième relecture. Trois minutes, c'est trois passes du worker : deux
 * relectures de Sonarr et une marge. Au-delà, l'annonce perdrait son sens —
 * un épisode courant met bien plus longtemps à arriver, et un titre qui
 * arrive plus vite saute l'annonce de départ (son arrivée la remplace).
 */

import { CAUSES, type BlockedCause } from "./blocked-causes";
import type { TitleArrivalState } from "./arrival-state";

export const DEPARTURE_CONFIRM_MS = 3 * 60_000;

/** Ce qu'une passe voit d'un titre dans la file. */
export interface ArrivalObservation {
  /** `null` : rien de ce titre n'est dans la file. */
  state: TitleArrivalState | null;
  sizeLeft: number | null;
  percent: number | null;
  /** La cause quand le titre est bloqué. */
  cause?: BlockedCause | null;
}

/** La première lecture « en route » d'une série ininterrompue : la référence. */
export interface DepartureTrack {
  since: number;
  sizeLeft: number | null;
  percent: number | null;
}

/** Des octets sont-ils arrivés depuis la référence ? Sans aucune mesure, le temps seul fait foi. */
function moved(base: DepartureTrack, now: ArrivalObservation): boolean {
  const bytes = base.sizeLeft != null && now.sizeLeft != null;
  const share = base.percent != null && now.percent != null;
  if (!bytes && !share) return base.sizeLeft == null && base.percent == null && now.sizeLeft == null && now.percent == null;
  return (bytes && (now.sizeLeft as number) < (base.sizeLeft as number))
    || (share && (now.percent as number) > (base.percent as number));
}

/**
 * Une passe de la règle du départ. Tout ce qui n'est pas « en route »
 * l'interrompt : bloqué, en attente, ou déjà en importation (l'arrivée
 * l'annoncera — un départ juste avant serait du bruit).
 */
export function stepDeparture(
  prev: DepartureTrack | null, seen: ArrivalObservation, now: number,
): { track: DepartureTrack | null; confirmed: boolean } {
  if (seen.state !== "downloading") return { track: null, confirmed: false };
  if (!prev) return { track: { since: now, sizeLeft: seen.sizeLeft, percent: seen.percent }, confirmed: false };
  return { track: prev, confirmed: now - prev.since >= DEPARTURE_CONFIRM_MS && moved(prev, seen) };
}

/** Une cause de blocage, et depuis quand elle tient sans interruption. */
export interface BlockedTrack {
  cause: BlockedCause;
  since: number;
}

/**
 * Une passe de la règle du blocage : la cause doit tenir sa durée. Une autre
 * cause reprend le compte à zéro ; un titre qui avance de nouveau l'efface.
 */
export function stepBlocked(
  prev: BlockedTrack | null, seen: ArrivalObservation, now: number,
): { track: BlockedTrack | null; due: BlockedCause | null } {
  if (seen.state !== "blocked") return { track: null, due: null };
  const cause = seen.cause ?? "unknown";
  if (!prev || prev.cause !== cause) return { track: { cause, since: now }, due: null };
  return { track: prev, due: now - prev.since >= CAUSES[cause].confirmMs ? cause : null };
}
