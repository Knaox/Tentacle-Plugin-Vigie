import { test } from "node:test";
import assert from "node:assert/strict";
import { getAllRequests, getGlobalStats, getNextQueued, getPendingCleanups, getUserRequests } from "./db";

/*
 * Entre ex æquo, un tri sans départage n'est pas un ordre : MariaDB comme
 * SQLite rendent alors les lignes dans l'ordre de leur plan, et une page de
 * demandes pouvait répéter ou sauter une ligne, un classement changer d'un
 * appel à l'autre, la file servir une autre demande. (Reports de 6a75519 et
 * 28153e8, ligne 1.24 sur MariaDB.)
 *
 * Deux étages :
 * - la CONSTRUCTION des requêtes : chaque tri porte son départage, quel que
 *   soit le moteur ;
 * - leur EFFET sur une vraie base. Cette ligne n'a pas de MariaDB de test : la
 *   SQLite intégrée à Node 22 (`node:sqlite`) en tient lieu — les requêtes
 *   rejouées ici n'emploient aucune tournure propre à MariaDB.
 */

type Row = Record<string, unknown>;

/** Un faux client Prisma : il note le SQL, et le joue sur une vraie SQLite. */
function sqlitePrisma() {
  const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: string): unknown })
    .getBuiltinModule("node:sqlite") as { DatabaseSync: new (p: string) => {
      exec(sql: string): void;
      function(name: string, fn: () => unknown): void;
      prepare(sql: string): { all(...p: unknown[]): Row[]; run(...p: unknown[]): unknown };
      close(): void;
    } };
  const db = new DatabaseSync(":memory:");
  // `NOW()` de MariaDB (file de nettoyage) : une heure fixe, après les lignes du test.
  db.function("NOW", () => "2026-10-08 13:00:00");
  db.exec(`CREATE TABLE seer_requests (id TEXT PRIMARY KEY, jellyfin_user_id TEXT NOT NULL, username TEXT NOT NULL,
    media_type TEXT NOT NULL, tmdb_id INTEGER NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, pending_cleanup_id TEXT)`);
  db.exec(`CREATE TABLE seer_cleanup_queue (id TEXT PRIMARY KEY, action TEXT NOT NULL, media_type TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL, title TEXT NOT NULL, delete_files INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
    created_at TEXT NOT NULL, next_retry_at TEXT NOT NULL)`);
  const sql: string[] = [];
  const prisma = {
    $queryRawUnsafe: async (text: string, ...params: unknown[]) => {
      sql.push(text);
      return db.prepare(text).all(...params).map((r) => Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]),
      ));
    },
    $executeRawUnsafe: async (text: string, ...params: unknown[]) => { db.prepare(text).run(...params); return 1; },
  };
  return { prisma, sql, close: () => db.close() };
}

/** Les mêmes demandes, à la même date ; un compte « alice » a deux identifiants. */
const ROWS: ReadonlyArray<[string, string, string, number, string]> = [
  ["r1", "u1", "alice", 603, "Matrix"], ["r2", "u2", "bob", 604, "Matrix"],
  ["r3", "u3", "carol", 605, "Alien"], ["r4", "u1", "alice", 605, "Alien"],
  ["r5", "u2", "bob", 606, "Brazil"], ["r6", "u3", "carol", 606, "Brazil"],
];

async function seeded(reverse: boolean) {
  const t = sqlitePrisma();
  for (const [id, user, name, tmdb, title] of reverse ? [...ROWS].reverse() : ROWS) {
    await t.prisma.$executeRawUnsafe(
      `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, 'movie', ?, ?, 'queued', '2026-10-08 12:00:00', '2026-10-08 12:00:00')`,
      id, user, name, tmdb, title,
    );
    await t.prisma.$executeRawUnsafe(
      `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, status, created_at, next_retry_at)
       VALUES (?, 'delete', 'movie', ?, ?, 'pending', '2026-10-08 12:00:00', '2026-10-08 12:00:00')`,
      `c${id.slice(1)}`, tmdb, title,
    );
  }
  return t;
}

test("chaque tri porte son départage", async () => {
  const t = await seeded(false);
  await getGlobalStats(t.prisma as never);
  await getAllRequests(t.prisma as never, { page: 1, limit: 2 });
  await getUserRequests(t.prisma as never, "u1", { page: 1, limit: 1 });
  await getNextQueued(t.prisma as never);
  await getPendingCleanups(t.prisma as never, 25);
  t.close();
  const ordered = t.sql.filter((s) => /ORDER BY/.test(s)).map((s) => s.replace(/\s+/g, " "));
  assert.ok(ordered.some((s) => s.includes("ORDER BY cnt DESC, title ASC, tmdb_id ASC LIMIT 10")));
  assert.ok(ordered.some((s) => s.includes("ORDER BY cnt DESC, username ASC LIMIT 10")));
  assert.equal(ordered.filter((s) => s.includes("ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?")).length, 2);
  assert.ok(ordered.some((s) => s.includes("ORDER BY priority DESC, created_at ASC, id ASC LIMIT 1")));
  assert.ok(ordered.some((s) => s.includes("ORDER BY created_at ASC, id ASC LIMIT 25")));
});

test("les files servent la même demande et le même nettoyage entre ex æquo", async () => {
  for (const reverse of [false, true]) {
    const t = await seeded(reverse);
    const next = await getNextQueued(t.prisma as never);
    const cleanups = await getPendingCleanups(t.prisma as never, 3);
    t.close();
    assert.equal(next?.id, "r1");
    assert.deepEqual(cleanups.map((c) => c.id), ["c1", "c2", "c3"]);
  }
});

test("classements : mêmes ex æquo, même ordre, quel que soit l'ordre d'écriture", async () => {
  const a = await seeded(false);
  const b = await seeded(true);
  const [sa, sb] = [await getGlobalStats(a.prisma as never), await getGlobalStats(b.prisma as never)];
  a.close();
  b.close();
  assert.deepEqual(sa.topRequested, sb.topRequested);
  assert.deepEqual(sa.topUsers, sb.topUsers);
  assert.deepEqual(sa.topRequested.map((r) => `${r.title}:${r.tmdbId}`), ["Alien:605", "Brazil:606", "Matrix:603", "Matrix:604"]);
  assert.deepEqual(sa.topUsers.map((u) => u.username), ["alice", "bob", "carol"]);
});

test("les pages se suivent sans trou ni doublon entre ex æquo", async () => {
  for (const reverse of [false, true]) {
    const t = await seeded(reverse);
    const pages: unknown[] = [];
    for (let page = 1; page <= 3; page++) pages.push(...(await getAllRequests(t.prisma as never, { page, limit: 2 })).results.map((r) => r.id));
    const mine: unknown[] = [];
    for (let page = 1; page <= 2; page++) mine.push(...(await getUserRequests(t.prisma as never, "u1", { page, limit: 1 })).results.map((r) => r.id));
    t.close();
    assert.deepEqual(pages, ["r1", "r2", "r3", "r4", "r5", "r6"]);
    assert.deepEqual(mine, ["r1", "r4"]);
  }
});
