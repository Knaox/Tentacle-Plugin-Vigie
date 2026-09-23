import { test } from "node:test";
import assert from "node:assert/strict";
import { isAnimeTitle, seasonLocks } from "./season-locks";

test("une saison là, une saison demandée, une saison libre", () => {
  const locks = seasonLocks({
    status: 4,
    seasons: [{ id: 1, seasonNumber: 1, status: 5 }],
    requests: [{ id: 9, status: 2, seasons: [{ seasonNumber: 2 }] }],
  }, [3]);
  assert.equal(locks.get(1), 5);
  assert.equal(locks.get(2), 3);
  assert.equal(locks.get(3), 3);
  assert.equal(locks.has(4), false);
});

test("une saison supprimée chez Jellyseerr redevient libre", () => {
  const locks = seasonLocks({
    status: 4,
    seasons: [{ id: 1, seasonNumber: 1, status: 7 }],
    requests: [{ id: 9, status: 2, seasons: [{ seasonNumber: 1 }] }],
  }, [1]);
  assert.equal(locks.has(1), false);
});

test("une demande refusée ne verrouille rien", () => {
  assert.equal(seasonLocks({ status: 2, requests: [{ id: 9, status: 3, seasons: [{ seasonNumber: 1 }] }] }, []).has(1), false);
});

test("un animé se reconnaît au mot-clé, ou à l'animation japonaise", () => {
  assert.equal(isAnimeTitle({ keywords: [{ id: 210024 }] }, {}), true);
  assert.equal(isAnimeTitle({ genres: [{ id: 16 }], originalLanguage: "ja" }, {}), true);
  assert.equal(isAnimeTitle(undefined, { genreIds: [16], originCountry: ["JP"] }), true);
  assert.equal(isAnimeTitle({ genres: [{ id: 16 }], originalLanguage: "en" }, {}), false);
});
