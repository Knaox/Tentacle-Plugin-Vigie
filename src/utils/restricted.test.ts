import { test } from "node:test";
import assert from "node:assert/strict";
import { SeerrProxyError } from "../api/endpoints";
import { SeerBackendApiError } from "../api/seer-client";
import { isRestrictedError, retryUnlessRestricted } from "./restricted";

/*
 * Le refus du contrôle parental se reconnaît à son code (fiche relayée) ou à
 * sa clé (demande) : le hub dit alors « Non disponible pour ce profil », et ne
 * redemande pas une fiche que le serveur refusera encore.
 */

test("une fiche refusée au profil, une demande refusée : reconnues", () => {
  assert.equal(isRestrictedError(new SeerrProxyError(403, "restricted_title")), true);
  assert.equal(isRestrictedError(new SeerBackendApiError("x", 403, { errorKey: "seer:errRestrictedTitle" })), true);
});

test("une autre panne n'est pas un refus du contrôle parental", () => {
  assert.equal(isRestrictedError(new SeerrProxyError(403)), false);
  assert.equal(isRestrictedError(new SeerrProxyError(502)), false);
  assert.equal(isRestrictedError(new SeerBackendApiError("x", 403, { errorKey: "seer:errUserBlocked" })), false);
  assert.equal(isRestrictedError(new Error("Seerr API error: 403")), false);
});

test("une fiche refusée ne se redemande pas ; une panne, trois fois comme avant", () => {
  assert.equal(retryUnlessRestricted(0, new SeerrProxyError(403, "restricted_title")), false);
  assert.equal(retryUnlessRestricted(0, new SeerrProxyError(502)), true);
  assert.equal(retryUnlessRestricted(3, new SeerrProxyError(502)), false);
});
