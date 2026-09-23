import { test } from "node:test";
import assert from "node:assert/strict";
import { editDistance, foldText, significantTokens, tokenize } from "./fold";

test("le pliage efface casse, accents, ligatures et ponctuation", () => {
  assert.equal(foldText("L'Âge de glace"), "l age de glace");
  assert.equal(foldText("Spider-Man: No Way Home"), "spider man no way home");
  assert.equal(foldText("Œuvre  Complète…"), "oeuvre complete");
  assert.equal(foldText("  "), "");
});

test("les écritures non latines survivent au pliage", () => {
  assert.equal(foldText("千と千尋の神隠し"), "千と千尋の神隠し");
});

test("les mots vides ne sont jamais exigés, sauf s'ils sont tout ce qu'on a", () => {
  assert.deepEqual(significantTokens(tokenize("Le Seigneur des Anneaux")), ["seigneur", "anneaux"]);
  assert.deepEqual(significantTokens(tokenize("Les")), ["les"]);
});

test("la distance compte une inversion de deux lettres comme une seule faute", () => {
  assert.equal(editDistance("interstellar", "intersetllar", 2), 1);
  assert.equal(editDistance("interstellar", "interstelar", 2), 1);
  assert.equal(editDistance("inception", "inception", 1), 0);
});

test("la distance s'arrête dès que la borne est franchie", () => {
  assert.equal(editDistance("avatar", "titanic", 2), 3);
  assert.equal(editDistance("dune", "dunkerque", 1), 2);
  assert.equal(editDistance("", "abc", 2), 3);
});
