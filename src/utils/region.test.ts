import { test } from "node:test";
import assert from "node:assert/strict";
import { regionForLanguage } from "./region";

test("une langue devient un pays : « en » n'est pas une région TMDB", () => {
  assert.equal(regionForLanguage("en", "FR"), "US");
  assert.equal(regionForLanguage("fr", "US"), "FR");
  assert.equal(regionForLanguage("pt", "US"), "BR");
  assert.equal(regionForLanguage("xx", "FR"), "FR");
});
