#!/usr/bin/env node
/**
 * Rejoue les invariants du registre sur un registry.json ENTIER, tel qu'il va
 * partir (lib/registry-entry.mjs) : chaque extension, telle que la liraient les
 * anciens serveurs Tentacle (familles A et B). Code de sortie non nul au
 * premier écart — la publication s'arrête avant le push du registre.
 *
 *   node scripts/verify-registry.mjs registry/registry.json
 */
import { readFileSync } from "node:fs";
import { assertRegistryEntry } from "./lib/registry-entry.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage : verify-registry.mjs <registry.json>");
  process.exit(2);
}
let registry;
try {
  registry = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  console.error(`Registre illisible (${path}) : ${err.message}`);
  process.exit(1);
}
const plugins = Array.isArray(registry.plugins) ? registry.plugins : [];
if (plugins.length === 0) {
  console.error("Registre sans aucune extension");
  process.exit(1);
}
try {
  for (const plugin of plugins) assertRegistryEntry(plugin);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
console.error(`Registre conforme : ${plugins.length} extension(s)`);
