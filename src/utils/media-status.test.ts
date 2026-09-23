import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_STATUS_DELETED, isRequestedSeasonStatus, mediaStateOf } from "./media-status";

test("demandée à partir de PENDING, disponible comprise", () => {
  assert.equal(isRequestedSeasonStatus(2), true);
  assert.equal(isRequestedSeasonStatus(3), true);
  assert.equal(isRequestedSeasonStatus(5), true);
});

test("inconnue ou absente : libre", () => {
  assert.equal(isRequestedSeasonStatus(1), false);
  assert.equal(isRequestedSeasonStatus(undefined), false);
});

test("supprimée côté Jellyseerr : libre, pas « demandée »", () => {
  assert.equal(isRequestedSeasonStatus(MEDIA_STATUS_DELETED), false);
});

test("l'état d'une affiche se lit sur le statut Jellyseerr", () => {
  assert.equal(mediaStateOf(undefined), null);
  assert.equal(mediaStateOf(1), null);
  assert.equal(mediaStateOf(2), "requested");
  assert.equal(mediaStateOf(3), "processing");
  assert.equal(mediaStateOf(4), "partial");
  assert.equal(mediaStateOf(5), "available");
  assert.equal(mediaStateOf(7), null, "supprimé : le titre se redemande");
});
