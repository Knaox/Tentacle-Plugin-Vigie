import { test } from "node:test";
import assert from "node:assert/strict";
import type { VigieDb } from "./storage/vigie-db";
import { testSql } from "./test-support/sqlite-storage";
import { reconcileSeerrSeasons } from "./seerr-reconcile";
import { reassignSeerrRequestOwnership } from "./seerr-ownership";

/*
 * Un faux Seerr 3.5 : `PUT /request/{id}` rend 409 sur toute demande qui
 * n'est plus en attente (seerr#3385), et `POST /request` rend 202 — sans
 * rien créer — quand toutes les saisons sont déjà demandées ou présentes.
 */

const cfg = { seerrUrl: "http://seerr.test", seerrApiKey: "cle" };

type Call = { method: string; path: string; body?: unknown };
type Route = (body: unknown) => { status: number; json?: unknown };

async function withSeerr(routes: Record<string, Route>, run: (calls: Call[]) => Promise<void>): Promise<void> {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname, body });
    const route = routes[`${method} ${url.pathname}`];
    if (!route) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    const { status, json } = route(body);
    return new Response(json === undefined ? null : JSON.stringify(json), { status });
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const refused = () => ({ status: 409, json: { message: "Only pending requests can be modified." } });

test("Seerr 3.5 : une demande validée garde ses saisons, la suppression va au bout", async () => {
  const executed: unknown[][] = [];
  const db = { sql: testSql(), execute: async (...args: unknown[]) => { executed.push(args); return 1; } } as unknown as VigieDb;
  const seasons = (...n: number[]) => n.map((seasonNumber) => ({ seasonNumber }));
  await withSeerr({
    "GET /api/v1/tv/1399": () => ({ status: 200, json: { mediaInfo: { requests: [
      { id: 11, status: 2, seasons: seasons(1, 2) }, // validée : 409
      { id: 12, status: 1, seasons: seasons(2, 3) }, // en attente : réduite
      { id: 13, status: 5, seasons: seasons(2) }, // plus rien : supprimée
      { id: 14, status: 2, seasons: seasons(4) }, // pas concernée
    ] } } }),
    "PUT /api/v1/request/11": refused,
    "PUT /api/v1/request/12": () => ({ status: 200, json: {} }),
    "DELETE /api/v1/request/13": () => ({ status: 204 }),
  }, async (calls) => {
    await reconcileSeerrSeasons(db, cfg, 1399, [2]);
    assert.deepEqual(calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.path}`), [
      "PUT /api/v1/request/11", "PUT /api/v1/request/12", "DELETE /api/v1/request/13",
    ]);
  });
  assert.deepEqual(executed.map((a) => a.slice(1)), [["[1]", 11], ["[3]", 12], [13]]);
});

test("Seerr 3.5 : un changement d'auteur refusé ne supprime rien", async () => {
  await withSeerr({
    "GET /api/v1/request/21": () => ({ status: 200, json: {
      id: 21, status: 2, requestedBy: { id: 3 }, media: { mediaType: "tv", tmdbId: 1399 }, seasons: [{ seasonNumber: 1 }],
    } }),
    "PUT /api/v1/request/21": refused,
  }, async (calls) => {
    await assert.rejects(
      reassignSeerrRequestOwnership(cfg, 21, 7, { mediaType: "tv", tmdbId: 1399, seasons: [1] }),
      /déjà validée/,
    );
    assert.deepEqual(calls.map((c) => c.method), ["GET", "PUT"]);
  });
});

test("une demande en attente change d'auteur en place", async () => {
  await withSeerr({
    "GET /api/v1/request/22": () => ({ status: 200, json: { id: 22, status: 1, requestedBy: { id: 3 }, media: { mediaType: "movie", tmdbId: 603 } } }),
    "PUT /api/v1/request/22": (body) => ({ status: 200, json: { id: 22, requestedBy: { id: (body as { userId: number }).userId } } }),
  }, async () => {
    assert.deepEqual(await reassignSeerrRequestOwnership(cfg, 22, 7, { mediaType: "movie", tmdbId: 603, seasons: null }), { method: "put" });
  });
});

test("un 202 « No seasons available » n'est pas une demande recréée", async () => {
  await withSeerr({
    "POST /api/v1/request": () => ({ status: 202, json: { message: "No seasons available to request" } }),
  }, async () => {
    await assert.rejects(
      reassignSeerrRequestOwnership(cfg, 23, 7, { mediaType: "tv", tmdbId: 1399, seasons: [1] }),
      /\(202\)/,
    );
  });
});
