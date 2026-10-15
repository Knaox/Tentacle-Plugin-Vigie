import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { fakeApp, json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { registerProxyRoutes } from "../routes-proxy";
import { setContentPolicy } from "./content-gate";
import { resetDenseStreams } from "./dense-pages";
import { invalidate } from "../cache";

/*
 * Le relais du catalogue face au contrôle parental : un profil restreint n'y
 * lit ni la fiche ni la saison d'un titre interdit, reçoit des pages de
 * découverte PLEINES de titres permis, une saga et une filmographie filtrées.
 * Un compte libre reçoit la page de Jellyseerr, comme avant.
 */

const SEERR = "http://seerr.test";
const kid = { userId: "kid", username: "kid", isAdmin: false };
const adult = { userId: "adult", username: "adult", isAdmin: false };

let net: ReturnType<typeof stubFetch>;
let bridgeCalls = 0;

/** Pages de découverte de 20 films numérotés ; seuls les pairs sont permis à « kid ». */
function seerr(c: FetchCall) {
  if (!c.url.startsWith(SEERR)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/api/v1/settings/main") return json({ blocklistedTags: "" });
  if (url.pathname === "/api/v1/discover/movies") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const results = Array.from({ length: 20 }, (_, i) => ({ id: (page - 1) * 20 + i + 1, title: "t" }));
    return json({ page, totalPages: 10, totalResults: 200, results });
  }
  if (url.pathname === "/api/v1/movie/3") return json({ id: 3, title: "Interdit" });
  if (url.pathname === "/api/v1/movie/4") return json({ id: 4, title: "Permis" });
  if (url.pathname === "/api/v1/collection/9") return json({ id: 9, parts: [{ id: 1, mediaType: "movie" }, { id: 2, mediaType: "movie" }] });
  if (url.pathname === "/api/v1/person/5/combined_credits") {
    return json({ cast: [{ id: 2, mediaType: "movie" }, { id: 7, mediaType: "tv" }, { id: 8, mediaType: "tv" }], crew: [{ id: 1, mediaType: "movie" }] });
  }
  return null;
}

beforeEach(() => {
  invalidate("seer:proxy:");
  resetDenseStreams();
  bridgeCalls = 0;
  net = stubFetch([seerr]);
  const even = (id: number) => id % 2 === 0;
  setContentPolicy({
    isRestricted: async (u) => u === "kid",
    filterExternalTitles: async (_u, ts) => { bridgeCalls++; return ts.filter((t) => even(t.tmdbId)); },
    allowsExternalTitle: async (_u, t) => { bridgeCalls++; return even(t.tmdbId); },
  });
});
afterEach(() => { net.restore(); setContentPolicy(null); });

async function get(user: object, path: string, query: Record<string, string> = {}) {
  const { app, call } = fakeApp();
  registerProxyRoutes(app as never, () => ({ url: SEERR, apiKey: "k" }));
  // Le faux `app` ne pose pas la méthode : le relais la lit (lectures seules).
  return call("GET", "/seerr/*", { method: "GET", user, params: { "*": path }, query: { _lang: "fr", ...query } } as never);
}

test("une fiche interdite : 403 restricted_title, sans rien demander à Jellyseerr", async () => {
  const before = net.calls.length;
  const res = await get(kid, "api/v1/movie/3");
  assert.equal(res.status, 403);
  assert.equal((res.body as { code: string }).code, "restricted_title");
  assert.equal(net.calls.length, before);
  assert.equal((await get(kid, "api/v1/tv/3/season/1")).status, 403);
});

test("une fiche permise se lit comme avant", async () => {
  const res = await get(kid, "api/v1/movie/4");
  assert.equal(res.status, 200);
  assert.equal((res.body as { title: string }).title, "Permis");
});

test("découverte : deux pages pleines de titres permis, à la suite, total qui grandit", async () => {
  const p1 = (await get(kid, "api/v1/discover/movies", { page: "1", sortBy: "popularity.desc" })).body as { results: { id: number }[]; totalResults: number; vigieDense: boolean };
  const p2 = (await get(kid, "api/v1/discover/movies", { page: "2", sortBy: "popularity.desc" })).body as { results: { id: number }[] };
  assert.equal(p1.results.length, 20);
  assert.deepEqual(p1.results.slice(0, 3).map((r) => r.id), [2, 4, 6]);
  assert.equal(p2.results[0].id, 42);
  assert.equal(p1.totalResults, 40);
  assert.equal(p1.vigieDense, true);
});

test("compte libre : la page de Jellyseerr telle quelle, sans question au filtre du pont", async () => {
  const res = (await get(adult, "api/v1/discover/movies", { page: "1" })).body as { results: unknown[]; totalResults: number; vigieDense?: boolean };
  assert.equal(res.results.length, 20);
  assert.equal(res.totalResults, 200);
  assert.equal(res.vigieDense, undefined);
  assert.equal(bridgeCalls, 0);
});

test("saga et filmographie : seuls les titres permis", async () => {
  const saga = (await get(kid, "api/v1/collection/9")).body as { parts: { id: number }[] };
  assert.deepEqual(saga.parts.map((p) => p.id), [2]);
  const credits = (await get(kid, "api/v1/person/5/combined_credits")).body as { cast: { id: number }[]; crew: unknown[] };
  assert.deepEqual(credits.cast.map((p) => p.id), [2, 8]);
  assert.deepEqual(credits.crew, []);
});

test("pont qui lève : la fiche est refusée, la découverte est vide", async () => {
  setContentPolicy({
    isRestricted: async () => true,
    filterExternalTitles: async () => { throw new Error("muet"); },
    allowsExternalTitle: async () => { throw new Error("muet"); },
  });
  assert.equal((await get(kid, "api/v1/movie/4")).status, 403);
  const page = (await get(kid, "api/v1/discover/movies", { page: "1" })).body as { results: unknown[] };
  assert.deepEqual(page.results, []);
});
