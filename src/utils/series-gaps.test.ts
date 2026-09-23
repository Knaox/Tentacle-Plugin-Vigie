import { test } from "node:test";
import assert from "node:assert/strict";
import fr from "../i18n/fr/states";
import { gapText, gapsFromSeasons, restrictGaps } from "./series-gaps";

/* Un `t` minimal, pluriels compris, sur les vraies chaînes françaises. */
const strings = fr as Record<string, string>;
const t = (key: string, opts: Record<string, unknown> = {}) => {
  const k = key.replace("seer:", "");
  const count = opts.count as number | undefined;
  const tpl = (count !== undefined ? strings[`${k}_${count === 1 ? "one" : "other"}`] : undefined) ?? strings[k];
  return tpl.replace(/{{(\w+)}}/g, (_, name: string) => String(opts[name]));
};

test("Re:Zero : les trois premières saisons là, la quatrième en cours → il manque des épisodes", () => {
  const gaps = gapsFromSeasons([
    { seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }, { seasonNumber: 3, status: 5 }, { seasonNumber: 4, status: 4 },
  ]);
  assert.deepEqual(gaps, { missing: [], partial: [4] });
  assert.equal(gapText(gaps, t, "short"), "Il manque des épisodes");
  assert.equal(gapText(gaps, t, "long"), "Il manque des épisodes de la saison 4");
});

test("une saison entière absente → il manque 1 saison", () => {
  const gaps = gapsFromSeasons([{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }, { seasonNumber: 3, status: 3 }]);
  assert.equal(gapText(gaps, t, "short"), "Il manque 1 saison");
  assert.equal(gapText(gaps, t, "long"), "Il manque la saison 3");
});

test("des saisons ET des épisodes", () => {
  const gaps = { missing: [5], partial: [4] };
  assert.equal(gapText(gaps, t, "short"), "Il manque 1 saison et des épisodes");
  assert.equal(gapText(gaps, t, "long"), "Il manque la saison 5, et des épisodes de la saison 4");
});

test("deux saisons s'énumèrent, onze se comptent", () => {
  assert.equal(gapText({ missing: [3, 4], partial: [] }, t, "long"), "Il manque les saisons 3 et 4");
  assert.equal(gapText({ missing: [2, 3, 4], partial: [] }, t, "long"), "Il manque les saisons 2, 3 et 4");
  const many = { missing: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], partial: [] };
  assert.equal(gapText(many, t, "long"), "Il manque 11 saisons");
  assert.equal(gapText(many, t, "short"), "Il manque 11 saisons");
});

test("une série complète, ou une saison zéro seule absente : rien ne manque", () => {
  assert.equal(gapsFromSeasons([{ seasonNumber: 1, status: 5 }]), null);
  assert.equal(gapsFromSeasons([{ seasonNumber: 0, status: 1 }, { seasonNumber: 1, status: 5 }]), null);
  assert.equal(gapText(null, t, "long"), null);
});

test("une demande ne parle que de ses saisons", () => {
  // S1 et S2 demandées ; la S1 en partie, la S3 (pas demandée) absente.
  const gaps = { missing: [3], partial: [1] };
  assert.deepEqual(restrictGaps(gaps, [1, 2]), { missing: [], partial: [1] });
  assert.equal(gapText(restrictGaps(gaps, [1, 2]), t, "long"), "Il manque des épisodes de la saison 1");
  // Rien de ce qui a été demandé ne manque.
  assert.equal(restrictGaps(gaps, [2]), null);
  // La série demandée en bloc : tout ce qui manque la concerne.
  assert.deepEqual(restrictGaps(gaps, null), gaps);
});
