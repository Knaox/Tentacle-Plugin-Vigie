import { test } from "node:test";
import assert from "node:assert/strict";
import type { DownloadProgress } from "../types";
import type { ArrVerdict } from "../arr-truth";
import { MAX_MY_TITLES, myTitles, verdictOf, type MineRequest } from "./my-titles";

/*
 * La route `mine` du contrat `titles` : les titres que le compte attend, dans
 * un des quatre états que Tentacle sait dire — les mêmes verdicts que les
 * affiches du hub, Sonarr et Radarr d'abord.
 */

function download(over: Partial<DownloadProgress> = {}): DownloadProgress {
  return {
    percent: 42.66, size: 1000, sizeLeft: 573, etaSeconds: 600, estimatedCompletionAt: null,
    status: "downloading", validating: false, stalled: false,
    title: null, seasonNumber: null, episodeNumber: null, ...over,
  };
}

function request(over: Partial<MineRequest> = {}): MineRequest {
  return {
    id: "seerr-1", mediaType: "movie", tmdbId: 603, title: "Matrix", year: "1999",
    posterPath: "/m.jpg", seasons: null, status: "approved", download: null, ...over,
  };
}

test("une demande qui attend sans bouger est « pending », validée ou non", () => {
  for (const status of ["queued", "processing", "sent_to_seer", "approved", "unavailable", "retry_pending"] as const) {
    assert.deepEqual(verdictOf(request({ status })), { state: "pending", percent: null }, status);
  }
});

test("en route : l'avancement, ou rien quand il ne se sait pas", () => {
  assert.deepEqual(verdictOf(request({ status: "downloading", download: download() })), { state: "arriving", percent: 42.7 });
  assert.deepEqual(verdictOf(request({ status: "downloading" })), { state: "arriving", percent: null });
  assert.deepEqual(verdictOf(request({ status: "downloading", download: download({ percent: null }) })), { state: "arriving", percent: null });
});

test("complet, il se range ; coincé, il est bloqué — jamais en échec", () => {
  assert.deepEqual(verdictOf(request({ status: "downloading", download: download({ validating: true, percent: 100 }) })), { state: "importing", percent: null });
  assert.deepEqual(verdictOf(request({ status: "downloading", download: download({ stalled: true }) })), { state: "blocked", percent: null });
});

test("Sonarr et Radarr parlent d'abord", () => {
  const arr: ArrVerdict = { status: "downloading", download: download({ percent: 80 }) };
  assert.deepEqual(verdictOf(request({ status: "approved" }), arr), { state: "arriving", percent: 80 });
  // Arrivé selon les fichiers : plus une attente, même si Jellyseerr ne l'a pas encore vu.
  assert.equal(verdictOf(request({ status: "downloading", download: download() }), { status: "available", download: null }), null);
  // Jellyseerr le croyait en route, rien dans la file ni sur le disque : il attend encore.
  assert.deepEqual(verdictOf(request({ status: "downloading", download: download() }), { status: "unavailable", download: null }), { state: "pending", percent: null });
});

test("ce qui n'est plus une attente n'y figure pas", () => {
  for (const status of ["available", "failed", "deleting", "delete_failed", "deleted"] as const) {
    assert.equal(verdictOf(request({ status })), null, status);
  }
  // Là en partie sans rien qui vienne : rien à attendre de visible.
  assert.equal(verdictOf(request({ status: "partially_available" })), null);
  // … mais le reste qui arrive, oui.
  assert.equal(verdictOf(request({ status: "partially_available" }), { status: "partially_available", download: download() })?.state, "arriving");
});

test("un titre par clé : les saisons s'additionnent, ce qui bouge l'emporte", () => {
  const verdicts = new Map<string, ArrVerdict>([["s3", { status: "downloading", download: download({ percent: 10 }) }]]);
  const list = myTitles([
    request({ id: "s2", mediaType: "tv", tmdbId: 1399, title: "Game of Thrones", year: "2011", seasons: [2], status: "approved" }),
    request({ id: "m", mediaType: "movie", tmdbId: 603 }),
    request({ id: "s3", mediaType: "tv", tmdbId: 1399, title: "Game of Thrones", year: "2011", seasons: [3, 3], status: "approved" }),
  ], verdicts);
  assert.deepEqual(list, [
    {
      key: "tv:1399", title: "Game of Thrones", year: 2011, imageUrl: "https://image.tmdb.org/t/p/w185/m.jpg",
      seasons: [2, 3], state: "arriving", percent: 10,
    },
    { key: "movie:603", title: "Matrix", year: 1999, imageUrl: "https://image.tmdb.org/t/p/w185/m.jpg", seasons: null, state: "pending", percent: null },
  ]);
});

test("une série demandée en entier reste entière ; un film n'a pas de saisons", () => {
  const list = myTitles([
    request({ id: "a", mediaType: "tv", tmdbId: 1, seasons: [1] }),
    request({ id: "b", mediaType: "tv", tmdbId: 1, seasons: null }),
    request({ id: "c", mediaType: "movie", tmdbId: 2, seasons: [4] }),
  ], new Map());
  assert.equal(list[0].seasons, null);
  assert.equal(list[1].seasons, null);
});

test("sans image ni année lisible, sans identifiant TMDB, et borné", () => {
  const [first] = myTitles([request({ posterPath: null, year: null })], new Map());
  assert.equal(first.imageUrl, null);
  assert.equal(first.year, null);
  assert.deepEqual(myTitles([request({ tmdbId: 0 })], new Map()), []);
  const many = Array.from({ length: MAX_MY_TITLES + 5 }, (_, i) => request({ id: `r${i}`, tmdbId: i + 1 }));
  assert.equal(myTitles(many, new Map()).length, MAX_MY_TITLES);
});
