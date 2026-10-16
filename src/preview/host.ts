/* ------------------------------------------------------------------ */
/*  Vigie — Ce que l'hôte permet : aperçus, son, serveur               */
/* ------------------------------------------------------------------ */

/*
 * La page de Vigie vit dans une iframe isolée : elle ne lit ni le réglage
 * « Aperçus de bande-annonce au survol » de Tentacle, ni son économie de
 * données, ni le son coupé. L'hôte les lui DIT (`__tentacle_env.trailerPreview`,
 * puis l'évènement `tentacle:trailerpreview` à chaque changement) et retient
 * le son coupé d'un geste (`__tentacle_bridge.setTrailerPreviewMuted`).
 *
 * Un hôte d'avant (sans le champ) n'a ni ce réglage ni d'aperçu à lui :
 * aperçus permis, son actif — la capacité du SERVEUR décide seule.
 */

import { useSyncExternalStore } from "react";
import { isMobileWebView } from "../utils/tentacle-fetch";
import { useServerCapabilities } from "../utils/server-capabilities";
import type { PreviewResponse, PreviewTitle } from "./source";
import { PREVIEW_TIMING, previewDelayOf } from "./timing";

export interface HostPreviewEnv {
  enabled: boolean;
  muted: boolean;
  /** Le volume des aperçus (0 à 1), réglé dans la mini-carte et retenu par l'hôte (Tentacle 1.30.0). */
  volume: number;
  /**
   * Le délai choisi dans Tentacle entre le début du survol et la première
   * image (additif ; un hôte d'avant ne le dit pas : 600 ms, son ancien
   * rendez-vous). Les titres de Vigie paraissent ainsi au même délai que les
   * cartes de la bibliothèque.
   */
  delayMs: number;
}

const ENV_EVENT = "tentacle:trailerpreview";

type Env = { backendUrl?: string; trailerPreview?: Partial<HostPreviewEnv> };

const validVolume = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const env = (): Env => ((window as unknown as { __tentacle_env?: Env }).__tentacle_env ?? {});

/** Le son coupé ici, quand l'hôte ne sait pas le retenir (hôte d'avant). */
let localMuted: boolean | null = null;
/** Le volume réglé ici, en attendant que l'hôte le redise (ou pour un hôte d'avant). */
let localVolume: number | null = null;
let snapshot: HostPreviewEnv | null = null;

function read(): HostPreviewEnv {
  const tp = env().trailerPreview;
  const next = {
    enabled: tp?.enabled !== false,
    muted: localMuted ?? tp?.muted === true,
    volume: localVolume ?? (validVolume(tp?.volume) ? tp.volume : PREVIEW_TIMING.volume),
    delayMs: previewDelayOf(tp?.delayMs),
  };
  if (!snapshot || snapshot.enabled !== next.enabled || snapshot.muted !== next.muted || snapshot.volume !== next.volume
    || snapshot.delayMs !== next.delayMs) snapshot = next;
  return snapshot;
}

const listeners = new Set<() => void>();
const notify = () => { for (const l of listeners) l(); };

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener(ENV_EVENT, onHostEnv);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener(ENV_EVENT, onHostEnv);
  };
}

function onHostEnv() {
  // L'hôte a dit le son : sa valeur reprend la main sur la nôtre.
  localMuted = null;
  localVolume = null;
  notify();
}

/** Le délai que l'hôte dit, lu au départ d'un cycle (sans abonnement : le cycle suivant relit). */
export function hostPreviewDelayMs(): number {
  return read().delayMs;
}

export function useHostPreviewEnv(): HostPreviewEnv {
  return useSyncExternalStore(subscribe, read, read);
}

/** Coupe ou rend le son des aperçus — retenu par l'hôte sur l'appareil quand il le sait. */
export function setPreviewMuted(muted: boolean): void {
  localMuted = muted;
  const bridge = (window as unknown as { __tentacle_bridge?: { setTrailerPreviewMuted?: (m: boolean) => void } }).__tentacle_bridge;
  bridge?.setTrailerPreviewMuted?.(muted);
  notify();
}

/**
 * Règle le volume des aperçus (0 à 1) — retenu par l'hôte sur l'appareil, comme
 * la réglette de ses propres cartes : zéro coupe le son, une valeur au-dessus
 * le rend.
 */
export function setPreviewVolume(volume: number): void {
  if (!validVolume(volume)) return;
  if (volume > 0) localVolume = volume;
  localMuted = volume === 0;
  const bridge = (window as unknown as { __tentacle_bridge?: { setTrailerPreviewVolume?: (v: number) => void } }).__tentacle_bridge;
  bridge?.setTrailerPreviewVolume?.(volume);
  notify();
}

/** Pointeur fin (souris) : le survol n'a de sens que là. */
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
const REDUCED_DATA = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-data: reduce)").matches;

/** L'appareil se prête-t-il aux aperçus (souris, pas la WebView du mobile, pas d'économie de données) ? */
export function deviceAllowsPreviews(): boolean {
  return !!FINE_POINTER && !REDUCED_DATA && !isMobileWebView();
}

const CAPABILITY = "trailers.preview";

/**
 * Le serveur sait-il donner un aperçu ? Lu dans ses capacités
 * (`server-capabilities.ts`, la liste FERMÉE du cœur) ; un serveur qui ne
 * déclare rien n'en a pas. Faux tant que ce n'est pas prouvé, sans erreur.
 */
export function useServerPreviewCapability(enabled: boolean): boolean {
  return useServerCapabilities(enabled)?.has(CAPABILITY) === true;
}

/** La demande au serveur, par le pont de l'hôte (le `fetch` relatif est relayé). */
export async function requestPreview(title: PreviewTitle, lang: string): Promise<PreviewResponse | null> {
  // `dm=1` : Vigie lit aussi un aperçu AlloCiné (Dailymotion, HLS TS relayé, que hls.js lit).
  const query = new URLSearchParams({ tmdbId: String(title.tmdbId), mediaType: title.mediaType, lang, dm: "1" });
  // Le pont de l'hôte ignore `signal` : le délai se fait par une course, pas par un abandon.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<PreviewResponse>((resolve) => {
    // Notre délai, pas une panne : le serveur décide encore (`decisionOf`).
    timer = setTimeout(() => resolve({ status: 0, body: null, timedOut: true }), PREVIEW_TIMING.fetchTimeoutMs);
  });
  const answer = (async (): Promise<PreviewResponse | null> => {
    try {
      const res = await fetch(`/api/trailers/preview?${query}`);
      let body: unknown = null;
      try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([answer, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * L'adresse ABSOLUE d'un chemin du serveur, pour la vidéo : derrière l'adresse
 * du serveur sur le bureau, derrière l'adresse de la page sur le web (le
 * document de l'iframe hérite de l'adresse de base de l'hôte).
 */
export function backendAbsolute(path: string): string {
  const base = (env().backendUrl ?? "").replace(/\/+$/, "");
  if (base) return `${base}${path}`;
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}
