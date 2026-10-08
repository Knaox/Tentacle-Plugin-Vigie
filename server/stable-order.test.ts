import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getAllRequests, getGlobalStats, getNextQueued, getPendingCleanups, getUserRequests } from "./db";
import { MIGRATIONS } from "./storage/migrations";
import { testDb } from "./test-support/sqlite-storage";
import type { VigieDb } from "./storage/vigie-db";
import type { TestDatabase } from "./test-support/sqlite";

/*
 * SQLite rend les lignes dans l'ordre de SON plan : entre ex æquo, sans
 * départage, un classement ou une page changeait d'un appel à l'autre (vu au
 * banc sur /stats). Chaque tri qui peut avoir des ex æquo est départagé par
 * une clé : ici, les MÊMES lignes insérées dans deux ordres opposés doivent
 * donner exactement la même réponse, et les pages se suivre sans trou ni
 * doublon.
 */

const opened: TestDatabase[] = [];
afterEach(() => { while (opened.length) opened.pop()!.close(); });

const AT = Date.UTC(2026, 9, 8, 12, 0, 0);

/** Des demandes à la même date ; trois comptes, deux du même nom. */
const ROWS: ReadonlyArray<[id: string, user: string, name: string, tmdb: number, title: string]> = [
  ["r1", "u1", "alice", 603, "Matrix"], ["r2", "u2", "bob", 604, "Matrix"],
  ["r3", "u3", "alice", 605, "Alien"], ["r4", "u1", "alice", 605, "Alien"],
  ["r5", "u2", "bob", 606, "Brazil"], ["r6", "u3", "alice", 606, "Brazil"],
];

async function seeded(reverse: boolean): Promise<VigieDb> {
  const t = testDb();
  opened.push(t.raw);
  await t.storage.migrate(MIGRATIONS);
  for (const [id, user, name, tmdb, title] of reverse ? [...ROWS].reverse() : ROWS) {
    await t.db.execute(
      `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, 'movie', ?, ?, 'queued', ?, ?)`,
      id, user, name, tmdb, title, AT, AT,
    );
  }
  return t.db;
}

test("classements de /stats : mêmes ex æquo, même ordre, quel que soit l'ordre d'écriture", async () => {
  const [a, b] = [await getGlobalStats(await seeded(false)), await getGlobalStats(await seeded(true))];
  assert.deepEqual(a.topRequested, b.topRequested);
  assert.deepEqual(a.topUsers, b.topUsers);
  // Tous à 1 : par titre, puis par identifiant TMDB.
  assert.deepEqual(a.topRequested.map((r) => `${r.title}:${r.tmdbId}`),
    ["Alien:605", "Brazil:606", "Matrix:603", "Matrix:604"]);
  // Tous à 2 : par nom, puis par compte (deux « alice » distinctes).
  assert.deepEqual(a.topUsers, [{ username: "alice", count: 2 }, { username: "alice", count: 2 }, { username: "bob", count: 2 }]);
});

test("les pages se suivent sans trou ni doublon entre ex æquo", async () => {
  for (const reverse of [false, true]) {
    const db = await seeded(reverse);
    const pages = [];
    for (let page = 1; page <= 3; page++) pages.push(...(await getAllRequests(db, { page, limit: 2 })).results.map((r) => r.id));
    assert.deepEqual(pages, ["r1", "r2", "r3", "r4", "r5", "r6"]);
    const mine = [];
    for (let page = 1; page <= 2; page++) mine.push(...(await getUserRequests(db, "u1", { page, limit: 1 })).results.map((r) => r.id));
    assert.deepEqual(mine, ["r1", "r4"]);
  }
});

test("la file prend la même demande entre ex æquo", async () => {
  assert.equal((await getNextQueued(await seeded(false)))?.id, "r1");
  assert.equal((await getNextQueued(await seeded(true)))?.id, "r1");
});

test("la file de nettoyage sert les mêmes tâches, dans le même ordre, entre ex æquo", async () => {
  for (const reverse of [false, true]) {
    const db = await seeded(reverse);
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6"];
    // Six nettoyages du même instant, échus : seule la clé les départage.
    for (const id of reverse ? [...ids].reverse() : ids) {
      await db.execute(
        `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, status, created_at, next_retry_at)
         VALUES (?, 'delete', 'movie', 603, 'Matrix', 'pending', ?, ?)`,
        id, AT, AT,
      );
    }
    assert.deepEqual((await getPendingCleanups(db, 3)).map((c) => c.id), ["c1", "c2", "c3"]);
  }
});
