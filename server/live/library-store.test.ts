import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { ROWS_SQL, coreLibraryStore } from "./library-store";
import { buildSnapshot, libraryStateOf } from "./library-keys";

/*
 * La table du serveur Tentacle sur MariaDB (apps/backend/prisma/core-init.sql) :
 * `removedAt` en DATETIME(3), relu par Prisma en `Date` ; les comptes en
 * BigInt. La base regroupe elle-même les épisodes par saison
 * (`SUBSTRING_INDEX`).
 */

function fakePrisma(answer: (sql: string) => unknown[]): PrismaClient {
  return { $queryRawUnsafe: async (sql: string) => answer(sql) } as unknown as PrismaClient;
}

test("l'empreinte : lignes, départs, dernier départ — comptes BigInt et date relue", async () => {
  const store = coreLibraryStore(fakePrisma(() => [{ total: 3n, departed: 2n, last: new Date(1_700_000_500_000) }]));
  assert.deepEqual(await store.signature(), { total: 3, departed: 2, last: 1_700_000_500_000 });
});

test("les lignes : regroupées par film et par saison, dans le dialecte de MariaDB", async () => {
  assert.match(ROWS_SQL, /SUBSTRING_INDEX\(contentKey, ':', 4\)/);
  const store = coreLibraryStore(fakePrisma(() => [
    { k: "m:t:603", present: 1n, departedAt: new Date(1000) },
    { k: "m:t:604", present: 0n, departedAt: new Date(2000) },
    { k: "e:t:1399:1", present: 1n, departedAt: null },
    { k: "e:t:1399:2", present: 0n, departedAt: new Date(5000) },
  ]));
  const rows = await store.rows();
  assert.deepEqual(rows, [
    { key: "m:t:603", present: true, departedAt: 1000 },
    { key: "m:t:604", present: false, departedAt: 2000 },
    { key: "e:t:1399:1", present: true, departedAt: null },
    { key: "e:t:1399:2", present: false, departedAt: 5000 },
  ]);
  const snap = buildSnapshot(rows ?? []);
  assert.equal(libraryStateOf(snap, "movie", 604).state, "gone");
  const series = libraryStateOf(snap, "tv", 1399);
  assert.deepEqual(series.state === "present" && [...series.goneSeasons], [2]);
});

test("table absente (serveur trop ancien) : rien, sans erreur", async () => {
  const store = coreLibraryStore(fakePrisma(() => { throw new Error("Table 'tentacle.library_known_id' doesn't exist"); }));
  assert.equal(await store.signature(), null);
  assert.equal(await store.rows(), null);
});
