import { test } from "node:test";
import assert from "node:assert/strict";
import { MARK_LIBRARY, MARK_LIKED, MARK_WATCHED, MARK_WATCHLIST, buildMarks } from "./user-marks";

test("un film de la bibliothèque porte ses marques Jellyfin", () => {
  const marks = buildMarks(
    [{ Type: "Movie", ProviderIds: { Tmdb: "603" }, UserData: { Played: true, IsFavorite: true, Likes: true } }],
    [], [],
  );
  assert.deepEqual(marks, [["movie", 603, MARK_LIBRARY | MARK_WATCHED | MARK_WATCHLIST | MARK_LIKED, 0]]);
});

test("deux versions d'un même film se cumulent", () => {
  const marks = buildMarks([
    { Type: "Movie", ProviderIds: { Tmdb: "603" }, UserData: { Played: false } },
    { Type: "Movie", ProviderIds: { tmdb: "603" }, UserData: { Played: true } },
  ], [], []);
  assert.deepEqual(marks, [["movie", 603, MARK_LIBRARY | MARK_WATCHED, 0]]);
});

test("« series » du cœur devient « tv », likes et notes hors bibliothèque", () => {
  const marks = buildMarks([], [{ mediaType: "series", tmdbId: 1399 }], [
    { mediaType: "series", tmdbId: 1399, score: 9 },
    { mediaType: "movie", tmdbId: 27205, score: 7 },
  ]);
  assert.deepEqual(marks, [["tv", 1399, MARK_LIKED, 9], ["movie", 27205, 0, 7]]);
});

test("« Likes » à null n'est pas « Ma liste » ; sans TMDB, rien", () => {
  const marks = buildMarks([
    { Type: "Series", ProviderIds: { Tmdb: "1" }, UserData: { Likes: null } },
    { Type: "Movie", ProviderIds: {}, UserData: { Played: true } },
    { Type: "Episode", ProviderIds: { Tmdb: "2" } },
  ], [], [{ mediaType: "episode", tmdbId: 3, score: 5 }, { mediaType: "movie", tmdbId: 4, score: 0 }]);
  assert.deepEqual(marks, [["tv", 1, MARK_LIBRARY, 0]]);
});
