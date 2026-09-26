import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminUserRow } from "../../../api/types";
import { dailyLimitFor, effectiveLimit, filterCounts, filterUsers, limitModeOf } from "./userFilters";

function user(over: Partial<AdminUserRow>): AdminUserRow {
  return {
    jellyfinUserId: "id", username: "Alice", blocked: false, dailyLimit: null,
    allowMovies: true, allowTv: true, allowAnime: true, jellyseerrUserId: null, jellyseerrLastSync: null,
    createdAt: "", updatedAt: "", requestsToday: 0, requestsTotal: 0, activeRequests: 0,
    jellyfin: null, link: "unlinked", seerr: null, ...over,
  };
}

const USERS = [
  user({ jellyfinUserId: "a", username: "Éloïse", link: "linked" }),
  user({ jellyfinUserId: "b", username: "Bob", link: "stale", blocked: true }),
  user({ jellyfinUserId: "c", username: "Chloé", link: "unlinked" }),
];

test("la recherche ignore accents et casse", () => {
  assert.deepEqual(filterUsers(USERS, "all", "eloise").map((u) => u.jellyfinUserId), ["a"]);
  assert.deepEqual(filterUsers(USERS, "all", "CHLOE").map((u) => u.jellyfinUserId), ["c"]);
});

test("un lien cassé compte parmi les comptes non reliés", () => {
  assert.deepEqual(filterUsers(USERS, "unlinked", "").map((u) => u.jellyfinUserId), ["b", "c"]);
  assert.deepEqual(filterCounts(USERS), { all: 3, linked: 1, unlinked: 2, blocked: 1 });
});

test("la limite d'un compte : la sienne, sinon celle par défaut, -1 illimitée", () => {
  assert.equal(effectiveLimit(null, 5), 5);
  assert.equal(effectiveLimit(null, null), null);
  assert.equal(effectiveLimit(3, 5), 3);
  assert.equal(effectiveLimit(-1, 5), null);
  assert.equal(limitModeOf(null), "default");
  assert.equal(limitModeOf(-1), "unlimited");
  assert.equal(limitModeOf(4), "custom");
  assert.equal(dailyLimitFor("custom", 0), 1);
  assert.equal(dailyLimitFor("unlimited", 7), -1);
  assert.equal(dailyLimitFor("default", 7), null);
});
