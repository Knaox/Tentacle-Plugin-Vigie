import { test } from "node:test";
import assert from "node:assert/strict";
import { toCredit } from "./person-credits";

const cast = (over: Record<string, unknown> = {}) => ({
  mediaType: "movie", id: 603, title: "Matrix", releaseDate: "1999-03-30", character: "Neo", voteCount: 25000, ...over,
});

test("un rôle au générique devient une ligne de filmographie", () => {
  const c = toCredit(cast(), false);
  assert.equal(c?.title, "Matrix");
  assert.equal(c?.role, "Neo");
});

test("les apparitions « dans son propre rôle » sont écartées", () => {
  assert.equal(toCredit(cast({ character: "Himself" }), false), null);
  assert.equal(toCredit(cast({ character: "Lui-même" }), false), null);
});

test("talk-shows et journaux ne sont pas une filmographie", () => {
  assert.equal(toCredit(cast({ mediaType: "tv", name: "Late Show", genreIds: [10767] }), false), null);
});

test("au générique technique, seuls réaliser, écrire, créer comptent", () => {
  assert.equal(toCredit(cast({ job: "Director" }), true)?.role, "Director");
  assert.equal(toCredit(cast({ job: "Thanks" }), true), null);
});
