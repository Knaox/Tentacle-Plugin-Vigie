import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { buildUsersOverview } from "./users-overview";
import { forgetJellyfinAccounts } from "./jellyfin-users";
import { MIGRATIONS } from "./storage/migrations";
import { json, stubFetch } from "./test-support/fake-http";
import { testDb } from "./test-support/sqlite-storage";
import type { VigieDb } from "./storage/vigie-db";
import type { TestDatabase } from "./test-support/sqlite";

/*
 * La liste des comptes de l'administration : un compte Jellyfin sans
 * réglages Vigie (aucune ligne à lui) n'a pas de dates — `null`, et plus
 * « maintenant », qui changeait à chaque lecture. Un compte qui a sa ligne
 * garde les siennes.
 */

const JF = "http://jellyfin.test";
const CREATED = Date.UTC(2026, 8, 1, 10, 0, 0);
let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;

beforeEach(async () => {
  const t = testDb();
  ({ db, raw } = t);
  await t.storage.migrate(MIGRATIONS);
  // La table du cœur où Vigie lit l'adresse et la clé de Jellyfin.
  raw.exec(`CREATE TABLE server_config ("key" TEXT PRIMARY KEY, "value" TEXT)`);
  raw.prepare(`INSERT INTO server_config ("key", "value") VALUES ('jellyfin_url', ?), ('jellyfin_api_key', 'k')`).run(JF);
  await db.execute(
    `INSERT INTO seer_user_settings (jellyfin_user_id, username, blocked, allow_movies, allow_tv, allow_anime, created_at, updated_at)
     VALUES ('aaaa', 'alice', 0, 1, 1, 1, ?, ?)`,
    CREATED, CREATED,
  );
  forgetJellyfinAccounts();
  net = stubFetch([(c) => (c.url === `${JF}/Users`
    ? json([{ Id: "aaaa", Name: "alice" }, { Id: "bbbb", Name: "bob" }])
    : null)]);
});
afterEach(() => {
  net.restore();
  raw.close();
});

test("un compte sans réglages n'a pas de dates ; un compte qui en a garde les siennes", async () => {
  const first = await buildUsersOverview(db, null, { dailyLimit: null });
  const byName = Object.fromEntries(first.users.map((u) => [u.username, u]));
  assert.equal(byName.bob.createdAt, null);
  assert.equal(byName.bob.updatedAt, null);
  assert.equal(byName.alice.createdAt, new Date(CREATED).toISOString());
  assert.equal(byName.alice.updatedAt, new Date(CREATED).toISOString());

  // Deux lectures de suite rendent les mêmes dates.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await buildUsersOverview(db, null, { dailyLimit: null });
  assert.deepEqual(
    second.users.map((u) => [u.username, u.createdAt, u.updatedAt]),
    first.users.map((u) => [u.username, u.createdAt, u.updatedAt]),
  );
});
