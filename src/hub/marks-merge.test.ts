import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeMarks, titleScores } from "./marks-merge";

/*
 * La note qu'on vient de poser, le titre qu'on vient de mettre de côté :
 * l'affiche doit les dire tout de suite, sans attendre que le serveur de
 * Vigie relise ses marques (une minute).
 */

const rating = (mediaType: "movie" | "series" | "episode", tmdbId: number, score: number, season = 0, episode = 0) =>
  ({ mediaType, tmdbId, seasonNumber: season, episodeNumber: episode, score });

test("seules les notes d'un TITRE comptent, au vocabulaire de Vigie", () => {
  const scores = titleScores([rating("movie", 603, 8), rating("series", 1399, 6), rating("series", 1399, 9, 1, 2), rating("episode", 5, 4)]);
  assert.deepEqual([...scores], [["movie:603", 8], ["tv:1399", 6]]);
});

test("les notes de Tentacle font foi, jusqu'au retrait", () => {
  const map = mergeMarks([["movie", 603, 1, 7], ["tv", 1399, 1, 5]], [rating("movie", 603, 9)], null);
  assert.equal(map.get("movie:603")?.score, 9);
  // Retirée depuis : le serveur le dira dans une minute, l'affiche le dit déjà.
  assert.equal(map.get("tv:1399")?.score, null);
  assert.equal(map.get("tv:1399")?.library, true);
});

test("sans les notes de Tentacle (hôte injoignable), celles du serveur restent", () => {
  assert.equal(mergeMarks([["movie", 603, 1, 7]], null, null).get("movie:603")?.score, 7);
});

test("un titre noté ou mis de côté porte ses marques, même absent du serveur", () => {
  const map = mergeMarks([], [rating("movie", 11, 4)], ["tv:42", "movie:11"]);
  assert.deepEqual(map.get("tv:42"), { library: false, watched: false, watchlist: false, liked: false, score: null, pending: true });
  assert.equal(map.get("movie:11")?.score, 4);
  assert.equal(map.get("movie:11")?.pending, true);
});
