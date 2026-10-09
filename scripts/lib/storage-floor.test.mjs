import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertStorageFloor } from "./registry-entry.mjs";

/*
 * Le verrou qui garde les serveurs 1.24 : un Vigie qui déclare SQLite exige
 * Tentacle 1.25.0 au moins. Lancé par `npm test`, donc par la publication.
 */

const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../../plugin.json", import.meta.url)), "utf8"));

test("le plugin.json publié lie storage.sqlite à un plancher 1.25.0", () => {
  assert.doesNotThrow(() => assertStorageFloor(manifest, manifest.minTentacleVersion));
});

test("une version SQLite sans plancher 1.25 est refusée", () => {
  assert.throws(() => assertStorageFloor({ storage: { sqlite: true } }, "0.9.0"), /il faut 1\.25\.0/);
  assert.throws(() => assertStorageFloor({ storage: { sqlite: true } }, undefined), /il faut 1\.25\.0/);
  assert.doesNotThrow(() => assertStorageFloor({ storage: { sqlite: true } }, "1.25.0"));
  assert.doesNotThrow(() => assertStorageFloor({}, "0.9.0"));
});
