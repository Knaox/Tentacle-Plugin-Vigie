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

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { isMobileWebView } from "../utils/tentacle-fetch";
import type { PreviewResponse, PreviewTitle } from "./source";

export interface HostPreviewEnv {
  enabled: boolean;
  muted: boolean;
}

const ENV_EVENT = "tentacle:trailerpreview";

type Env = { backendUrl?: string; trailerPreview?: Partial<HostPreviewEnv> };
const env = (): Env => ((window as unknown as { __tentacle_env?: Env }).__tentacle_env ?? {});

/** Le son coupé ici, quand l'hôte ne sait pas le retenir (hôte d'avant). */
let localMuted: boolean | null = null;
let snapshot: HostPreviewEnv | null = null;

function read(): HostPreviewEnv {
  const tp = env().trailerPreview;
  const next = {
    enabled: tp?.enabled !== false,
    muted: localMuted ?? tp?.muted === true,
  };
  if (!snapshot || snapshot.enabled !== next.enabled || snapshot.muted !== next.muted) snapshot = next;
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
  notify();
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

/** Pointeur fin (souris) : le survol n'a de sens que là. */
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
const REDUCED_DATA = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-data: reduce)").matches;

/** L'appareil se prête-t-il aux aperçus (souris, pas la WebView du mobile, pas d'économie de données) ? */
export function deviceAllowsPreviews(): boolean {
  return !!FINE_POINTER && !REDUCED_DATA && !isMobileWebView();
}

const CAPABILITY = "trailers.preview";

/**
 * Le serveur sait-il donner un aperçu ? Lu sur `/api/config` → `capabilities`
 * (la liste FERMÉE du cœur) ; un serveur qui ne déclare rien n'en a pas.
 * Faux tant que ce n'est pas prouvé, sans erreur.
 */
export function useServerPreviewCapability(enabled: boolean): boolean {
  const { data } = useQuery({
    queryKey: ["vigie", "tentacle-config-capabilities"],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return false;
        const body = (await res.json()) as { capabilities?: unknown };
        return Array.isArray(body.capabilities) && body.capabilities.includes(CAPABILITY);
      } catch {
        return false;
      }
    },
  });
  return data === true;
}

/** La demande au serveur, par le pont de l'hôte (le `fetch` relatif est relayé). */
export async function requestPreview(title: PreviewTitle, lang: string): Promise<PreviewResponse | null> {
  const query = new URLSearchParams({ tmdbId: String(title.tmdbId), mediaType: title.mediaType, lang });
  try {
    const res = await fetch(`/api/trailers/preview?${query}`);
    let body: unknown = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } catch {
    return null;
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
