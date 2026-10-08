import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequest, getNextQueued } from "../db";
import { countRequestsToday } from "../db-users";
import { openVigieDb } from "./startup";
import { testDb } from "../test-support/sqlite-storage";
import { copiedTables, NOW, TWO_DAYS } from "../test-support/copied-tables";
import type { TestDatabase } from "../test-support/sqlite";
import type { PluginStorage } from "./contract";

/* Les tables copiées depuis MariaDB, reconnues, servent aussitôt : file, dates, quota du jour. */

let raw: TestDatabase;
let storage: PluginStorage;

beforeEach(() => {
  ({ raw, storage } = testDb());
});
afterEach(() => raw.close());

test("Vigie se sert aussitôt des tables copiées", async () => {
  copiedTables(raw);
  const ctx = { storage, getPrisma: () => ({ notification: { create: async () => ({}) } }) };
  const vigie = await openVigieDb(ctx);
  assert.ok(vigie);
  const next = await getNextQueued(vigie!);
  assert.equal(next?.id, "r1");
  assert.equal(next?.createdAt, new Date(NOW - TWO_DAYS).toISOString());
  const created = await createRequest(vigie!, { jellyfinUserId: "u1", username: "alice", mediaType: "tv", tmdbId: 1399, title: "Une série" });
  const [row] = raw.prepare("SELECT typeof(created_at) AS a, typeof(updated_at) AS b FROM seer_requests WHERE id = ?").all(created.id);
  assert.deepEqual({ ...row }, { a: "integer", b: "integer" }, "des dates en entiers, jamais en texte");
  assert.equal(await countRequestsToday(vigie!, "u1"), 1, "seule la demande d'aujourd'hui compte");
});
