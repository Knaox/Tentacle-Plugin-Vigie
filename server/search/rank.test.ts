import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMedia, textScore, type RankInput } from "./rank";
import { parseQuery } from "./query";
import { tokenize } from "./fold";

const NOW = new Date(2026, 8, 23);

function item(partial: Partial<RankInput> & { names: string[] }): RankInput {
  return { mediaType: "movie", year: 2020, voteCount: 1000, popularity: 20, isAnime: false, ...partial };
}

test("le titre exact passe devant le début de titre, qui passe devant les mots épars", () => {
  const tokens = tokenize("dune");
  assert.ok(textScore(["dune"], tokens) > textScore(["dune deuxieme partie"], tokens));
  assert.ok(textScore(["dune deuxieme partie"], tokens) > textScore(["les enfants de dune"], tokens));
});

test("un mot en cours de frappe compte comme un début de mot, le dernier seulement", () => {
  assert.ok(textScore(["le seigneur des anneaux"], tokenize("seigneur ann")) >= 650);
  assert.ok(textScore(["le seigneur des anneaux"], tokenize("seign anneaux")) < 650);
});

test("à texte égal, la notoriété départage", () => {
  const q = parseQuery("dune", NOW);
  const film2021 = item({ names: ["dune"], year: 2021, voteCount: 13000, popularity: 90 });
  const film1984 = item({ names: ["dune"], year: 1984, voteCount: 3000, popularity: 15 });
  assert.ok(scoreMedia(film2021, q, q.tokens) > scoreMedia(film1984, q, q.tokens));
});

test("l'année demandée l'emporte sur la notoriété", () => {
  const q = parseQuery("dune 1984", NOW);
  const film2021 = item({ names: ["dune"], year: 2021, voteCount: 13000, popularity: 90 });
  const film1984 = item({ names: ["dune"], year: 1984, voteCount: 3000, popularity: 15 });
  assert.ok(scoreMedia(film1984, q, q.tokens) > scoreMedia(film2021, q, q.tokens));
});

test("le type demandé passe devant le type voisin", () => {
  const q = parseQuery("the office série", NOW);
  const movie = item({ names: ["the office"], mediaType: "movie", voteCount: 20000 });
  const series = item({ names: ["the office"], mediaType: "tv", voteCount: 3000 });
  assert.ok(scoreMedia(series, q, q.tokens) > scoreMedia(movie, q, q.tokens));
});
