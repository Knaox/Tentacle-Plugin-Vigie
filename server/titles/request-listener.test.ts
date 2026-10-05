import { test } from "node:test";
import assert from "node:assert/strict";
import { announceTitleRequested, onTitleRequested } from "./request-listener";

const tick = () => new Promise((r) => setImmediate(r));

test("chaque demande acceptée est dite au cœur, pour le compte qui l'a faite", async () => {
  const heard: unknown[] = [];
  onTitleRequested((userId, title) => { heard.push([userId, title]); });
  announceTitleRequested("u1", { mediaType: "movie", tmdbId: 603 });
  await tick();
  assert.deepEqual(heard, [["u1", { mediaType: "movie", tmdbId: 603 }]]);
  onTitleRequested(null);
});

test("un cœur d'avant n'écoute pas : rien ne se passe", async () => {
  onTitleRequested(null);
  assert.doesNotThrow(() => announceTitleRequested("u1", { mediaType: "tv", tmdbId: 1399 }));
});

test("une panne du cœur ne remonte jamais jusqu'à la demande", async () => {
  onTitleRequested(async () => { throw new Error("base muette"); });
  assert.doesNotThrow(() => announceTitleRequested("u1", { mediaType: "tv", tmdbId: 1399 }));
  await tick();
  onTitleRequested(null);
});
