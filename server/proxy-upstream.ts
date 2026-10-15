/* ------------------------------------------------------------------ */
/*  Vigie — Une lecture du catalogue chez Jellyseerr (proxy)            */
/* ------------------------------------------------------------------ */

/*
 * Extrait de routes-proxy.ts : ce qu'une lecture du catalogue demande à
 * Jellyseerr (adresse, en-têtes, clé du cache mutualisé) et le blocage par
 * tags appliqué aux surfaces de navigation. Le relais en flux s'en sert, et
 * le contrôle parental (policy/proxy-policy.ts), qui lit les pages en JSON
 * pour les filtrer avant de les servir.
 */

import { peek, put } from "./cache";
import {
  MEDIA_STATUS_BLOCKLISTED, getBlocklistedTags, parseTagSet,
  filterResultsByTags, type ResultItem,
} from "./blocklist";

/** Durée de vie du cache des pages de catalogue, partagé par tous. */
export const PROXY_TTL_MS = 5 * 60_000;

export type Query = Record<string, string>;
export type Json = Record<string, unknown> & { results?: ResultItem[] };

export interface Surface {
  isDiscover: boolean;
  /** search + trending : pas de without_keywords TMDB → filtrage par keywords. */
  isSearchLike: boolean;
  isFilterable: boolean;
  /** Bouton « Afficher quand même » → on n'applique aucun filtrage. */
  showBlocked: boolean;
}

export interface Upstream {
  targetUrl: string;
  headers: Record<string, string>;
  /** Clé du cache mutualisé des surfaces de navigation ; `null` : pas de cache. */
  cacheKey: string | null;
}

export function surfaceOf(wildcard: string, query: Query): Surface {
  const isDiscover = /^api\/v1\/discover\/(movies|tv)(\/|$)/.test(wildcard);
  const isSearchLike = /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
  return {
    isDiscover,
    isSearchLike,
    isFilterable: isDiscover || isSearchLike,
    showBlocked: query._showBlocked === "1" || query._showBlocked === "true",
  };
}

/** Les tags bloqués, pour les seuls GET filtrables (cache 5 min). */
export async function blockedTagsFor(seerrUrl: string, apiKey: string, method: string, surface: Surface): Promise<string> {
  return surface.isFilterable && method === "GET" ? getBlocklistedTags(seerrUrl, apiKey) : "";
}

export function upstreamOf(
  seerrUrl: string,
  apiKey: string,
  wildcard: string,
  query: Query,
  method: string,
  surface: Surface,
  blocklistedTags: string,
): Upstream {
  const blockedActive = parseTagSet(blocklistedTags).size > 0;
  const qsParts: string[] = [];
  let hasExcludeKeywords = false;
  for (const [k, v] of Object.entries(query)) {
    if (k === "_lang" || k === "_showBlocked") continue;
    if (k === "excludeKeywords") hasExcludeKeywords = true;
    qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  // Discover : exclusion native côté TMDB (without_keywords), sauf si « afficher quand même ».
  if (surface.isDiscover && blockedActive && !surface.showBlocked && !hasExcludeKeywords) {
    qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
  }
  const qs = qsParts.join("&");
  const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (query._lang) headers["Accept-Language"] = query._lang;
  /* Une page de catalogue est identique pour tout le monde : les mêmes filtres
   * donnent la même réponse, et le statut des médias qu'elle porte dépend de la
   * bibliothèque, pas de qui regarde. Cinq minutes : court devant le rythme
   * auquel un catalogue bouge, long devant une session de navigation. Les
   * mutations et les surfaces personnelles ne passent pas par ici. */
  const cacheKey = method === "GET" && surface.isFilterable
    ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}`
    : null;
  return { targetUrl, headers, cacheKey };
}

/** Le blocage par tags sur une page JSON filtrable (modifie `data`). */
export async function applyTagBlocking(
  seerrUrl: string,
  apiKey: string,
  data: Json,
  surface: Surface,
  blockedSet: Set<number>,
): Promise<void> {
  if (!Array.isArray(data.results)) return;
  if (surface.showBlocked) {
    // On affiche tout, mais on indique combien d'éléments seraient masqués.
    const { blockedCount } = await filterResultsByTags(
      seerrUrl, apiKey,
      surface.isDiscover ? [] : data.results, // discover déjà non-filtré ici → compteur via search-like
      blockedSet,
    );
    data.blockedCount = surface.isDiscover ? 0 : blockedCount;
  } else if (surface.isSearchLike) {
    // search/trending : filtrage par keywords (TMDB n'a pas without_keywords).
    const { kept, blockedCount } = await filterResultsByTags(seerrUrl, apiKey, data.results, blockedSet);
    data.results = kept;
    data.blockedCount = blockedCount;
  } else {
    // discover : déjà filtré via excludeKeywords ; on retire en plus les
    // éventuels BLOCKLISTED résiduels. Compteur non significatif ici.
    const before = data.results.length;
    data.results = data.results.filter((item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED);
    data.blockedCount = before - data.results.length;
  }
  data.blockedActive = true;
}

/**
 * Une page du catalogue en JSON, telle que le relais la sert avant correction :
 * cache mutualisé et blocage par tags compris. `data` nul : réponse non JSON
 * ou en erreur. Lève sur une panne réseau (le relais en fait un 502/504).
 */
export async function readCatalogJson(
  seerrUrl: string,
  apiKey: string,
  wildcard: string,
  query: Query,
): Promise<{ status: number; data: Json | null }> {
  const surface = surfaceOf(wildcard, query);
  const tags = await blockedTagsFor(seerrUrl, apiKey, "GET", surface);
  const blockedSet = parseTagSet(tags);
  const up = upstreamOf(seerrUrl, apiKey, wildcard, query, "GET", surface, tags);
  if (up.cacheKey) {
    const hit = peek<Json>(up.cacheKey);
    if (hit) return { status: 200, data: hit };
  }
  const response = await fetch(up.targetUrl, { method: "GET", headers: up.headers, signal: AbortSignal.timeout(15_000) });
  const json = (response.headers.get("content-type") ?? "").includes("application/json");
  if (!response.ok || !json) return { status: response.status, data: null };
  const data = (await response.json().catch(() => null)) as Json | null;
  if (!data) return { status: response.status, data: null };
  if (surface.isFilterable && blockedSet.size > 0) await applyTagBlocking(seerrUrl, apiKey, data, surface, blockedSet);
  if (up.cacheKey) put(up.cacheKey, data, PROXY_TTL_MS);
  return { status: response.status, data };
}
