/* ------------------------------------------------------------------ */
/*  Vigie — La préparation des aperçus des affiches à l'écran          */
/* ------------------------------------------------------------------ */

/*
 * Le jumeau de `previewWarm.ts` du cœur (apps/web/src/trailerPreview/) : les
 * affiches VISIBLES partent au serveur Tentacle (`POST
 * /api/trailers/preview/warm`, capacité `trailers.previewWarm`) quand la page
 * se pose ; il prépare leur aperçu en fond — jamais d'extraction YouTube — et
 * rend tout de suite ceux qui sont prêts, rangés dans la mémoire des
 * décisions (`previewSource.seed`) : leur survol n'a plus rien à demander, la
 * vidéo part à l'intention. Hors bibliothèque, c'était 2 à 4 s par titre.
 *
 * UN observateur de visibilité pour toute la page, aucun état React : une
 * affiche au repos ne porte rien de plus. Les dernières apparues d'abord, par
 * lots de 40 ; une affiche part deux fois au plus en dix minutes (la seconde
 * cinq secondes plus tard, pour recevoir ce que le serveur a préparé
 * entre-temps), jamais si sa décision est déjà connue. Rien ne part sans
 * l'envoi branché (`usePreviewWarm` : souris, aperçus permis par l'hôte,
 * capacité du serveur). hls.js se charge d'avance, au premier temps mort : le
 * premier survol ne l'attend plus.
 */

import { useEffect } from "react";
import { getCurrentLanguage } from "../utils/media-helpers";
import { useServerCapabilities } from "../utils/server-capabilities";
import { tentacleApiSend } from "../utils/tentacle-fetch";
import { deviceAllowsPreviews, useHostPreviewEnv } from "./host";
import { loadHls } from "./hlsLoader";
import { titleKey, type PreviewTitle } from "./source";
import { previewSource } from "./usePreviewEngine";

const WARM_PATH = "/api/trailers/preview/warm";
const CAPABILITY = "trailers.previewWarm";
/** Les titres d'une demande, au plus (contrat du cœur). */
const MAX_TITLES = 40;

export const WARM_TIMING = {
  settleMs: 450,
  followUpMs: 5_000,
  windowMs: 10 * 60_000,
  backoffMs: 10_000,
  rootMargin: "160px 0px",
  /** hls.js se charge quand la page a fini les siens. */
  hlsPreloadDelayMs: 2_000,
} as const;

const T = WARM_TIMING;

export interface WarmSender {
  send(titles: PreviewTitle[]): Promise<boolean>;
  isReady(title: PreviewTitle): boolean;
}

const titles = new Map<Element, PreviewTitle>();
const visibleSince = new Map<Element, number>();
const sent = new Map<string, { count: number; at: number }>();
let observer: IntersectionObserver | null = null;
let sender: WarmSender | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let changedWhileSending = false;
let pausedUntil = 0;

function schedule(delayMs: number): void {
  if (!sender) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void flush(), Math.max(0, delayMs));
}

function onVisibility(entries: IntersectionObserverEntry[]): void {
  const now = Date.now();
  for (const entry of entries) {
    if (!titles.has(entry.target)) continue;
    if (entry.isIntersecting) {
      if (!visibleSince.has(entry.target)) visibleSince.set(entry.target, now);
    } else {
      visibleSince.delete(entry.target);
    }
  }
  schedule(T.settleMs);
}

function eligibleAt(record: { count: number; at: number } | undefined, now: number): number {
  if (!record || now - record.at >= T.windowMs) return now;
  return record.count < 2 ? record.at + T.followUpMs : record.at + T.windowMs;
}

async function flush(): Promise<void> {
  timer = null;
  const current = sender;
  if (!current) return;
  if (sending) {
    changedWhileSending = true;
    return;
  }
  const now = Date.now();
  if (now < pausedUntil) {
    schedule(pausedUntil - now);
    return;
  }
  const batch: PreviewTitle[] = [];
  const seen = new Set<string>();
  let nextAt = Infinity;
  for (const [element] of [...visibleSince].sort((a, b) => b[1] - a[1])) {
    const title = titles.get(element);
    if (!title) continue;
    const key = titleKey(title);
    if (seen.has(key)) continue;
    seen.add(key);
    if (current.isReady(title)) continue;
    const at = eligibleAt(sent.get(key), now);
    if (at > now) nextAt = Math.min(nextAt, at);
    else if (batch.length < MAX_TITLES) batch.push(title);
    else nextAt = Math.min(nextAt, now + T.settleMs);
  }
  if (batch.length > 0) {
    for (const title of batch) {
      const key = titleKey(title);
      const record = sent.get(key);
      sent.set(key, { count: !record || now - record.at >= T.windowMs ? 1 : record.count + 1, at: now });
    }
    sending = true;
    changedWhileSending = false;
    const answered = await current.send(batch).catch(() => false);
    sending = false;
    if (!answered) pausedUntil = Date.now() + T.backoffMs;
    nextAt = Math.min(nextAt, Date.now() + (changedWhileSending ? T.settleMs : T.followUpMs));
  }
  for (const [key, record] of sent) if (Date.now() - record.at >= T.windowMs) sent.delete(key);
  if (nextAt !== Infinity) schedule(Math.max(50, nextAt - Date.now()));
}

/** Inscrit l'affiche d'une carte et son titre ; rend la désinscription. Sans `IntersectionObserver` : rien. */
export function trackPreviewWarm(element: Element, title: PreviewTitle): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  titles.set(element, title);
  observer ??= new IntersectionObserver(onVisibility, { rootMargin: T.rootMargin });
  observer.observe(element);
  return () => {
    titles.delete(element);
    visibleSince.delete(element);
    observer?.unobserve(element);
  };
}

/** Branche l'envoi ; rend le débranchement. */
export function setPreviewWarmSender(next: WarmSender): () => void {
  sender = next;
  schedule(T.settleMs);
  return () => {
    if (sender !== next) return;
    sender = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}

/** Pour les tests : tout oublier. */
export function resetPreviewWarm(): void {
  observer?.disconnect();
  observer = null;
  sender = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  titles.clear();
  visibleSince.clear();
  sent.clear();
  sending = false;
  changedWhileSending = false;
  pausedUntil = 0;
}

interface WarmReply {
  ready?: Array<{ subject?: { tmdbId?: unknown; mediaType?: unknown }; preview?: unknown }>;
}

/** Les aperçus prêts d'une réponse, rangés dans la mémoire des décisions (le corps est relu par `seed`). */
export function seedFromWarmReply(reply: WarmReply | null): void {
  for (const entry of reply?.ready ?? []) {
    const { tmdbId, mediaType } = entry.subject ?? {};
    if (typeof tmdbId !== "number" || (mediaType !== "movie" && mediaType !== "tv")) continue;
    previewSource.seed({ tmdbId, mediaType }, entry.preview);
  }
}

async function sendWarm(batch: PreviewTitle[]): Promise<boolean> {
  try {
    const body = { subjects: batch.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })), lang: getCurrentLanguage(), dailymotion: true };
    seedFromWarmReply(await tentacleApiSend<WarmReply>(WARM_PATH, "POST", body));
    return true;
  } catch {
    return false;
  }
}

/** Une décision déjà connue (trouvée ou absente) n'a rien à préparer ; un refus passager, si. */
function decided(title: PreviewTitle): boolean {
  const known = previewSource.known(title);
  return known !== null && known.kind !== "retry";
}

/**
 * Branche la préparation quand elle est permise — souris, aperçus permis par
 * l'hôte, serveur qui déclare `trailers.previewWarm` —, et charge hls.js au
 * premier temps mort. Montée UNE fois, par le hub.
 */
export function usePreviewWarm(): void {
  const host = useHostPreviewEnv();
  const device = deviceAllowsPreviews();
  const capabilities = useServerCapabilities(device && host.enabled);
  const enabled = device && host.enabled && capabilities?.has(CAPABILITY) === true;
  useEffect(() => {
    if (!enabled) return;
    const release = setPreviewWarmSender({ send: sendWarm, isReady: decided });
    let idle: number | null = null;
    const preload = window.setTimeout(() => {
      const task = () => void loadHls();
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(task, { timeout: 3_000 });
      else task();
    }, T.hlsPreloadDelayMs);
    return () => {
      release();
      window.clearTimeout(preload);
      if (idle !== null) window.cancelIdleCallback(idle);
    };
  }, [enabled]);
}
