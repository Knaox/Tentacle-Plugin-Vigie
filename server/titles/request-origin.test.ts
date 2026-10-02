import { test } from "node:test";
import assert from "node:assert/strict";
import { ofOrigin, originOf, readOriginFilter, readRequestOrigin } from "./request-origin";
import { myTitles, type MineRequest } from "./my-titles";

/*
 * D'où part une demande : deux champs facultatifs de `POST /titles/request`,
 * gardés avec elle, et le filtre de `GET /titles/mine` — additifs : qui ne
 * dit rien n'a pas d'origine, et sans filtre la liste reste entière.
 */

test("un téléviseur dit son origine et sa plateforme", () => {
  assert.deepEqual(readRequestOrigin({ mediaType: "movie", tmdbId: 603, origin: "tv", platform: "appletv" }), { origin: "tv", platform: "appletv" });
  assert.deepEqual(readRequestOrigin({ origin: "tv" }), { origin: "tv", platform: null });
});

test("un client qui ne dit rien — le hub, le web, un Tentacle d'avant — n'a pas d'origine", () => {
  for (const body of [{ mediaType: "movie", tmdbId: 603 }, {}, null, undefined, "tv", 42]) {
    assert.equal(readRequestOrigin(body), null, JSON.stringify(body));
  }
});

test("rien d'illisible n'entre en base", () => {
  for (const origin of ["", "TV", "t v", "tv;drop", "1tv", "x".repeat(17), 3, true, ["tv"], { tv: 1 }]) {
    assert.equal(readRequestOrigin({ origin, platform: "appletv" }), null, JSON.stringify(origin));
  }
  // Une plateforme illisible se perd seule : l'origine reste.
  for (const platform of ["Apple TV", "", "y".repeat(25), 7, null]) {
    assert.deepEqual(readRequestOrigin({ origin: "tv", platform }), { origin: "tv", platform: null }, JSON.stringify(platform));
  }
});

test("le filtre de `mine` : absent, toute la liste ; donné, cette origine seule ; illisible, rien", () => {
  assert.equal(readOriginFilter(undefined), undefined);
  assert.equal(readOriginFilter("tv"), "tv");
  for (const raw of ["", "TV", "tv,web", ["tv", "tv"], 1]) assert.equal(readOriginFilter(raw), "", JSON.stringify(raw));
});

test("les demandes d'une origine ; sans filtre, toutes", () => {
  const rows = [
    { id: "a", origin: "tv" },
    { id: "b", origin: null },
    { id: "c", origin: "tv" },
  ];
  assert.deepEqual(ofOrigin(rows, "tv").map((r) => r.id), ["a", "c"]);
  assert.deepEqual(ofOrigin(rows, undefined).map((r) => r.id), ["a", "b", "c"]);
  // Les demandes d'avant, sans origine, ne sont d'aucune origine filtrée.
  assert.deepEqual(ofOrigin(rows, ""), []);
  assert.deepEqual(ofOrigin(rows, "web"), []);
});

test("une relance garde l'origine de la demande qu'elle remplace", () => {
  assert.deepEqual(originOf({ origin: "tv", platform: "appletv" }), { origin: "tv", platform: "appletv" });
  assert.equal(originOf({ origin: null, platform: null }), null);
});

test("« Mes demandes » d'une TV : ses titres, et d'un titre demandé de deux endroits, ses saisons à elle", () => {
  const got = { title: "Game of Thrones", year: "2011", posterPath: "/g.jpg", status: "approved", download: null } as const;
  const requests: Array<MineRequest & { origin: string | null }> = [
    { ...got, id: "tv-1", mediaType: "tv", tmdbId: 1399, seasons: [2], origin: "tv" },
    { ...got, id: "web-1", mediaType: "tv", tmdbId: 1399, seasons: [1], origin: null },
    { ...got, id: "web-2", mediaType: "movie", tmdbId: 603, title: "Matrix", year: "1999", seasons: null, origin: null },
  ];
  const seasonsOf = (origin: string | undefined) => myTitles(ofOrigin(requests, origin), new Map()).map((t) => [t.key, t.seasons]);
  assert.deepEqual(seasonsOf("tv"), [["tv:1399", [2]]]);
  // Sans filtre, la liste d'avant : tout le compte, les saisons additionnées.
  assert.deepEqual(seasonsOf(undefined), [["tv:1399", [1, 2]], ["movie:603", null]]);
});
