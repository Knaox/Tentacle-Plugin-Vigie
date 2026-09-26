import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArrServerInfo } from "../../../api/types";
import { arrChoice, tagLabels, upsertProfile, usesRadarr, usesSonarr, withDefault } from "./profileSummary";

const SERVERS: ArrServerInfo[] = [
  { id: 1, name: "Radarr 4K", isDefault: false, profiles: [{ id: 7, name: "UHD" }], rootFolders: [], tags: [{ id: 3, label: "4k" }] },
  { id: 2, name: "Radarr", isDefault: true, profiles: [{ id: 4, name: "HD-1080p" }], rootFolders: [], tags: [] },
];

test("le résumé d'un profil nomme son serveur et sa qualité, ou dit « par défaut »", () => {
  assert.deepEqual(arrChoice(SERVERS, 1, 7, "/films"), { server: SERVERS[0], quality: "UHD", folder: "/films" });
  // Sans serveur choisi : celui par défaut de Jellyseerr.
  assert.deepEqual(arrChoice(SERVERS, undefined, undefined, undefined), { server: SERVERS[1], quality: null, folder: null });
  assert.deepEqual(arrChoice([], 1, 7), { server: null, quality: null, folder: null });
});

test("Radarr sert les films, Sonarr les séries et les animés", () => {
  assert.equal(usesRadarr("movie"), true);
  assert.equal(usesRadarr("anime"), false);
  assert.equal(usesSonarr("anime"), true);
  assert.equal(usesSonarr("all") && usesRadarr("all"), true);
});

test("les tags se lisent par leur nom, sinon par leur numéro", () => {
  assert.deepEqual(tagLabels(SERVERS, [3, 12]), ["4k", "#12"]);
});

test("un seul profil par défaut ; enregistrer remplace ou ajoute", () => {
  const a = { id: "a", name: "A", isDefault: true };
  const b = { id: "b", name: "B" };
  assert.deepEqual(withDefault([a, b], "b").map((p) => p.isDefault), [false, true]);
  assert.deepEqual(upsertProfile([a, b], { id: "b", name: "B2" }).map((p) => p.name), ["A", "B2"]);
  assert.deepEqual(upsertProfile([a], { id: "c", name: "C" }).map((p) => p.id), ["a", "c"]);
});
