import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesRequestQuery } from "./requestSearch";

const dune = { title: "Dune", username: "bob" };

test("par le titre, sans tenir compte de la casse ni des espaces autour", () => {
  assert.equal(matchesRequestQuery(dune, "  dUN ", false), true);
  assert.equal(matchesRequestQuery(dune, "matrix", false), false);
  assert.equal(matchesRequestQuery(dune, "", false), true);
});

test("par le compte : seulement dans la vue de tout le serveur", () => {
  assert.equal(matchesRequestQuery(dune, "Bob", true), true);
  assert.equal(matchesRequestQuery(dune, "Bob", false), false, "« Mes demandes » ne cherche que les titres");
});
