/* ------------------------------------------------------------------ */
/*  Vigie — La base, telle que tout le serveur la reçoit               */
/* ------------------------------------------------------------------ */

import type { CorePrisma, PluginStorage, PluginStorageQueries } from "./contract";

/*
 * Une seule porte vers la base : les requêtes de `ctx.storage`, et le client
 * Prisma du cœur pour ses seuls modèles (`core.notification`).
 *
 * Les paramètres sont rendus sûrs ici, une fois pour toutes : une `Date`
 * devient des millisecondes entières (le format du cœur), un booléen 0/1,
 * `undefined` NULL. Une date ne part jamais en chaîne.
 */

export interface VigieQueries extends PluginStorageQueries {}

export interface VigieDb extends VigieQueries {
  /** Transaction COURTE — jamais d'appel réseau dedans (connexion unique). */
  transaction<T>(fn: (tx: VigieQueries) => Promise<T>): Promise<T>;
  /** Le client Prisma du cœur, pour ses modèles seulement. */
  readonly core: CorePrisma;
}

export function bindParams(params: readonly unknown[]): unknown[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  });
}

function wrap(queries: PluginStorageQueries): VigieQueries {
  return {
    dialect: queries.dialect,
    sql: queries.sql,
    query: (sql, ...params) => queries.query(sql, ...bindParams(params)),
    execute: (sql, ...params) => queries.execute(sql, ...bindParams(params)),
    columns: (table) => queries.columns(table),
    tableExists: (table) => queries.tableExists(table),
  };
}

export function createVigieDb(storage: PluginStorage, core: CorePrisma): VigieDb {
  return {
    ...wrap(storage),
    transaction: (fn) => storage.transaction((tx) => fn(wrap(tx))),
    core,
  };
}

/** Le contexte de l'hôte porte-t-il une base SQLite utilisable ? Sinon, Vigie ne démarre pas. */
export function usableStorage(storage: unknown): storage is PluginStorage {
  if (!storage || typeof storage !== "object") return false;
  const s = storage as Partial<PluginStorage>;
  return s.dialect === "sqlite" && typeof s.query === "function" && typeof s.execute === "function"
    && typeof s.transaction === "function" && typeof s.migrate === "function" && !!s.sql;
}
