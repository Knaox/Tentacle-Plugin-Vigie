/* ------------------------------------------------------------------ */
/*  Vigie — La machine de l'aperçu au survol                           */
/* ------------------------------------------------------------------ */

/*
 * Un réducteur PUR — le temps n'y entre que par les évènements (`at`, ms) ;
 * ce qui doit arriver plus tard se lit dans `previewDeadline`. Version
 * resserrée de la machine des cartes de Tentacle (`previewMachine.ts` du
 * cœur), aux mêmes règles :
 *
 *   idle ─survol→ intent ─250 ms + arrêté 100 ms→ fetching ─flux→ buffering ─800 ms→ shown
 *                                                  │ absent      │ erreur, 8 s       │ erreur, fin
 *                                                  └→ over ←─────┴───────────────────┘
 *
 * Révélation : au plus tôt à 800 ms du début du survol, avec la première
 * image de la vidéo, OU l'image du titre décodée et le premier fragment vidéo
 * reçu (le flux coule) — la vidéo la rejoint alors. Jamais un cadre noir,
 * jamais un flux bloqué qui ferait tout grandir. Un refus PASSAGER (429,
 * réseau) attend l'échéance dite, deux fois au plus.
 */

import { PREVIEW_TIMING } from "./timing";

export type PreviewPhase = "idle" | "intent" | "fetching" | "buffering" | "shown" | "over";

export interface PreviewState {
  phase: PreviewPhase;
  /** Début du survol : l'intention et la révélation en partent. */
  since: number;
  /** Le pointeur est arrêté depuis… (un mouvement, un coup de molette la repoussent). */
  stillSince: number;
  /** La première image doit être là avant cette échéance. */
  readyBy: number | null;
  videoReady: boolean;
  fragment: boolean;
  stillReady: boolean;
  /** Un refus passager : on redemande à cette échéance. */
  retryAt: number | null;
  retries: number;
  /** Chaque demande au serveur a son numéro : l'effet de la page demande à chaque changement. */
  attempt: number;
  /** Fini par un échec de LECTURE (le flux trouvé ne se lit pas) : à retenir. */
  failed: boolean;
}

export type PreviewEvent =
  | { type: "start"; at: number }
  | { type: "move"; at: number }
  | { type: "tick"; at: number }
  | { type: "found"; at: number }
  | { type: "missing"; at: number }
  | { type: "retry"; at: number; retryAt: number }
  | { type: "videoReady"; at: number }
  | { type: "fragment"; at: number }
  | { type: "stillReady"; at: number }
  | { type: "fail"; at: number }
  | { type: "ended"; at: number }
  | { type: "stop"; at: number };

export const IDLE: PreviewState = {
  phase: "idle", since: 0, stillSince: 0, readyBy: null, videoReady: false, fragment: false,
  stillReady: false, retryAt: null, retries: 0, attempt: 0, failed: false,
};

const T = PREVIEW_TIMING;

const intentAt = (s: PreviewState) => Math.max(s.since + T.intentMs, s.stillSince + T.intentStillMs);
const revealAt = (s: PreviewState) => s.since + T.revealMs;
const hasPicture = (s: PreviewState) => s.videoReady || (s.fragment && s.stillReady);
const withVideo = (s: PreviewState) => s.phase === "buffering" || s.phase === "shown";

/** Fait passer les échéances atteintes à `at`. */
function elapse(s: PreviewState, at: number): PreviewState {
  let next = s;
  if (next.phase === "intent" && at >= intentAt(next)) next = { ...next, phase: "fetching", attempt: next.attempt + 1 };
  if (next.phase === "fetching" && next.retryAt !== null && at >= next.retryAt) {
    next = { ...next, retryAt: null, attempt: next.attempt + 1 };
  }
  if (withVideo(next) && next.readyBy !== null && !next.videoReady && at >= next.readyBy) {
    return { ...next, phase: "over", failed: true, readyBy: null };
  }
  if (next.phase === "buffering" && hasPicture(next) && at >= revealAt(next)) next = { ...next, phase: "shown" };
  return next;
}

export function reducePreview(state: PreviewState, event: PreviewEvent): PreviewState {
  const at = event.at;
  const s = event.type === "start" || event.type === "stop" ? state : elapse(state, at);
  switch (event.type) {
    case "start":
      return { ...IDLE, phase: "intent", since: at, stillSince: at, attempt: state.attempt };
    case "stop":
      return { ...IDLE, attempt: state.attempt };
    case "tick":
      return s;
    case "move":
      return s.phase === "intent" ? { ...s, stillSince: Math.max(s.stillSince, at) } : s;
    case "found":
      return s.phase === "fetching" ? elapse({ ...s, phase: "buffering", readyBy: at + T.readyTimeoutMs }, at) : s;
    case "missing":
      return s.phase === "fetching" ? { ...s, phase: "over" } : s;
    case "retry":
      if (s.phase !== "fetching" || s.retryAt !== null) return s;
      if (s.retries >= T.maxRetries) return { ...s, phase: "over" };
      return { ...s, retryAt: Math.max(at, event.retryAt), retries: s.retries + 1 };
    case "videoReady":
      return withVideo(s) ? elapse({ ...s, videoReady: true, readyBy: null }, at) : s;
    case "fragment":
      return withVideo(s) ? elapse({ ...s, fragment: true }, at) : s;
    case "stillReady":
      return withVideo(s) ? elapse({ ...s, stillReady: true }, at) : s;
    case "fail":
      return withVideo(s) ? { ...s, phase: "over", failed: true, readyBy: null } : s;
    case "ended":
      return withVideo(s) ? { ...s, phase: "over", readyBy: null } : s;
  }
}

/** La prochaine échéance à laquelle rendre `tick`, ou `null`. */
export function previewDeadline(s: PreviewState): number | null {
  if (s.phase === "intent") return intentAt(s);
  if (s.phase === "fetching") return s.retryAt;
  if (!withVideo(s)) return null;
  const times: number[] = [];
  if (s.readyBy !== null && !s.videoReady) times.push(s.readyBy);
  if (s.phase === "buffering" && hasPicture(s)) times.push(revealAt(s));
  return times.length > 0 ? Math.min(...times) : null;
}
