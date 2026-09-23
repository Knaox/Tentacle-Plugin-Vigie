import { test } from "node:test";
import assert from "node:assert/strict";
import { TitleIndex, type TitleRecord } from "./title-index";
import { tokenize } from "./fold";

function rec(partial: Partial<TitleRecord> & Pick<TitleRecord, "tmdbId" | "title">): TitleRecord {
  return {
    mediaType: "movie", lang: "fr", originalTitle: null, releaseDate: "2014-11-05",
    popularity: 10, voteCount: 1000, voteAverage: 8, posterPath: null, backdropPath: null,
    originalLanguage: "en", genreIds: [], ...partial,
  };
}

function sample(): TitleIndex {
  const index = new TitleIndex();
  index.upsert(rec({ tmdbId: 157336, title: "Interstellar", voteCount: 36000 }));
  index.upsert(rec({ tmdbId: 27205, title: "Inception", voteCount: 37000 }));
  index.upsert(rec({ tmdbId: 278, title: "Les Évadés", originalTitle: "The Shawshank Redemption", voteCount: 27000 }));
  index.upsert(rec({ tmdbId: 557, title: "Spider-Man", voteCount: 19000, releaseDate: "2002-05-01" }));
  index.upsert(rec({ tmdbId: 1399, mediaType: "tv", title: "Game of Thrones", voteCount: 24000 }));
  index.upsert(rec({ tmdbId: 129, title: "Le Voyage de Chihiro", originalTitle: "千と千尋の神隠し", genreIds: [16], originalLanguage: "ja" }));
  index.upsert(rec({ tmdbId: 129, lang: "en", title: "Spirited Away", originalTitle: "千と千尋の神隠し", genreIds: [16], originalLanguage: "ja" }));
  return index;
}

test("un titre se retrouve par un début de mot", () => {
  const { hits, corrected } = sample().lookup(tokenize("inters"));
  assert.equal(hits[0].entry.tmdbId, 157336);
  assert.equal(corrected, null);
});

test("le titre original et chaque langue mènent au même titre", () => {
  const index = sample();
  assert.equal(index.lookup(tokenize("shawshank")).hits[0].entry.tmdbId, 278);
  assert.equal(index.lookup(tokenize("les evades")).hits[0].entry.tmdbId, 278);
  assert.equal(index.lookup(tokenize("spirited away")).hits[0].entry.tmdbId, 129);
  assert.equal(index.size(), 6);
});

test("une faute de frappe est corrigée, et la correction est rendue", () => {
  const { hits, corrected } = sample().lookup(tokenize("interstelar"));
  assert.equal(hits[0].entry.tmdbId, 157336);
  assert.deepEqual(corrected, ["interstellar"]);
});

test("un mot collé se décolle quand il se coupe en deux mots connus", () => {
  const { hits, corrected } = sample().lookup(tokenize("spiderman"));
  assert.equal(hits[0].entry.tmdbId, 557);
  assert.deepEqual(corrected, ["spider", "man"]);
});

test("les mots courts ne sont jamais « corrigés » vers un autre titre", () => {
  const index = sample();
  assert.equal(index.correctToken("dune"), null);
  assert.equal(index.correctToken("xnception"), null, "la première lettre doit être juste");
});

test("un animé japonais est reconnu à son genre et à sa langue", () => {
  assert.equal(sample().get("movie:129")?.isAnime, true);
  assert.equal(sample().get("movie:27205")?.isAnime, false);
});

test("un mot connu par un seul titre obscur cède au voisin cent fois plus voté", () => {
  const index = sample();
  // Une recherche a fait entrer dans l'index un film de 2014 intitulé « Interstelar » (deux votes).
  index.upsert(rec({ tmdbId: 1261360, title: "Interstelar", voteCount: 2, popularity: 0.6 }));
  const { hits, corrected } = index.lookup(tokenize("interstelar"));
  assert.equal(hits[0].entry.tmdbId, 157336);
  assert.deepEqual(corrected, ["interstellar"]);
});

test("un mot connu et porteur ne se corrige jamais", () => {
  const index = sample();
  index.upsert(rec({ tmdbId: 11, title: "Inceptio", voteCount: 3, popularity: 0.5 }));
  assert.equal(index.dominantNeighbor("inception"), null, "le plus voté des deux ne cède pas");
  assert.equal(index.dominantNeighbor("inceptio"), "inception");
  assert.equal(index.lookup(tokenize("inception")).corrected, null);
});
