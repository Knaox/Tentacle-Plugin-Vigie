import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery } from "./query";

const NOW = new Date(2026, 8, 23);

test("une année en fin de requête devient un critère, plus du texte", () => {
  const q = parseQuery("dune 2021", NOW);
  assert.equal(q.text, "dune");
  assert.equal(q.year, 2021);
});

test("une année entre parenthèses se retire où qu'elle soit", () => {
  const q = parseQuery("Dune (2021) partie un", NOW);
  assert.equal(q.text, "Dune partie un");
  assert.equal(q.year, 2021);
});

test("un titre qui n'est qu'une année reste un titre", () => {
  assert.equal(parseQuery("1917", NOW).text, "1917");
  assert.equal(parseQuery("1917", NOW).year, null);
  assert.equal(parseQuery("film 1917", NOW).text, "1917");
  assert.equal(parseQuery("film 1917", NOW).type, "movie");
});

test("une année improbable fait partie du titre", () => {
  const q = parseQuery("blade runner 2049", NOW);
  assert.equal(q.text, "blade runner 2049");
  assert.equal(q.year, null);
});

test("le type demandé se lit au début comme à la fin", () => {
  assert.deepEqual(
    [parseQuery("série the office", NOW).text, parseQuery("série the office", NOW).type],
    ["the office", "tv"],
  );
  assert.deepEqual(
    [parseQuery("dune film 2021", NOW).text, parseQuery("dune film 2021", NOW).type, parseQuery("dune film 2021", NOW).year],
    ["dune", "movie", 2021],
  );
});

test("une saison désigne une série et quitte le texte", () => {
  assert.equal(parseQuery("the bear saison 3", NOW).text, "the bear");
  assert.equal(parseQuery("the bear saison 3", NOW).type, "tv");
  assert.equal(parseQuery("severance s02", NOW).text, "severance");
});

test("« anime » est une préférence, pas un type", () => {
  const q = parseQuery("frieren anime", NOW);
  assert.equal(q.text, "frieren");
  assert.equal(q.anime, true);
  assert.equal(q.type, null);
});

test("les mots pliés suivent le texte retenu", () => {
  assert.deepEqual(parseQuery("L'Âge de glace 2002", NOW).tokens, ["l", "age", "de", "glace"]);
});
