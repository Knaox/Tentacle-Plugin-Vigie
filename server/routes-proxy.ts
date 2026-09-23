/* ------------------------------------------------------------------ */
/*  Seer Plugin — Proxy vers Jellyseerr (transparent + générique)      */
/* ------------------------------------------------------------------ */

/*
 * Extrait d'index.ts, qui dépassait la limite de trois cents lignes du projet :
 * extraction pure, comportement inchangé. Le proxy générique (`/proxy`) ne
 * sort jamais de l'instance configurée ; le proxy transparent (`/seerr/*`)
 * injecte la clé d'API côté serveur, applique le blocage par tags et met en
 * commun les pages de catalogue.
 */

import type { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { peek, put } from "./cache";
import {
  MEDIA_STATUS_BLOCKLISTED, getBlocklistedTags, parseTagSet,
  filterResultsByTags, type ResultItem,
} from "./blocklist";

/** Durée de vie du cache des pages de catalogue, partagé par tous. */
const PROXY_TTL_MS = 5 * 60_000;

export function registerProxyRoutes(
  app: FastifyInstance,
  getConfig: () => Record<string, unknown>,
): void {
  /* ── Proxy ─────────────────────────────────────────────────────── */

  app.post("/proxy", async (request, reply) => {
    const body = request.body as { url: string; method?: string; headers?: Record<string, string>; body?: unknown };
    if (!body.url) return reply.status(400).send({ message: "url is required" });

    const config = getConfig();
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    if (!seerrUrl) return reply.status(503).send({ message: "Seerr not configured" });

    let parsed: URL;
    try { parsed = new URL(body.url); } catch { return reply.status(400).send({ message: "Invalid URL" }); }
    if (parsed.origin !== new URL(seerrUrl).origin) {
      return reply.status(403).send({ message: "Proxy restricted to configured Seerr instance" });
    }

    try {
      const res = await fetch(body.url, {
        method: body.method || "GET", headers: body.headers,
        body: body.body ? JSON.stringify(body.body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = null; }
      return { status: res.status, ok: res.ok, data: json ?? text };
    } catch (err) {
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });

  /* ── Streaming proxy ───────────────────────────────────────────── */

  app.all("/seerr/*", async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)["*"];
    if (!wildcard || !wildcard.startsWith("api/v1/")) {
      return reply.status(400).send({ message: "Only api/v1/* paths are allowed" });
    }

    const config = getConfig();
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    const apiKey = config.apiKey as string;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });

    const query = request.query as Record<string, string>;

    // Surfaces soumises au blocage par tags Jellyseerr.
    const isDiscoverMovies = /^api\/v1\/discover\/movies(\/|$)/.test(wildcard);
    const isDiscoverTv = /^api\/v1\/discover\/tv(\/|$)/.test(wildcard);
    const isDiscover = isDiscoverMovies || isDiscoverTv;
    // search + trending : pas de without_keywords TMDB → filtrage par keywords.
    const isSearchLike =
      /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
    const isFilterable = isDiscover || isSearchLike;

    // Bouton « Afficher quand même » → on n'applique aucun filtrage.
    const showBlocked = query._showBlocked === "1" || query._showBlocked === "true";

    // On ne charge les tags bloqués que pour les GET filtrables (cache 5 min).
    const blocklistedTags =
      isFilterable && request.method === "GET"
        ? await getBlocklistedTags(seerrUrl, apiKey)
        : "";
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;

    const qsParts: string[] = [];
    let hasExcludeKeywords = false;
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang" || k === "_showBlocked") continue;
      if (k === "excludeKeywords") hasExcludeKeywords = true;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    // Discover : exclusion native côté TMDB (without_keywords), sauf si « afficher quand même ».
    if (isDiscover && blockedActive && !showBlocked && !hasExcludeKeywords) {
      qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
    }
    const qs = qsParts.join("&");
    const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;

    const headers: Record<string, string> = { "X-Api-Key": apiKey };
    if (query._lang) headers["Accept-Language"] = query._lang;

    let reqBody: string | undefined;
    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(request.body);
    }

    /* Cache mutualisé des surfaces de navigation.
     *
     * Une page de catalogue est identique pour tout le monde : les mêmes
     * filtres donnent la même réponse, et le statut des médias qu'elle porte
     * dépend de la bibliothèque, pas de qui regarde. Chaque changement de
     * filtre repartait pourtant chez Jellyseerr, qui repart chez TMDB — et
     * deux personnes appliquant le même filtre payaient l'aller-retour
     * chacune. Cinq minutes suffisent : c'est court devant le rythme auquel
     * un catalogue bouge, et long devant une session de navigation.
     *
     * Les mutations et les surfaces personnelles ne passent pas par ici. */
    const cacheable = request.method === "GET" && isFilterable;
    const cacheKey = cacheable
      ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}`
      : null;

    if (cacheKey) {
      const hit = peek<Record<string, unknown>>(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        return reply.send(hit);
      }
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method, headers, body: reqBody,
        signal: AbortSignal.timeout(15_000),
      });

      // On bufferise + filtre uniquement les réponses JSON des surfaces concernées
      // quand un blocage par tags est actif. Sinon : stream transparent (historique).
      const ct = response.headers.get("content-type");
      const shouldHandleJson =
        isFilterable &&
        blockedActive &&
        response.ok &&
        (ct ?? "").includes("application/json");

      if (shouldHandleJson) {
        const data = (await response.json().catch(() => null)) as
          | (Record<string, unknown> & { results?: ResultItem[] })
          | null;

        if (data && Array.isArray(data.results)) {
          if (showBlocked) {
            // On affiche tout, mais on indique combien d'éléments seraient masqués.
            const { blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              isDiscover ? [] : data.results, // discover déjà non-filtré ici → compteur via search-like
              blockedSet,
            );
            data.blockedCount = isDiscover ? 0 : blockedCount;
          } else if (isSearchLike) {
            // search/trending : filtrage par keywords (TMDB n'a pas without_keywords).
            const { kept, blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              data.results,
              blockedSet,
            );
            data.results = kept;
            data.blockedCount = blockedCount;
          } else {
            // discover : déjà filtré via excludeKeywords ; on retire en plus les
            // éventuels BLOCKLISTED résiduels. Compteur non significatif ici.
            const before = data.results.length;
            data.results = data.results.filter(
              (item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED,
            );
            data.blockedCount = before - data.results.length;
          }
          data.blockedActive = blockedActive;
        }

        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }

      /* Réponse cachable : on la lit pour pouvoir la garder. Le flux direct
         reste la règle partout ailleurs — ces réponses-là sont de simples
         pages de résultats, pas des médias. */
      if (cacheKey && response.ok && (ct ?? "").includes("application/json")) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }

      reply.status(response.status);
      if (ct) reply.header("content-type", ct);
      if (!response.body) return reply.send();
      return reply.send(Readable.fromWeb(response.body as any));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
}
