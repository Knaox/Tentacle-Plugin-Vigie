import { test } from "node:test";
import assert from "node:assert/strict";
import { clipOverview, OVERVIEW_MAX, overviewFetchBudget, withOverview } from "./title-overview";
import type { TmdbMeta } from "../tmdb-cache";

/*
 * La carte ouverte d'un titre absent, sur la TV de Tentacle, montre son
 * résumé : il part avec la pastille, jamais au prix d'une attente pour une
 * liste, et toujours en phrases entières.
 */

const meta = (overview: string | null) => ({ mediaType: "movie", tmdbId: 603, overview } as unknown as TmdbMeta);

test("seule une question sur un ou deux titres va chercher les fiches tout de suite", () => {
  assert.equal(overviewFetchBudget(1), 1);
  assert.equal(overviewFetchBudget(2), 2);
  assert.equal(overviewFetchBudget(3), 0);
  assert.equal(overviewFetchBudget(60), 0);
});

test("le résumé connu rejoint l'état, sans toucher au reste", () => {
  const state = { badge: null, request: { mode: "direct" as const, label: "Demander" } };
  assert.deepEqual(withOverview(state, meta("Un hacker découvre la Matrice.")), { ...state, overview: "Un hacker découvre la Matrice." });
  assert.equal(withOverview(state, meta(null)), state);
  assert.equal(withOverview(state, meta("   ")), state);
  assert.equal(withOverview(state, undefined), state);
});

test("un long résumé s'arrête à la fin d'une phrase, jamais au milieu d'un mot", () => {
  const sentence = "Une phrase complète qui raconte une partie de l'histoire du film. ";
  const long = sentence.repeat(20);
  const clipped = clipOverview(long);
  assert.ok(clipped && clipped.length <= OVERVIEW_MAX);
  assert.ok(clipped?.endsWith("."));
  // Sans aucune fin de phrase : coupé à l'espace, et le dit.
  const words = "mot ".repeat(300);
  const cut = clipOverview(words);
  assert.ok(cut?.endsWith("…") && !cut.includes("mo…"));
  assert.equal(clipOverview("  court\n résumé  "), "court résumé");
});
