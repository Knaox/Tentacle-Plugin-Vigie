import { test } from "node:test";
import assert from "node:assert/strict";
import { requestableSeasons } from "./request-seasons";

/*
 * La saison 0 (épisodes spéciaux) ne se propose que si Jellyseerr la laisse
 * demander — éteint, il la retirerait de la demande sans le dire.
 */

const TMDB = [
  { seasonNumber: 0, episodeCount: 6 },
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 8 },
];

test("Jellyseerr ne laisse pas demander les spéciaux : les saisons numérotées seules", () => {
  assert.deepEqual(requestableSeasons(TMDB, false).map((s) => s.seasonNumber), [1, 2]);
});

test("Jellyseerr les laisse demander : la saison 0 aussi, en dernier", () => {
  assert.deepEqual(requestableSeasons(TMDB, true).map((s) => s.seasonNumber), [1, 2, 0]);
});

test("une saison 0 sans épisode n'a rien à demander", () => {
  const empty = [{ seasonNumber: 0, episodeCount: 0 }, { seasonNumber: 1, episodeCount: 10 }];
  assert.deepEqual(requestableSeasons(empty, true).map((s) => s.seasonNumber), [1]);
});
