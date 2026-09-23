import { test } from "node:test";
import assert from "node:assert/strict";
import { mapGenres, presetTitle } from "./presetTitle";
import type { BrowsePreset } from "../hub/HubContext";

const t = (key: string) => key.replace("seer:", "");

test("« Films populaires » passé en séries devient « Séries populaires »", () => {
  const preset: BrowsePreset = { id: "popular:movies", kind: "popular", title: "Films populaires", mediaType: "movies" };
  assert.equal(presetTitle(preset, "movies", { genres: [] }, t), "titlePopular_movies");
  assert.equal(presetTitle(preset, "tv", { genres: [] }, t), "titlePopular_tv");
  assert.equal(presetTitle(preset, "anime", { genres: [] }, t), "titlePopular_anime");
});

test("un genre se nomme dans le dictionnaire du type affiché", () => {
  const preset: BrowsePreset = { id: "genre:movie:28", kind: "genre", title: "Action", mediaType: "movies" };
  assert.equal(presetTitle(preset, "movies", { genres: [28] }, t), "genreAction · type_movies");
  assert.equal(presetTitle(preset, "tv", { genres: [10759] }, t), "genreActionAdventure · type_tv");
  // Plus de genre : on ne le revendique plus.
  assert.equal(presetTitle(preset, "tv", { genres: [] }, t), "titleAll_tv");
});

test("une plateforme garde son nom, le type suit", () => {
  const preset: BrowsePreset = { id: "provider:movies:8", kind: "provider", label: "Netflix", title: "Netflix", mediaType: "movies" };
  assert.equal(presetTitle(preset, "tv", { genres: [] }, t), "Netflix · type_tv");
});

test("changer de type garde les genres qui ont un équivalent", () => {
  assert.deepEqual(mapGenres([35, 28, 12, 27], "movies", "tv"), [35, 10759]);
  assert.deepEqual(mapGenres([10765], "anime", "movies"), [878]);
  assert.deepEqual(mapGenres([16, 35], "tv", "anime"), [16, 35]);
});
