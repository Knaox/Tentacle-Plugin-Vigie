import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot, departuresOf, lastDepartureOf, libraryStateOf, parseContentKey, snapshotDigest, type KeyRow,
} from "./library-keys";

/*
 * Ce que la liste des items de Jellyfin (tenue par le serveur Tentacle) dit
 * d'un titre : là, parti, ou rien. Une ligne présente l'emporte toujours sur
 * les lignes parties du même contenu — c'est un fichier remplacé.
 */

const present = (key: string): KeyRow => ({ key, present: true, departedAt: null });
const gone = (key: string, at: number): KeyRow => ({ key, present: false, departedAt: at });

test("les clés : film, épisode, saison regroupée ; le reste est ignoré", () => {
  assert.deepEqual(parseContentKey("m:t:603"), { kind: "movie", tmdbId: 603 });
  assert.deepEqual(parseContentKey("e:t:1399:2:7"), { kind: "season", tmdbId: 1399, season: 2 });
  assert.deepEqual(parseContentKey("e:t:1399:2:"), { kind: "season", tmdbId: 1399, season: 2 });
  assert.deepEqual(parseContentKey("e:t:1399:0"), { kind: "season", tmdbId: 1399, season: 0 });
  assert.equal(parseContentKey("m:n:dune:2021"), null);
  assert.equal(parseContentKey("e:i:abcdef:1:2"), null);
  assert.equal(parseContentKey(""), null);
  assert.equal(parseContentKey(null), null);
  assert.equal(parseContentKey("m:t:0"), null);
});

test("un film parti : son dernier départ ; remplacé, il est là", () => {
  const snap = buildSnapshot([gone("m:t:603", 1000), gone("m:t:603", 2000), present("m:t:27205"), gone("m:t:27205", 500)]);
  assert.deepEqual(libraryStateOf(snap, "movie", 603), { state: "gone", since: 2000, goneSeasons: new Set() });
  assert.equal(libraryStateOf(snap, "movie", 27205).state, "present");
  assert.equal(libraryStateOf(snap, "movie", 999).state, "unknown");
});

test("une série : là tant qu'un épisode l'est ; ses saisons parties sont dites", () => {
  const snap = buildSnapshot([
    present("e:t:1399:1:1"), present("e:t:1399:1:2"),
    gone("e:t:1399:2:1", 3000), gone("e:t:1399:2:2", 3500),
    // Saison 3 : un épisode parti, un autre là → la saison reste là.
    gone("e:t:1399:3:1", 4000), present("e:t:1399:3:2"),
  ]);
  const state = libraryStateOf(snap, "tv", 1399);
  assert.equal(state.state, "present");
  assert.deepEqual(state.state === "present" && [...state.goneSeasons], [2]);
  assert.deepEqual(state.state === "present" && [...state.presentSeasons].sort(), [1, 3]);
  assert.equal(lastDepartureOf(snap, "tv", 1399), 3500);
});

test("une série dont plus rien ne reste est partie, toutes ses saisons avec", () => {
  const snap = buildSnapshot([gone("e:t:66732:1:1", 100), gone("e:t:66732:2:1", 700)]);
  const state = libraryStateOf(snap, "tv", 66732);
  assert.equal(state.state, "gone");
  assert.equal(state.state === "gone" && state.since, 700);
  assert.deepEqual(state.state === "gone" && [...state.goneSeasons].sort(), [1, 2]);
});

test("les départs : films, séries entières ou en partie — rien pour un remplacement", () => {
  const snap = buildSnapshot([
    gone("m:t:1", 10), present("m:t:2"), gone("m:t:2", 5),
    gone("e:t:3:1:1", 20), present("e:t:4:1:1"), gone("e:t:4:2:1", 30),
  ]);
  const deps = departuresOf(snap).sort((a, b) => a.tmdbId - b.tmdbId);
  assert.deepEqual(deps, [
    { mediaType: "movie", tmdbId: 1, at: 10, seasons: [], whole: true },
    { mediaType: "tv", tmdbId: 3, at: 20, seasons: [1], whole: true },
    { mediaType: "tv", tmdbId: 4, at: 30, seasons: [2], whole: false },
  ]);
});

test("l'empreinte change avec ce qui change pour un titre, pas avec l'ordre des lignes", () => {
  const a = buildSnapshot([present("m:t:1"), gone("m:t:2", 10)]);
  const b = buildSnapshot([gone("m:t:2", 10), present("m:t:1")]);
  const c = buildSnapshot([present("m:t:1"), present("m:t:2")]);
  assert.equal(snapshotDigest(a), snapshotDigest(b));
  assert.notEqual(snapshotDigest(a), snapshotDigest(c));
});
