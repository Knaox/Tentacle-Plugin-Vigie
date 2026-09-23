import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, sourceRanges } from "./mixCatalogs";

test("« Tous » alterne un film, une série, tant que les deux en ont", () => {
  assert.deepEqual(locate(0, 100, 100), { source: 0, offset: 0 });
  assert.deepEqual(locate(1, 100, 100), { source: 1, offset: 0 });
  assert.deepEqual(locate(4, 100, 100), { source: 0, offset: 2 });
  assert.deepEqual(locate(5, 100, 100), { source: 1, offset: 2 });
});

test("puis finit sur le plus long, sans trou", () => {
  // 2 films, 5 séries : F S F S S S S
  assert.deepEqual(locate(3, 2, 5), { source: 1, offset: 1 });
  assert.deepEqual(locate(4, 2, 5), { source: 1, offset: 2 });
  assert.deepEqual(locate(6, 2, 5), { source: 1, offset: 4 });
  // Une source vide (genre sans équivalent en séries) : tout vient de l'autre.
  assert.deepEqual(locate(3, 10, 0), { source: 0, offset: 3 });
});

test("les cases visibles ne chargent que ce qu'il faut dans chaque source", () => {
  assert.deepEqual(sourceRanges(0, 9, 100, 100), [[0, 4], [0, 4]]);
  assert.deepEqual(sourceRanges(40, 59, 100, 100), [[20, 29], [20, 29]]);
  assert.deepEqual(sourceRanges(0, 5, 10, 0), [[0, 5], null]);
});
