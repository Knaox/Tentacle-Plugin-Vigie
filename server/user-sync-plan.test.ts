import { test } from "node:test";
import assert from "node:assert/strict";
import type { JellyfinAccount } from "./jellyfin-users";
import { planUserSync, pendingFixes, linkStateOf, type SeerrAccount, type LocalUserRow } from "./user-sync-plan";

/*
 * Chaque cas est une situation réelle d'administration : un compte supprimé
 * d'un côté ou de l'autre, un renommage, un compte désactivé. L'ancienne
 * synchro ne savait traiter que l'arrivée d'un nouveau compte.
 */

function account(id: string, name: string, over: Partial<JellyfinAccount> = {}): JellyfinAccount {
  return { id, name, isAdmin: false, isDisabled: false, imageTag: null, lastActivityDate: null, ...over };
}

function seerr(id: number, jellyfinUserId: string | null, over: Partial<SeerrAccount> = {}): SeerrAccount {
  return { id, name: `seerr-${id}`, email: null, jellyfinUserId, requestCount: 0, ...over };
}

const row = (jellyfinUserId: string, username: string, jellyseerrUserId: number | null): LocalUserRow =>
  ({ jellyfinUserId, username, jellyseerrUserId });

const NO_REQUESTS = new Map<string, number>();

test("un nouveau compte Jellyfin obtient sa ligne, et son compte Jellyseerr s'il existe", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, null), seerr(7, "aaa")],
    rows: [],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.createRows, [{ id: "aaa", name: "Alice" }]);
  assert.deepEqual(plan.setLinks, [{ id: "aaa", username: "Alice", seerrId: 7, previous: null }]);
  assert.deepEqual(plan.missingSeerr, []);
});

test("un compte Jellyseerr supprimé : le lien mort est retiré", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, null)],
    rows: [row("aaa", "Alice", 12)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.clearLinks, [{ id: "aaa", username: "Alice", seerrId: 12 }]);
  // Et le compte se retrouve sans compte Jellyseerr : il sera recréé à la demande.
  assert.deepEqual(plan.missingSeerr, [{ id: "aaa", username: "Alice" }]);
  assert.equal(linkStateOf(row("aaa", "Alice", 12), [seerr(1, null)]), "stale");
});

test("un compte Jellyseerr supprimé puis réimporté ailleurs : le nouveau est relié", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, null), seerr(30, "aaa")],
    rows: [row("aaa", "Alice", 12)],
    activeRequests: NO_REQUESTS,
  });
  assert.equal(plan.clearLinks.length, 1);
  assert.deepEqual(plan.setLinks, [{ id: "aaa", username: "Alice", seerrId: 30, previous: 12 }]);
});

test("relié au compte Jellyseerr de quelqu'un d'autre : le lien est corrigé", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice"), account("bbb", "Bob")],
    seerr: [seerr(5, "bbb"), seerr(6, "aaa")],
    rows: [row("aaa", "Alice", 5), row("bbb", "Bob", 5)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.clearLinks.map((c) => c.username), ["Alice"]);
  assert.deepEqual(plan.setLinks.map((s) => [s.username, s.seerrId]), [["Alice", 6]]);
});

test("un fantôme relié par son nom reste accepté", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(9, null, { email: "alice@tentacle.local" })],
    rows: [row("aaa", "Alice", 9)],
    activeRequests: NO_REQUESTS,
  });
  assert.equal(pendingFixes(plan), 0);
  // Relié à un compte vivant : ce n'est pas un orphelin.
  assert.deepEqual(plan.orphanSeerr, []);
});

test("un renommage dans Jellyfin est suivi", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice Martin")],
    seerr: null,
    rows: [row("aaa", "Alice", null)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.renames, [{ id: "aaa", from: "Alice", to: "Alice Martin" }]);
});

test("un compte supprimé de Jellyfin sans demande est oublié, avec demandes il est signalé", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, null), seerr(4, "ccc"), seerr(8, "ddd", { requestCount: 3 })],
    rows: [row("aaa", "Alice", null), row("ccc", "Carl", 4), row("ddd", "Dora", 8)],
    activeRequests: new Map([["ddd", 2]]),
  });
  assert.deepEqual(plan.removeRows, [{ id: "ccc", username: "Carl" }]);
  assert.deepEqual(plan.gone, [{ id: "ddd", username: "Dora", activeRequests: 2, seerrId: 8 }]);
  // Le compte Jellyseerr de Carl est orphelin ; celui de Dora est déjà présenté avec elle.
  assert.deepEqual(plan.orphanSeerr.map((s) => s.id), [4]);
});

test("les identifiants se comparent sans tirets ni casse", () => {
  const plan = planUserSync({
    accounts: [account("AAAA1111", "Alice")],
    seerr: [seerr(3, "aaaa-1111")],
    rows: [row("aaaa1111", "Alice", 3)],
    activeRequests: NO_REQUESTS,
  });
  assert.equal(pendingFixes(plan), 0);
  assert.deepEqual(plan.orphanSeerr, []);
});

test("Jellyfin muet (aucun compte) : rien n'est retiré", () => {
  const plan = planUserSync({
    accounts: [],
    seerr: [seerr(4, "ccc")],
    rows: [row("ccc", "Carl", 4)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.removeRows, []);
  assert.deepEqual(plan.gone, []);
});

test("Jellyseerr injoignable : aucune décision sur les liens", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: null,
    rows: [row("aaa", "Alice", 12)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.clearLinks, []);
  assert.deepEqual(plan.missingSeerr, []);
  assert.equal(linkStateOf(row("aaa", "Alice", 12), null), "linked");
});

test("un compte désactivé est signalé, et on ne lui crée pas de compte Jellyseerr", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice", { isDisabled: true })],
    seerr: [seerr(1, null)],
    rows: [row("aaa", "Alice", null)],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.disabled, [{ id: "aaa", username: "Alice" }]);
  assert.deepEqual(plan.missingSeerr, []);
});

test("un fantôme que plus personne n'utilise est proposé à la suppression", () => {
  const ghost = seerr(9, null, { email: "carl@tentacle.local" });
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, null), ghost, seerr(2, null, { email: "plex@example.com" })],
    rows: [row("aaa", "Alice", null)],
    activeRequests: NO_REQUESTS,
  });
  // Un compte local de Jellyseerr (Plex, créé à la main) ne regarde pas Vigie.
  assert.deepEqual(plan.orphanSeerr, [ghost]);
});

test("le propriétaire de Jellyseerr n'est jamais proposé à la suppression", () => {
  const plan = planUserSync({
    accounts: [account("aaa", "Alice")],
    seerr: [seerr(1, "zzz")],
    rows: [],
    activeRequests: NO_REQUESTS,
  });
  assert.deepEqual(plan.orphanSeerr, []);
});
