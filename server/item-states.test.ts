import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeState, indexQueue, movieState, stateOfItem } from "./item-states";
import type { CalendarItem } from "./calendar-types";
import type { QueueEntry } from "./arr-queue";
import type { WindowFacts } from "./sonarr-episodes";

const TODAY = "2026-09-23";

function episode(season: number, ep: number, over: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: `tv:1:episode:${TODAY}`, date: TODAY, mediaType: "tv", tmdbId: 1, title: "Re:Zero",
    posterPath: null, backdropPath: null, overview: null, kind: "episode",
    seasonNumber: season, episodeNumber: ep, networks: null, providerIds: [],
    requestId: null, requestStatus: null, ...over,
  };
}

function queued(over: Partial<QueueEntry>): QueueEntry {
  return {
    id: "sonarr-1", source: "sonarr", mediaType: "tv", title: "Re:Zero", seasonNumber: 4, episodeNumber: 18,
    episodeTitle: null, tmdbId: 1, percent: 42, size: 100, etaSeconds: 60, validating: false,
    paused: false, stalled: false, warning: null, downloadId: "X", ...over,
  };
}

const facts = (entries: Array<[string, { hasFile: boolean; monitored: boolean }]>, days: WindowFacts["byDay"] = new Map()): WindowFacts =>
  ({ byEpisode: new Map(entries), byDay: days });

test("LE cas : saison 4 demandée — chaque épisode dit où il en est", () => {
  const f = facts([
    ["1:S4E17", { hasFile: true, monitored: true }],
    ["1:S4E18", { hasFile: false, monitored: true }],
    ["1:S4E19", { hasFile: false, monitored: true }],
  ]);
  const q = indexQueue([queued({ episodeNumber: 18 })]);
  assert.equal(stateOfItem(episode(4, 17), f, q, TODAY).state, "available");
  const e18 = stateOfItem(episode(4, 18), f, q, TODAY);
  assert.equal(e18.state, "downloading");
  assert.equal(e18.percent, 42);
  assert.equal(stateOfItem(episode(4, 19), f, q, TODAY).state, "requested");
});

test("un épisode qui coince est bloqué, pas en échec", () => {
  const q = indexQueue([queued({ stalled: true })]);
  assert.equal(stateOfItem(episode(4, 18), facts([]), q, TODAY).state, "stalled");
});

test("non suivi par Sonarr : personne ne l'a demandé", () => {
  assert.equal(episodeState({ hasFile: false, monitored: false }, undefined, "requested"), null);
  // Le fichier est là quand même : disponible.
  assert.equal(episodeState({ hasFile: true, monitored: false }, undefined, null), "available");
});

test("numérotations qui divergent : l'unique épisode du jour fait foi", () => {
  const days: WindowFacts["byDay"] = new Map([[`1:${TODAY}`, [{ hasFile: true, monitored: true }]]]);
  assert.equal(stateOfItem(episode(1, 43), facts([], days), indexQueue([]), TODAY).state, "available");
});

test("sans Sonarr, la demande dit « demandé » — jamais plus", () => {
  const item = episode(4, 18, { requestStatus: "partially_available" });
  assert.equal(stateOfItem(item, facts([]), indexQueue([]), TODAY).state, "requested");
  assert.equal(stateOfItem(episode(4, 18), facts([]), indexQueue([]), TODAY).state, null);
});

test("une première de série en partie là se dit « en partie », pas « demandé »", () => {
  const premiere = episode(1, 1, { kind: "premiere", seasonNumber: null, episodeNumber: null, requestStatus: "partially_available" });
  assert.equal(stateOfItem(premiere, facts([]), indexQueue([]), TODAY).state, "partial");
  const asked = episode(1, 1, { kind: "premiere", seasonNumber: null, episodeNumber: null, requestStatus: "approved" });
  assert.equal(stateOfItem(asked, facts([]), indexQueue([]), TODAY).state, "requested");
});

test("un film : là, en route, en cours d'importation, bloqué, demandé", () => {
  assert.equal(movieState(5, { stalled: false, percent: 10, validating: false }, null), "available");
  assert.equal(movieState(3, { stalled: false, percent: 10, validating: false }, null), "downloading");
  assert.equal(movieState(3, { stalled: false, percent: 100, validating: true }, null), "importing");
  assert.equal(movieState(3, { stalled: true, percent: 10, validating: false }, null), "stalled");
  assert.equal(movieState(2, undefined, null), "requested");
  assert.equal(movieState(undefined, undefined, "requested"), "requested");
  assert.equal(movieState(undefined, undefined, null), null);
});

test("plusieurs entrées pour un même film : bloqué seulement si toutes le sont", () => {
  const movie = (stalled: boolean) => queued({ source: "radarr", mediaType: "movie", seasonNumber: null, episodeNumber: null, tmdbId: 9, stalled });
  assert.equal(indexQueue([movie(true), movie(false)]).movies.get(9)?.stalled, false);
  assert.equal(indexQueue([movie(true), movie(true)]).movies.get(9)?.stalled, true);
});

test("la fiche d'une série : l'état de chaque épisode, pas de sa saison", async () => {
  // Pure : la même règle que le calendrier, appliquée aux faits d'une série.
  assert.equal(episodeState({ hasFile: false, monitored: true }, { stalled: false, percent: 12, validating: false }, null), "downloading");
  assert.equal(episodeState({ hasFile: false, monitored: true }, { stalled: false, percent: 100, validating: true }, null), "importing");
  assert.equal(episodeState({ hasFile: false, monitored: true }, undefined, null), "requested");
  assert.equal(episodeState({ hasFile: true, monitored: true }, { stalled: true, percent: 99, validating: false }, null), "available");
});
