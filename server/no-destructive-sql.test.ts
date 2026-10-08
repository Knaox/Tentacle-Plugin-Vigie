import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./storage/migrations";
import type { PluginStorageQueries } from "./storage/contract";
import { sqliteStorage } from "./test-support/sqlite-storage";
import { openTestDatabase, type TestDatabase } from "./test-support/sqlite";

/*
 * Rien ne supprime une table de Vigie — ni au démarrage, ni sur une erreur.
 * L'ancienne sonde « SELECT puis DROP » effaçait toutes les demandes dès
 * qu'une lecture échouait (base occupée au démarrage).
 */

const DESTRUCTIVE = /\b(DROP|DELETE|TRUNCATE)\b/i;
let raw: TestDatabase;

beforeEach(() => {
  raw = openTestDatabase();
  raw.exec(`CREATE TABLE plugin_migrations (pluginId TEXT NOT NULL, version INTEGER NOT NULL, name TEXT NOT NULL,
    appliedAt DATETIME NOT NULL, PRIMARY KEY (pluginId, version))`);
});
afterEach(() => raw.close());

test("toutes les lectures échouent : rien de destructeur, échec propre, rien de noté", async () => {
  // Des demandes déjà là : elles doivent survivre.
  raw.exec(`CREATE TABLE seer_requests (id TEXT NOT NULL, title TEXT, PRIMARY KEY (id))`);
  raw.prepare("INSERT INTO seer_requests (id, title) VALUES ('r1', 'Un film')").run();
  const executed: string[] = [];
  const locked = (q: PluginStorageQueries): PluginStorageQueries => ({
    ...q,
    query: async () => { throw new Error("database is locked"); },
    columns: async () => { throw new Error("database is locked"); },
    tableExists: async () => { throw new Error("database is locked"); },
    execute: (sql, ...params) => { executed.push(sql); return q.execute(sql, ...params); },
  });
  const storage = sqliteStorage(raw, "seer", locked);

  await assert.rejects(storage.migrate(MIGRATIONS), /database is locked/);
  // Et la migration elle-même, appelée sur une base qui refuse de lire :
  await assert.rejects(MIGRATIONS[0].up(locked(sqliteStorage(raw))), /database is locked/);

  assert.deepEqual(executed.filter((sql) => DESTRUCTIVE.test(sql)), []);
  assert.deepEqual(raw.prepare("SELECT * FROM plugin_migrations").all(), []);
  assert.deepEqual(raw.prepare("SELECT id FROM seer_requests").all().map((r) => r.id), ["r1"]);
});

/** Les fichiers du serveur livré (hors tests), lus depuis la racine du dépôt (`npm test`). */
function serverSources(dir = "server"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return serverSources(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Le code sans ses commentaires : un commentaire peut raconter l'ancienne sonde. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

test("aucun DROP TABLE ni TRUNCATE dans le code du serveur", () => {
  const sources = serverSources();
  assert.ok(sources.length > 50, `sources lues : ${sources.length}`);
  // Aucune exception : aucune table de Vigie n'est prouvée morte.
  const offenders = sources.filter((path) => /\bDROP\s+TABLE\b|\bTRUNCATE\b/i.test(withoutComments(readFileSync(path, "utf8"))));
  assert.deepEqual(offenders, []);
  // Le garde-fou lui-même : un DROP dans une chaîne est bien vu.
  assert.ok(/\bDROP\s+TABLE\b/i.test(withoutComments("const q = `DROP TABLE seer_requests`; // DROP")));
  assert.ok(!/\bDROP\s+TABLE\b/i.test(withoutComments("/* la sonde faisait un DROP TABLE */\n// DROP TABLE")));
});
