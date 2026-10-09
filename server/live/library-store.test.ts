import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { coreLibraryStore } from "./library-store";
import { buildSnapshot, libraryStateOf } from "./library-keys";

/*
 * La table du serveur Tentacle, telle que sa migration SQLite la crée
 * (apps/backend/prisma/migrations-sqlite/0001_init.sql) : `removedAt` en
 * millisecondes, NULL tant que l'item est là. La base regroupe elle-même
 * les épisodes par saison.
 */

let db: VigieDb;
let raw: TestDatabase;

beforeEach(() => {
  ({ db, raw } = testDb());
  raw.exec(`CREATE TABLE library_known_id (itemId TEXT NOT NULL PRIMARY KEY, contentKey TEXT, removedAt DATETIME)`);
  raw.exec(`CREATE INDEX library_known_id_contentKey_idx ON library_known_id(contentKey)`);
});
afterEach(() => raw.close());

function insert(itemId: string, contentKey: string | null, removedAt: number | null): void {
  raw.prepare("INSERT INTO library_known_id (itemId, contentKey, removedAt) VALUES (?, ?, ?)").run(itemId, contentKey, removedAt);
}

test("l'empreinte : lignes, départs, dernier départ", async () => {
  insert("a", "m:t:603", null);
  insert("b", "m:t:604", 1_700_000_000_000);
  insert("c", "e:t:1399:1:1", 1_700_000_500_000);
  const sig = await coreLibraryStore(db).signature();
  assert.deepEqual(sig, { total: 3, departed: 2, last: 1_700_000_500_000 });
});

test("les lignes : un film, une saison — regroupées par la base", async () => {
  insert("m1", "m:t:603", null);
  insert("m2", "m:t:603", 1000); // ancienne version remplacée
  insert("m3", "m:t:604", 2000);
  insert("e1", "e:t:1399:1:1", null);
  insert("e2", "e:t:1399:1:2", 3000);
  insert("e3", "e:t:1399:2:1", 4000);
  insert("e4", "e:t:1399:2:10", 5000);
  insert("x1", "m:n:dune:2021", null);
  insert("x2", null, null);
  insert("x3", "", null); // une série : pas de clé
  const rows = await coreLibraryStore(db).rows();
  assert.ok(rows);
  const byKey = new Map(rows.map((r) => [r.key.replace(/:$/, ""), r]));
  assert.deepEqual(byKey.get("m:t:603"), { key: "m:t:603", present: true, departedAt: 1000 });
  assert.deepEqual(byKey.get("m:t:604"), { key: "m:t:604", present: false, departedAt: 2000 });
  assert.equal(byKey.get("e:t:1399:1")?.present, true);
  assert.deepEqual({ ...byKey.get("e:t:1399:2"), key: undefined }, { key: undefined, present: false, departedAt: 5000 });
  assert.equal(rows.length, 4);

  const snap = buildSnapshot(rows);
  assert.equal(libraryStateOf(snap, "movie", 603).state, "present");
  assert.equal(libraryStateOf(snap, "movie", 604).state, "gone");
  const series = libraryStateOf(snap, "tv", 1399);
  assert.equal(series.state, "present");
  assert.deepEqual(series.state === "present" && [...series.goneSeasons], [2]);
});

test("table absente (serveur trop ancien) : rien, sans erreur", async () => {
  raw.exec("DROP TABLE library_known_id");
  const store = coreLibraryStore(db);
  assert.equal(await store.signature(), null);
  assert.equal(await store.rows(), null);
});
