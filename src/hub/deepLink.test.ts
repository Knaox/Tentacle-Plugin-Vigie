import { test } from "node:test";
import assert from "node:assert/strict";
import { readHubEntry } from "./deepLink";

test("une recommandation ouvre la fiche du titre", () => {
  assert.deepEqual(readHubEntry("/discover", "?media=movie:603"), {
    tab: "discover", media: { mediaType: "movie", id: 603 }, person: null, request: null, query: "",
  });
});

test("la recherche de Tentacle passe la main avec sa requête", () => {
  assert.equal(readHubEntry("/discover", "?q=dune%202021").query, "dune 2021");
});

test("un onglet se choisit par la requête, ou par les anciens chemins", () => {
  assert.equal(readHubEntry("/discover", "?tab=requests").tab, "requests");
  assert.equal(readHubEntry("/discover", "?tab=catalog").tab, "catalog");
  assert.equal(readHubEntry("/requests", undefined).tab, "requests");
  assert.equal(readHubEntry("/releases", "").tab, "calendar");
  assert.equal(readHubEntry("/discover", "?tab=inconnu").tab, "discover");
});

test("un identifiant de fiche mal formé est ignoré", () => {
  assert.equal(readHubEntry("/discover", "?media=movie:abc").media, null);
  assert.equal(readHubEntry("/discover", "?media=person:12").media, null);
  assert.equal(readHubEntry("/discover", "?media=tv:0").media, null);
});

test("une filmographie de Tentacle ouvre celle de Vigie", () => {
  assert.equal(readHubEntry("/discover", "?person=6384").person, 6384);
  assert.equal(readHubEntry("/discover", "?person=abc").person, null);
  assert.equal(readHubEntry("/discover", "?person=-2").person, null);
});

test("une carte de Tentacle demande une série : ses saisons s'ouvrent à l'arrivée", () => {
  assert.deepEqual(readHubEntry("/discover", "?request=tv:1399").request, { mediaType: "tv", id: 1399 });
  assert.equal(readHubEntry("/discover", "?request=tv:abc").request, null);
  assert.equal(readHubEntry("/discover", "?request=person:3").request, null);
  assert.equal(readHubEntry("/discover", "?request=tv:0").request, null);
});
