import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureTables } from "./db";

/*
 * L'ancienne sonde supprimait seer_requests et seer_cleanup_queue sur N'IMPORTE
 * QUELLE erreur de lecture. Une base occupée au démarrage (SQLITE_BUSY, verrou
 * MariaDB) effaçait ainsi toutes les demandes. Ici, toutes les lectures échouent :
 * aucune instruction destructrice ne doit partir.
 */

function failingReads() {
  const executed: string[] = [];
  const prisma = {
    $queryRawUnsafe: async () => { throw new Error("database is locked"); },
    $executeRawUnsafe: async (sql: string) => { executed.push(sql); return 0; },
  };
  return { prisma, executed };
}

test("des lectures en échec ne suppriment jamais une table", async () => {
  const { prisma, executed } = failingReads();
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    await ensureTables(prisma as never);
  } finally {
    console.error = original;
  }
  const destructive = executed.filter((sql) => /\b(DROP|TRUNCATE|DELETE)\b/i.test(sql));
  assert.deepEqual(destructive, []);
  // Les tables se créent si elles manquent…
  assert.ok(executed.some((sql) => /CREATE TABLE IF NOT EXISTS seer_requests/.test(sql)));
  assert.ok(executed.some((sql) => /CREATE TABLE IF NOT EXISTS seer_cleanup_queue/.test(sql)));
  // … et l'anomalie se DIT.
  assert.ok(errors.length > 0);
});
