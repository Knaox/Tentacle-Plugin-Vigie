import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ITEM_ORDER, TITLE_ORDER, arrivalItemKey, bestCopy, entryState, titleArrival, type ArrivalState,
} from "./arrival-state";

/*
 * La règle d'état d'un titre (retours de Damien) : l'état le plus avancé
 * gagne, jamais « bloqué » tant qu'un autre avance.
 */

const one = (state: ArrivalState, item = "S1E1") => ({ item, state });

test("les deux ordres sont écrits, du moins au plus avancé", () => {
  assert.deepEqual(ITEM_ORDER, ["blocked", "pending", "downloading", "importing", "imported"]);
  assert.deepEqual(TITLE_ORDER, ["blocked", "pending", "importing", "downloading"]);
});

test("deux copies du même épisode : la plus avancée l'emporte, dans tous les couples", () => {
  for (let i = 0; i < ITEM_ORDER.length; i++) {
    for (let j = 0; j < ITEM_ORDER.length; j++) {
      const winner = ITEM_ORDER[Math.max(i, j)];
      assert.equal(bestCopy([one(ITEM_ORDER[i]), one(ITEM_ORDER[j])])?.state, winner, `${ITEM_ORDER[i]} + ${ITEM_ORDER[j]}`);
    }
  }
});

test("un import refusé pendant qu'une autre copie descend : le titre arrive, il n'est pas bloqué", () => {
  assert.deepEqual(titleArrival([one("blocked"), one("downloading")]), { state: "downloading", blockedItems: 0 });
  assert.deepEqual(titleArrival([one("blocked"), one("pending")]), { state: "pending", blockedItems: 0 });
  assert.deepEqual(titleArrival([one("blocked"), one("importing")]), { state: "importing", blockedItems: 0 });
});

test("des épisodes différents : ce qui descend encore dit « en route », les bloqués sont une nuance", () => {
  const arrival = titleArrival([one("importing", "S1E1"), one("downloading", "S1E2"), one("blocked", "S1E3")]);
  assert.deepEqual(arrival, { state: "downloading", blockedItems: 1 });
  // Un épisode s'importe, un autre est bloqué : quelque chose avance encore.
  assert.deepEqual(titleArrival([one("importing", "S1E1"), one("blocked", "S1E2")]), { state: "importing", blockedItems: 1 });
  // Importé : l'élément est au bout, il ne fait pas reculer le titre.
  assert.deepEqual(titleArrival([one("imported", "S1E1"), one("pending", "S1E2")]), { state: "pending", blockedItems: 0 });
});

test("bloqué seulement quand tout l'est", () => {
  assert.deepEqual(titleArrival([one("blocked", "S1E1"), one("blocked", "S1E2")]), { state: "blocked", blockedItems: 2 });
  // Deux copies bloquées du même épisode : un seul élément bloqué.
  assert.deepEqual(titleArrival([one("blocked"), one("blocked")]), { state: "blocked", blockedItems: 1 });
  assert.equal(titleArrival([]), null);
});

test("l'état d'une entrée : un import refusé est bloqué même si le client le dit complet", () => {
  assert.equal(entryState({ stalled: true, validating: true }), "blocked");
  assert.equal(entryState({ stalled: false, validating: true }), "importing");
  assert.equal(entryState({ stalled: false, validating: false, imported: true }), "imported");
  assert.equal(entryState({ stalled: false, validating: false, waiting: true }), "pending");
  assert.equal(entryState({ stalled: false, validating: false }), "downloading");
});

test("la clé d'un élément : l'épisode, sinon la saison, sinon le titre entier", () => {
  assert.equal(arrivalItemKey(2, 5), "S2E5");
  assert.equal(arrivalItemKey(2, null), "S2");
  assert.equal(arrivalItemKey(null, null), "whole");
});
