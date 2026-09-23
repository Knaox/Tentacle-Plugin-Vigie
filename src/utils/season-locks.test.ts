import { test } from "node:test";
import assert from "node:assert/strict";
import { hasActiveRequest, isAnimeTitle, seasonLocks } from "./season-locks";

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

test("une saison que Sonarr connaît sans que personne l'ait demandée reste libre", () => {
  // Relevé réel (TMDB 71663) : saisons 3 et 4 demandées, 1 et 2 listées au statut 1.
  const locks = seasonLocks({
    status: 3,
    seasons: [
      { id: 1, seasonNumber: 1, status: 1 },
      { id: 2, seasonNumber: 2, status: 1 },
      { id: 3, seasonNumber: 3, status: 3 },
      { id: 4, seasonNumber: 4, status: 3 },
    ],
    requests: [{ id: 9, status: 2, seasons: [{ seasonNumber: 3 }, { seasonNumber: 4 }] }],
  }, []);
  assert.equal(locks.has(1), false);
  assert.equal(locks.has(2), false);
  assert.equal(locks.get(3), 3);
  assert.equal(locks.get(4), 3);
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

test("un film retombé au statut 1 garde sa demande : il reste pris", () => {
  // Relevé réel (TMDB 1368337, « L'Odyssée ») : demande terminée, média revenu à « inconnu ».
  assert.equal(hasActiveRequest({ requests: [{ status: 5 }] }), true);
  assert.equal(hasActiveRequest({ requests: [{ status: 1 }] }), true);
  assert.equal(hasActiveRequest({ requests: [{ status: 2 }] }), true);
  // Refusée ou en échec : le film se redemande.
  assert.equal(hasActiveRequest({ requests: [{ status: 3 }, { status: 4 }] }), false);
  assert.equal(hasActiveRequest({}), false);
  assert.equal(hasActiveRequest(undefined), false);
});

test("un animé se reconnaît au mot-clé, ou à l'animation japonaise", () => {
  assert.equal(isAnimeTitle({ keywords: [{ id: 210024 }] }, {}), true);
  assert.equal(isAnimeTitle({ genres: [{ id: 16 }], originalLanguage: "ja" }, {}), true);
  assert.equal(isAnimeTitle(undefined, { genreIds: [16], originCountry: ["JP"] }), true);
  assert.equal(isAnimeTitle({ genres: [{ id: 16 }], originalLanguage: "en" }, {}), false);
});
