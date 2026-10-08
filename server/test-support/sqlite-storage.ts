import type { PluginMigration, PluginStorage, PluginStorageQueries, StorageSql, UpsertSpec } from "../storage/contract";
import { createVigieDb, type VigieDb } from "../storage/vigie-db";
import { bindable, openTestDatabase, type TestDatabase } from "./sqlite";

/*
 * L'interface de stockage de Tentacle, rejouée sur une VRAIE SQLite pour les
 * tests : mêmes tournures que l'hôte (apps/backend/src/services/pluginStorage),
 * mêmes migrations notées dans `plugin_migrations`. Réservé aux tests.
 */

const NOW_MS = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";
const UNIT_MS = { second: 1_000, minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

function upsert(spec: UpsertSpec): string {
  const rows = Math.max(1, spec.rows ?? 1);
  const tuple = `(${spec.columns.map(() => "?").join(", ")})`;
  const insert = `INSERT INTO ${spec.table} (${spec.columns.join(", ")}) VALUES ${Array.from({ length: rows }, () => tuple).join(", ")}`;
  const sets = spec.update.map((u) => (typeof u === "string" ? `${u} = excluded.${u}` : `${u[0]} = ${NOW_MS}`));
  const target = spec.conflict.join(", ");
  return sets.length ? `${insert} ON CONFLICT(${target}) DO UPDATE SET ${sets.join(", ")}` : `${insert} ON CONFLICT(${target}) DO NOTHING`;
}

export function testSql(clock: () => Date = () => new Date()): StorageSql {
  return {
    now: () => NOW_MS,
    shiftedNow: (amount, unit) => `(${NOW_MS} + ${Math.trunc(amount) * UNIT_MS[unit]})`,
    startOfToday: () => {
      const midnight = clock();
      midnight.setHours(0, 0, 0, 0);
      return String(midnight.getTime());
    },
    upsert,
    insertIgnore: () => "INSERT OR IGNORE",
    dateParam: (date) => date.getTime(),
    readDate: (value) => {
      if (value === null || value === undefined || value === "") return null;
      if (value instanceof Date) return value;
      const date = new Date(typeof value === "bigint" ? Number(value) : (value as number | string));
      return Number.isNaN(date.getTime()) ? null : date;
    },
  };
}

function queriesOver(db: TestDatabase, sql: StorageSql): PluginStorageQueries {
  const normalize = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));
  const query = async <T>(text: string, ...params: unknown[]) =>
    db.prepare(text).all(...bindable(params, (d) => d.getTime())).map(normalize) as T[];
  const columns = async (table: string) =>
    (await query<{ name: string }>("SELECT name FROM pragma_table_info(?) ORDER BY cid", table)).map((r) => r.name);
  return {
    dialect: "sqlite",
    sql,
    query,
    execute: async (text, ...params) => Number(db.prepare(text).run(...bindable(params, (d) => d.getTime())).changes),
    columns,
    tableExists: async (table) => (await columns(table)).length > 0,
  };
}

/** `decorate` : pour simuler une base qui refuse (lectures en échec…), sur toutes les requêtes. */
export function sqliteStorage(
  db: TestDatabase,
  pluginId = "seer",
  decorate: (q: PluginStorageQueries) => PluginStorageQueries = (q) => q,
): PluginStorage {
  const sql = testSql();
  const base = decorate(queriesOver(db, sql));
  let depth = 0;
  const transaction: PluginStorage["transaction"] = async (fn) => {
    const sp = `sp_${depth}`;
    db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
    depth++;
    try {
      const out = await fn(base);
      depth--;
      db.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
      return out;
    } catch (err) {
      depth--;
      db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}`);
      throw err;
    }
  };
  const migrate = async (migrations: readonly PluginMigration[]) => {
    const done = new Set((await base.query<{ version: number }>(
      "SELECT version FROM plugin_migrations WHERE pluginId = ?", pluginId,
    )).map((r) => r.version));
    const applied: number[] = [];
    for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
      if (done.has(m.version)) continue;
      await transaction(async (tx) => {
        await m.up(tx);
        await tx.execute(
          "INSERT INTO plugin_migrations (pluginId, version, name, appliedAt) VALUES (?, ?, ?, ?)",
          pluginId, m.version, m.name, Date.now(),
        );
      });
      applied.push(m.version);
    }
    return applied;
  };
  return { ...base, version: 1, transaction, migrate };
}

export interface Notification { data: Record<string, unknown> }

/** Une base de test prête : la table de l'hôte posée, les notifications du cœur notées. */
export function testDb(path = ":memory:"): { db: VigieDb; raw: TestDatabase; storage: PluginStorage; notifications: Notification[] } {
  const raw = openTestDatabase(path);
  raw.exec(`CREATE TABLE IF NOT EXISTS plugin_migrations (
    pluginId TEXT NOT NULL, version INTEGER NOT NULL, name TEXT NOT NULL, appliedAt DATETIME NOT NULL,
    PRIMARY KEY (pluginId, version))`);
  const notifications: Notification[] = [];
  const storage = sqliteStorage(raw);
  const core = { notification: { create: async (args: Notification) => { notifications.push(args); return args; } } };
  return { db: createVigieDb(storage, core), raw, storage, notifications };
}
