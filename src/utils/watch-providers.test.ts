import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWatchProviders } from "./watch-providers";

const netflix = { id: 8, name: "Netflix", logoPath: "/netflix.png", displayPriority: 1 };
const canal = { id: 381, name: "Canal+", logoPath: "/canal.png", displayPriority: 4 };
const apple = { id: 2, name: "Apple TV Store", logoPath: "/apple.png", displayPriority: 6 };

test("le pays de la langue, l'abonnement avant l'achat", () => {
  const picked = pickWatchProviders([
    { iso_3166_1: "US", flatrate: [netflix] },
    { iso_3166_1: "FR", flatrate: [canal], buy: [apple] },
  ], "fr");
  assert.deepEqual(picked, [canal]);
});

test("sans abonnement dans le pays, l'achat", () => {
  assert.deepEqual(pickWatchProviders([{ iso_3166_1: "FR", flatrate: [], buy: [apple] }], "fr"), [apple]);
});

test("une langue qui n'est pas un pays retombe sur la France, puis les États-Unis", () => {
  assert.deepEqual(pickWatchProviders([{ iso_3166_1: "FR", flatrate: [canal] }], "en"), [canal]);
  assert.deepEqual(pickWatchProviders([{ iso_3166_1: "US", flatrate: [netflix] }], "en"), [netflix]);
});

test("rien à montrer : aucun pays connu, aucune donnée", () => {
  assert.deepEqual(pickWatchProviders([{ iso_3166_1: "JP", flatrate: [netflix] }], "fr"), []);
  assert.deepEqual(pickWatchProviders(undefined, "fr"), []);
  assert.deepEqual(pickWatchProviders([], "fr"), []);
});

test("six logos au plus", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `P${i}`, logoPath: `/${i}.png` }));
  assert.equal(pickWatchProviders([{ iso_3166_1: "FR", flatrate: many }], "fr").length, 6);
});
