/* ------------------------------------------------------------------ */
/*  Vigie — Le contrat de stockage que Tentacle prête (`ctx.storage`)   */
/* ------------------------------------------------------------------ */

/*
 * Recopie du contrat de l'hôte (Tentacle ≥ 1.25.0,
 * apps/backend/src/services/pluginStorage/types.ts) : les noms traversent la
 * frontière d'un module chargé à l'exécution, ils ne se renomment pas.
 *
 * La base est SQLite. Une date y est TOUJOURS un INTEGER en millisecondes
 * epoch UTC — le format que le cœur (Prisma) relit et compare : jamais
 * `CURRENT_TIMESTAMP`, `datetime('now')` ni une chaîne.
 */

export type StorageDialect = "sqlite";
export type IntervalUnit = "second" | "minute" | "hour" | "day";

/** Sur conflit : une colonne seule reprend la valeur proposée ; `[col, "now"]` y écrit l'instant. */
export type UpsertUpdate = string | readonly [string, "now"];

export interface UpsertSpec {
  table: string;
  columns: readonly string[];
  rows?: number;
  conflict: readonly string[];
  update: readonly UpsertUpdate[];
}

export interface StorageSql {
  now(): string;
  shiftedNow(amount: number, unit: IntervalUnit): string;
  startOfToday(): string;
  upsert(spec: UpsertSpec): string;
  insertIgnore(): string;
  dateParam(date: Date): number;
  readDate(value: unknown): Date | null;
}

export interface PluginMigration {
  version: number;
  name: string;
  up: (storage: PluginStorageQueries) => Promise<void>;
}

export interface PluginStorageQueries {
  readonly dialect: StorageDialect;
  readonly sql: StorageSql;
  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  execute(sql: string, ...params: unknown[]): Promise<number>;
  columns(table: string): Promise<string[]>;
  tableExists(table: string): Promise<boolean>;
}

export interface PluginStorage extends PluginStorageQueries {
  readonly version: 1;
  transaction<T>(fn: (tx: PluginStorageQueries) => Promise<T>): Promise<T>;
  migrate(migrations: readonly PluginMigration[]): Promise<number[]>;
}

/**
 * Le client Prisma du cœur, réduit à ce que Vigie en emploie : les
 * notifications. Tout le reste passe par `ctx.storage`.
 */
export interface CorePrisma {
  notification: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}
