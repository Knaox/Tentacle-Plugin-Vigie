/* ------------------------------------------------------------------ */
/*  Vigie — Les migrations versionnées, notées par Tentacle            */
/* ------------------------------------------------------------------ */

import type { PluginMigration, PluginStorageQueries } from "./contract";
import { TABLES, createTableSql, type TableSpec } from "./schema";

/*
 * Tentacle note chaque version passée (`plugin_migrations`) : une migration ne
 * se joue qu'une fois, dans une transaction — elle réussit entière ou ne
 * laisse rien.
 *
 * La 1 RECONNAÎT ce qui existe : une table absente est créée ; une table déjà
 * là (copiée depuis MariaDB par la migration du serveur, ou laissée par une
 * version d'avant) reçoit seulement les colonnes qui lui manquent et ses
 * index. Elle ne supprime, ne recrée ni ne réécrit RIEN de ce qui existe.
 * Une colonne de clé absente d'une table présente est une anomalie : la
 * migration s'arrête (rien n'est appliqué) au lieu de deviner.
 */

async function reconcileTable(db: PluginStorageQueries, table: TableSpec): Promise<void> {
  const existing = new Set((await db.columns(table.name)).map((c) => c.toLowerCase()));
  if (existing.size === 0) {
    await db.execute(createTableSql(table));
  } else {
    const missingKey = table.primaryKey.filter((k) => !existing.has(k));
    if (missingKey.length > 0) {
      throw new Error(`${table.name} existe sans sa clé (${missingKey.join(", ")}) — rien n'est modifié`);
    }
    for (const column of table.columns) {
      if (existing.has(column.name)) continue;
      await db.execute(`ALTER TABLE ${table.name} ADD COLUMN ${column.name} ${column.add}`);
      console.log(`[SeerDB] Colonne ajoutée : ${table.name}.${column.name}`);
    }
  }
  for (const index of table.indexes) {
    await db.execute(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${table.name} (${index.columns})`);
  }
}

export const MIGRATIONS: readonly PluginMigration[] = [
  {
    version: 1,
    name: "tables de Vigie (création ou reconnaissance)",
    up: async (db) => {
      for (const table of TABLES) await reconcileTable(db, table);
    },
  },
];
