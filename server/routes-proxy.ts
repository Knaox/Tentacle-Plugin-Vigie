/* ------------------------------------------------------------------ */
/*  Seer Plugin — Proxy vers Jellyseerr (lectures du catalogue)         */
/* ------------------------------------------------------------------ */

/*
 * Extrait d'index.ts, qui dépassait la limite de trois cents lignes du projet.
 * Le proxy transparent (`/seerr/*`) injecte la clé d'API côté serveur,
 * applique le blocage par tags et met en commun les pages de catalogue — pour
 * les SEULES lectures que fait l'interface (proxy-allowlist.ts). Le proxy
 * générique `/proxy`, qui relayait n'importe quelle requête vers l'origine de
 * Jellyseerr et qu'aucun écran n'appelait, n'existe plus. Ce qu'une lecture
 * demande à Jellyseerr vit dans proxy-upstream.ts ; le contrôle parental d'un
 * profil restreint, dans policy/proxy-policy.ts.
 */

import type { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { peek, put } from "./cache";
import { parseTagSet } from "./blocklist";
import { isReadableSeerrPath } from "./proxy-allowlist";
import { carriesTitles, correctCatalog } from "./live/catalog-correct";
import {
  PROXY_TTL_MS, applyTagBlocking, blockedTagsFor, surfaceOf, upstreamOf,
  type Json, type Query,
} from "./proxy-upstream";
import { getUser } from "./seerr-unified";
import { restrictionFor } from "./policy/content-gate";
import { servePolicied } from "./policy/proxy-policy";

export function registerProxyRoutes(
  app: FastifyInstance,
  getConfig: () => Record<string, unknown>,
): void {
  /* ── Streaming proxy ───────────────────────────────────────────── */

  app.get("/seerr/*", async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)["*"];
    if (!wildcard || !isReadableSeerrPath(request.method, wildcard)) {
      return reply.status(403).send({ message: "Only catalogue reads are proxied" });
    }

    const config = getConfig();
    const seerrUrl = (config.url as string)?.replace(/\/$/, "");
    const apiKey = config.apiKey as string;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });

    const query = request.query as Query;

    /* Un profil restreint (contrôle parental du cœur) : fiches gardées, listes
     * filtrées, pages remplies (policy/proxy-policy.ts). Un compte libre passe
     * tout droit, et le relais d'avant le sert tel quel. */
    const restriction = await restrictionFor(getUser(request)?.userId);
    if (restriction) {
      const served = await servePolicied(reply, restriction, getUser(request)?.userId ?? "", { seerrUrl, apiKey, wildcard, query });
      if (served) return reply;
    }

    // Surfaces soumises au blocage par tags Jellyseerr.
    const surface = surfaceOf(wildcard, query);
    const blocklistedTags = await blockedTagsFor(seerrUrl, apiKey, request.method, surface);
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;
    const { targetUrl, headers, cacheKey } = upstreamOf(seerrUrl, apiKey, wildcard, query, request.method, surface, blocklistedTags);

    if (cacheKey) {
      const hit = peek<Record<string, unknown>>(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        // Le cache garde la page de Jellyseerr ; l'état de ses titres se corrige au service.
        return reply.send(correctCatalog(wildcard, hit));
      }
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method, headers,
        signal: AbortSignal.timeout(15_000),
      });

      // On bufferise + filtre uniquement les réponses JSON des surfaces concernées
      // quand un blocage par tags est actif. Sinon : stream transparent (historique).
      const ct = response.headers.get("content-type");
      const shouldHandleJson =
        surface.isFilterable &&
        blockedActive &&
        response.ok &&
        (ct ?? "").includes("application/json");

      if (shouldHandleJson) {
        const data = (await response.json().catch(() => null)) as Json | null;
        if (data) await applyTagBlocking(seerrUrl, apiKey, data, surface, blockedSet);

        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ? correctCatalog(wildcard, data) : {});
      }

      /* Réponse cachable, ou page qui dit l'état de ses titres (fiche, saga,
         filmographie) : on la lit — pour la garder, pour corriger ce qu'elle
         dit de titres supprimés de Jellyfin (live/catalog-correct.ts). Le
         flux direct reste la règle partout ailleurs. */
      const json = (ct ?? "").includes("application/json");
      if (response.ok && json && (cacheKey || carriesTitles(wildcard))) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (data && cacheKey) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ? correctCatalog(wildcard, data) : {});
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
