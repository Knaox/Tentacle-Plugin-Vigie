import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS } from "./migrations";
import { TABLES } from "./schema";
import { openVigieDb } from "./startup";
import { testDb } from "../test-support/sqlite-storage";
import { copiedTables, NOW, TWO_DAYS } from "../test-support/copied-tables";
import type { TestDatabase } from "../test-support/sqlite";
import type { PluginStorage } from "./contract";

/*
 * Les migrations de Vigie, sur une vraie SQLite :
 * - base neuve : les six tables, leurs index ;
 * - tables COPIÉES depuis MariaDB par la migration du serveur (forme de
 *   docs/sqlite/GENERIC-COPY.md : TEXT / INTEGER / REAL / DATETIME en ms, clé
 *   en contrainte de table, index sous leur nom MariaDB) : reconnues, rien de
 *   recréé, rien de perdu, et Vigie s'en sert aussitôt ;
 * - jamais rien de destructeur ; une anomalie arrête tout, sans rien appliquer.
 */

let raw: TestDatabase;
let storage: PluginStorage;

beforeEach(() => {
  ({ raw, storage } = testDb());
});
afterEach(() => raw.close());

const tables = () => raw.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name LIKE 'seer_%' ORDER BY name").all();
const indexes = () => raw.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name").all().map((r) => r.name);

test("base neuve : les six tables et leurs index", async () => {
  assert.deepEqual(await storage.migrate(MIGRATIONS), [1]);
  assert.deepEqual(tables().map((t) => t.name), TABLES.map((t) => t.name).sort());
  for (const name of ["idx_seer_req_user", "idx_seer_req_queue", "idx_cleanup_status", "idx_seer_user_seerrid", "idx_tmdbc_digital"]) {
    assert.ok(indexes().includes(name), name);
  }
  assert.deepEqual(await storage.migrate(MIGRATIONS), [], "une seule fois");
});

test("tables copiées depuis MariaDB : reconnues, complétées, rien de recréé ni de perdu", async () => {
  copiedTables(raw);
  const before = tables().find((t) => t.name === "seer_tmdb_cache")?.sql;
  assert.deepEqual(await storage.migrate(MIGRATIONS), [1]);

  // Rien de recréé : la définition d'une table complète n'a pas bougé, ses lignes sont là.
  assert.equal(tables().find((t) => t.name === "seer_tmdb_cache")?.sql?.includes('"vote_average" REAL'), true);
  assert.notEqual(before, undefined);
  const cached = raw.prepare("SELECT title, vote_average, expires_at FROM seer_tmdb_cache").all();
  assert.deepEqual(cached.map((r) => ({ ...r })), [{ title: "Un film", vote_average: 7.7, expires_at: NOW + 86_400_000 }]);
  // Les colonnes venues après sont ajoutées, la ligne intacte.
  const cols = raw.prepare("SELECT name FROM pragma_table_info('seer_requests')").all().map((r) => r.name);
  for (const name of ["origin", "platform"]) assert.ok(cols.includes(name), name);
  const [row] = raw.prepare("SELECT id, title, created_at, origin FROM seer_requests").all();
  assert.deepEqual({ ...row }, { id: "r1", title: "Un film", created_at: NOW - TWO_DAYS, origin: null });
  // Les index de la copie sont ceux de Vigie : aucun en double.
  assert.equal(indexes().filter((n) => n === "idx_seer_req_queue").length, 1);
  // Les tables absentes de la copie sont créées.
  assert.equal(tables().length, TABLES.length);
});

test("jamais rien de destructeur dans une migration", async () => {
  const executed: string[] = [];
  const spy = { ...storage, execute: (sql: string, ...p: unknown[]) => { executed.push(sql); return storage.execute(sql, ...p); } };
  for (const migration of MIGRATIONS) await migration.up(spy);
  assert.deepEqual(executed.filter((sql) => /\b(DROP|DELETE|TRUNCATE|RENAME)\b/i.test(sql)), []);
});

test("une table copiée sans sa clé : la migration s'arrête, rien n'est appliqué", async () => {
  raw.exec(`CREATE TABLE seer_search_meta (meta_value TEXT)`);
  await assert.rejects(storage.migrate(MIGRATIONS), /sans sa clé/);
  assert.equal(tables().length, 1, "aucune table créée à moitié");
  assert.deepEqual(raw.prepare("SELECT * FROM plugin_migrations").all(), []);
});

test("sans base SQLite prêtée par Tentacle, Vigie ne démarre rien", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    assert.equal(await openVigieDb({ getPrisma: () => ({}) }), null);
    assert.equal(await openVigieDb({ storage: { ...storage, dialect: "mysql" }, getPrisma: () => ({}) }), null);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 2);
  assert.equal(tables().length, 0, "aucune requête, aucune table");
});
