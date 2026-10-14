import { test } from "node:test";
import assert from "node:assert/strict";
import { clearPositions, forgetPosition, rememberPosition, resumePositionFor } from "./positions";

/*
 * Le retour sur une affiche reprend la bande-annonce où on l'avait quittée :
 * par vidéo (le chemin sans jeton), dix minutes, jamais à la fin.
 */

const SRC = "http://serveur/api/trailers/hls/abcdefghijk/master-720.m3u8?t=jeton";

test("une position retenue par vidéo, quel que soit le jeton, dix minutes au plus", () => {
  clearPositions();
  rememberPosition(SRC, 37, 138, 0);
  assert.equal(resumePositionFor(SRC.replace("jeton", "autre"), 1_000), 37);
  assert.equal(resumePositionFor(SRC.replace("abcdefghijk", "autreVideo1"), 1_000), null);
  assert.equal(resumePositionFor(SRC, 10 * 60 * 1000 + 1), null);
});

test("finie, ou quittée près de la fin : départ du début", () => {
  clearPositions();
  rememberPosition(SRC, 137, 138, 0);
  assert.equal(resumePositionFor(SRC, 1), null);
  rememberPosition(SRC, 50, 138, 0);
  forgetPosition(SRC);
  assert.equal(resumePositionFor(SRC, 1), null);
});
