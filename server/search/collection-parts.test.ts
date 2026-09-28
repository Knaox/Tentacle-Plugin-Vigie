import { test } from "node:test";
import assert from "node:assert/strict";
import { missingParts, toCollectionItem, toPart } from "./collection-parts";

const raw = (over: Record<string, unknown> = {}) => ({
  id: 673, title: "Harry Potter et le Prisonnier d'Azkaban", releaseDate: "2004-05-31", posterPath: "/p.jpg", ...over,
});

test("un volet de Jellyseerr devient un volet lisible ; l'illisible est écarté", () => {
  assert.deepEqual(toPart(raw({ mediaInfo: { status: 2 } })), {
    id: 673, title: "Harry Potter et le Prisonnier d'Azkaban", releaseDate: "2004-05-31", posterPath: "/p.jpg", status: 2,
  });
  assert.equal(toPart(raw({ id: "673" })), null);
  assert.equal(toPart(raw({ title: " " })), null);
  assert.equal(toPart(raw({ releaseDate: "" }))?.releaseDate, null);
});

test("seuls les volets absents de la bibliothèque, dans l'ordre de sortie, les annoncés en dernier", () => {
  const parts = [
    toPart(raw({ id: 675, releaseDate: "2007-07-08" })),
    toPart(raw({ id: 1, releaseDate: "" })),
    toPart(raw({ id: 673, releaseDate: "2004-05-31" })),
    toPart(raw({ id: 671, releaseDate: "2001-11-16" })),
    toPart(raw({ id: 6, releaseDate: "2010-01-01" })),
  ].filter((p) => p !== null);
  const status: Record<number, number> = { 671: 5, 6: 6, 675: 4 };
  const kept = missingParts(parts, (p) => status[p.id]);
  assert.deepEqual(kept.map(({ part }) => part.id), [673, 1]);
});

test("au contrat générique : l'identifiant TMDB, l'année seule, la pastille de ce que Vigie sait", () => {
  const part = toPart(raw());
  assert.ok(part);
  const item = toCollectionItem(part, undefined, "fr", "2026-09-28");
  assert.equal(item.id, "movie:673");
  assert.equal(item.tmdbId, 673);
  assert.equal(item.subtitle, "2004");
  assert.equal(item.href, "/discover?media=movie:673");
  assert.deepEqual(item.badge, { label: "Pas sur le serveur", tone: "neutral" });
  assert.deepEqual(toCollectionItem(part, 2, "fr", "2026-09-28").badge, { label: "Demandé", tone: "info" });
  assert.deepEqual(toCollectionItem(part, 3, "en", "2026-09-28").badge, { label: "In progress", tone: "warning" });
});

test("un volet pas encore sorti dit sa date, et qu'il est à venir", () => {
  const soon = toPart(raw({ id: 1272837, releaseDate: "2026-12-03" }));
  const unknown = toPart(raw({ id: 1273002, releaseDate: null }));
  assert.ok(soon && unknown);
  const item = toCollectionItem(soon, undefined, "fr", "2026-09-28");
  assert.match(item.subtitle ?? "", /^Sortie le 3 déc\.? 2026$/);
  assert.deepEqual(item.badge, { label: "À venir", tone: "neutral" });
  assert.equal(toCollectionItem(unknown, undefined, "en", "2026-09-28").subtitle, null);
  assert.equal(toCollectionItem(unknown, undefined, "en", "2026-09-28").badge?.label, "Upcoming");
});
