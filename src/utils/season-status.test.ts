import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeStatus, seasonStatus } from "./season-status";
import type { SeriesEpisodeStates } from "../api/types-releases";

const eps: SeriesEpisodeStates = {
  tracked: true,
  states: { S4E17: "available", S4E18: "downloading", S4E19: "requested", S3E1: "available", S3E2: "available" },
  percents: { S4E18: 42 },
};

test("Re:Zero, saison 4 en cours de diffusion : l'épisode 18 arrive, la saison aussi", () => {
  assert.deepEqual(episodeStatus(eps, 4, 18), { state: "downloading", percent: 42 });
  assert.equal(episodeStatus(eps, 4, 17)?.state, "available");
  assert.equal(episodeStatus(eps, 4, 20), null);
  assert.deepEqual(seasonStatus(4, 25, 3, eps), { state: "downloading", percent: 42 });
});

test("une saison entière là : disponible ; une partie seulement : en partie", () => {
  assert.equal(seasonStatus(3, 2, 5, eps)?.state, "available");
  assert.equal(seasonStatus(3, 10, 5, eps)?.state, "partial");
});

test("Sonarr ne suit pas la série : le statut de la saison chez Jellyseerr", () => {
  const none: SeriesEpisodeStates = { tracked: false, states: {}, percents: {} };
  assert.equal(seasonStatus(1, 10, 5, none)?.state, "available");
  assert.equal(seasonStatus(1, 10, 3, none)?.state, "requested");
  assert.equal(seasonStatus(1, 10, undefined, none), null);
});

test("numérotations qui divergent : l'épisode du même jour fait foi, la saison reste à Jellyseerr", async () => {
  const { numberingMatches } = await import("./season-status");
  const mixed: SeriesEpisodeStates = {
    tracked: true,
    states: { S4E18: "downloading", S1E1: "available" },
    percents: { S4E18: 30 },
    dates: { "2026-09-23": "S4E18" },
    seasons: [1, 2, 3, 4],
  };
  assert.equal(numberingMatches(mixed, 1), false);
  assert.equal(numberingMatches(mixed, 4), true);
  // TMDB : S1E66 diffusé le 23 septembre = S4E18 chez Sonarr.
  assert.deepEqual(episodeStatus(mixed, 1, 66, "2026-09-23", false), { state: "downloading", percent: 30 });
  assert.equal(seasonStatus(1, 66, 4, mixed, false)?.state, "partial");
});
