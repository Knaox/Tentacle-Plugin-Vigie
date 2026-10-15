/* ------------------------------------------------------------------ */
/*  Vigie — Annoncer un départ ou un blocage, au bon moment, une fois   */
/* ------------------------------------------------------------------ */

/*
 * À chaque passe, ce que la file dit d'une demande passe par les fenêtres
 * d'annonce (notice-watch.ts) ; ce qui est confirmé s'annonce UNE fois par
 * compte et par titre (notice-store.ts), dans la langue du compte, avec la
 * cible et l'état que le cœur range (notify/core-notification.ts) :
 *
 *   - départ   → « « Titre » est en route », état `progress` — le texte
 *                exact que le cœur reconnaît pour le pousser
 *                (seerDeparturePush.ts) ; jamais après une arrivée annoncée ;
 *   - blocage  → ce qui se passe et s'il faut patienter, état `blocked`.
 *
 * Les fenêtres vivent en mémoire : un redémarrage reprend leur compte à zéro
 * (au pire une annonce un peu plus tard), jamais une annonce de plus — la
 * base s'en souvient.
 */

import type { VigieDb } from "../storage/vigie-db";
import type { BlockedCause } from "./blocked-causes";
import type { TitleArrivalState } from "./arrival-state";
import type { DownloadProgress } from "../types";
import { blockedSentence } from "./blocked-texts";
import { accountLang } from "./account-lang";
import { claimNotice, forgetTitleNotices, releaseNotice, type NoticeKey } from "./notice-store";
import { stepBlocked, stepDeparture, type ArrivalObservation, type BlockedTrack, type DepartureTrack } from "./notice-watch";
import { requestNotificationData, type CoreNotificationState } from "../notify/core-notification";

export interface WatchedRequest {
  id: string;
  jellyfinUserId: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  notifiedSeasons: number[] | null;
}

/** Ce qui écrit un avis — injecté par les tests. */
export type PostNotice = (
  db: VigieDb, req: WatchedRequest, text: { title: string; body: string }, state: CoreNotificationState,
) => Promise<void>;

const postToCore: PostNotice = async (db, req, text, state) => {
  await db.core.notification.create({ data: requestNotificationData(req, text, state) });
};

/** Le texte du départ, MOT POUR MOT celui que le cœur pousse (seerDeparturePush.ts). */
export function departureBody(title: string): string {
  return `« ${title} » est en route`;
}

const departures = new Map<string, DepartureTrack>();
const blocks = new Map<string, BlockedTrack>();
/** Annonces déjà tranchées pour la série en cours (départ, ou cause d'un blocage) : plus de requête. */
const settled = new Set<string>();

function keep<T>(map: Map<string, T>, id: string, value: T | null): void {
  if (value) map.set(id, value);
  else map.delete(id);
}

function keyOf(req: WatchedRequest, kind: NoticeKey["kind"], cause?: BlockedCause): NoticeKey {
  return { jellyfinUserId: req.jellyfinUserId, mediaType: req.mediaType, tmdbId: req.tmdbId, kind, cause };
}

/** Annonce une fois : réserve, écrit, rend la réservation si l'écriture échoue. */
async function announce(db: VigieDb, req: WatchedRequest, key: NoticeKey, text: () => Promise<{ title: string; body: string }>,
  state: CoreNotificationState, post: PostNotice): Promise<boolean> {
  if (!(await claimNotice(db, key, req.id))) return false;
  try {
    await post(db, req, await text(), state);
    return true;
  } catch (err) {
    await releaseNotice(db, key).catch(() => {});
    throw err;
  }
}

/**
 * Une passe pour une demande : fait avancer ses fenêtres et annonce ce qui
 * vient d'être confirmé. Rend ce qui a été annoncé (pour les journaux et les tests).
 */
export async function watchArrival(
  db: VigieDb, req: WatchedRequest, seen: ArrivalObservation, now: number, post: PostNotice = postToCore,
): Promise<Array<"departure" | BlockedCause>> {
  const out: Array<"departure" | BlockedCause> = [];

  const departure = stepDeparture(departures.get(req.id) ?? null, seen, now);
  keep(departures, req.id, departure.track);
  const departureKey = `dep:${req.id}`;
  if (departure.confirmed && !settled.has(departureKey)) {
    // Jamais après une arrivée annoncée : la suite d'une série ne se dit pas « en route ».
    const nothingAnnounced = (req.notifiedSeasons ?? []).length === 0;
    if (nothingAnnounced && await announce(db, req, keyOf(req, "departure"),
      async () => ({ title: req.title, body: departureBody(req.title) }), "progress", post)) out.push("departure");
    // Tranché seulement une fois l'écriture faite (ou déjà faite) : un échec se retente à la passe suivante.
    settled.add(departureKey);
  }

  const blocked = stepBlocked(blocks.get(req.id) ?? null, seen, now);
  keep(blocks, req.id, blocked.track);
  if (!blocked.track) for (const key of settled) if (key.startsWith(`blk:${req.id}:`)) settled.delete(key);
  if (blocked.due) {
    const cause = blocked.due;
    const blockedKey = `blk:${req.id}:${cause}`;
    if (!settled.has(blockedKey)) {
      const text = async () => ({ title: req.title, body: blockedSentence(cause, await accountLang(db, req.jellyfinUserId)) });
      if (await announce(db, req, keyOf(req, "blocked", cause), text, "blocked", post)) out.push(cause);
      settled.add(blockedKey);
    }
  }
  return out;
}

/** Ce qu'une passe voit d'un titre, d'après son résumé (arr-truth `summarizeQueue`, ou le relais de Jellyseerr). */
export function observationOf(arriving: { summary: DownloadProgress | null; state?: TitleArrivalState } | null): ArrivalObservation {
  if (!arriving?.summary || !arriving.state) return { state: null, sizeLeft: null, percent: null };
  const { summary } = arriving;
  return { state: arriving.state, sizeLeft: summary.sizeLeft, percent: summary.percent, cause: summary.blockedCause ?? null };
}

/** Le titre est arrivé : ses fenêtres et sa mémoire d'avis s'effacent. */
export async function arrivalAnnounced(db: VigieDb, req: WatchedRequest): Promise<void> {
  forgetWatch(req.id);
  await forgetTitleNotices(db, req.jellyfinUserId, req.mediaType, req.tmdbId);
}

function forgetWatch(id: string): void {
  departures.delete(id);
  blocks.delete(id);
  for (const key of settled) if (key.endsWith(`:${id}`) || key.includes(`:${id}:`)) settled.delete(key);
}

/** Les demandes qui ne sont plus attendues ne gardent rien en mémoire. */
export function pruneArrivalWatch(alive: ReadonlySet<string>): void {
  const ids = new Set([...departures.keys(), ...blocks.keys()]);
  for (const key of settled) ids.add(key.split(":")[1]);
  for (const id of ids) if (!alive.has(id)) forgetWatch(id);
}

/** Tests seulement : repartir d'une mémoire vide. */
export function resetArrivalWatch(): void {
  departures.clear();
  blocks.clear();
  settled.clear();
}
