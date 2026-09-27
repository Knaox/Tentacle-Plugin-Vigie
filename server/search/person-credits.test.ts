import { test } from "node:test";
import assert from "node:assert/strict";
import { creditLabel, pickCredits, readRole, toCredit } from "./person-credits";

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

test("au générique technique, seuls les métiers qu'on sait nommer comptent", () => {
  assert.equal(toCredit(cast({ job: "Director" }), true)?.role, "Director");
  assert.equal(toCredit(cast({ job: "Original Music Composer" }), true)?.role, "Original Music Composer");
  assert.equal(toCredit(cast({ job: "Thanks" }), true), null);
});

const credit = (over: Record<string, unknown>, crew: boolean) => {
  const c = toCredit(cast(over), crew);
  assert.ok(c);
  return c;
};

test("le rôle d'arrivée, validé : un métier connu, sinon rien", () => {
  assert.equal(readRole("Director"), "Director");
  assert.equal(readRole("GuestStar"), "Actor");
  assert.equal(readRole("Lyricist"), null);
  assert.equal(readRole(undefined), null);
});

test("sans rôle d'arrivée : jouer avant réaliser, et ni produire ni composer", () => {
  const picked = pickCredits([
    credit({ id: 1 }, false),
    credit({ id: 1, job: "Director" }, true),
    credit({ id: 2, job: "Producer" }, true),
    credit({ id: 3, job: "Original Music Composer" }, true),
  ], null);
  assert.deepEqual(picked.map(({ credit: c, matches }) => [c.id, c.crew, matches]), [[1, false, false]]);
});

test("depuis la réalisation, le film joué ET réalisé se lit « Réalisation »", () => {
  const picked = pickCredits([
    credit({ id: 1 }, false),
    credit({ id: 1, job: "Director" }, true),
    credit({ id: 4 }, false),
  ], "Director");
  assert.deepEqual(picked.map(({ credit: c, matches }) => [c.id, c.role, matches]), [[1, "Director", true], [4, "Neo", false]]);
});

test("un compositeur : ses musiques entrent, et elles seules sont « du métier »", () => {
  const picked = pickCredits([
    credit({ id: 3, job: "Original Music Composer" }, true),
    credit({ id: 2, job: "Producer" }, true),
    credit({ id: 5, character: "Narrator" }, false),
  ], "Composer");
  assert.deepEqual(picked.map(({ credit: c, matches }) => [c.id, matches]), [[3, true], [5, false]]);
});

test("le métier se dit dans la langue de l'interface ; un personnage reste tel quel", () => {
  assert.equal(creditLabel({ crew: true, role: "Original Music Composer" }, "fr"), "Musique");
  assert.equal(creditLabel({ crew: true, role: "Screenplay" }, "en"), "Screenplay");
  assert.equal(creditLabel({ crew: false, role: "Neo" }, "fr"), "Neo");
  assert.equal(creditLabel({ crew: true, role: null }, "fr"), null);
});
