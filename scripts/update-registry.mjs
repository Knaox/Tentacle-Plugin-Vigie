#!/usr/bin/env node
/**
 * Insère/actualise une version du plugin dans le registry du marketplace
 * (repo tiers Knaox/tentacle-plugins-registry), lu par le backend via
 * raw.githubusercontent. Le workflow checke-out ce repo à part et passe le
 * chemin du registry.json via --registry.
 *
 *   node scripts/update-registry.mjs \
 *     --registry ../registry/registry.json \
 *     --version 1.12.0 \
 *     --url https://github.com/Knaox/Tentacle-Plugin-Vigie/releases/download/v1.12.0/plugin-vigie-v1.12.0.tar.gz \
 *     --checksum sha256:abc… \
 *     --min 1.1.0 --date 2026-07-14 \
 *     --changelog "Notes…" [--id seer]
 *
 * Idempotent : réécrit l'entrée si la version existe déjà. `latestVersion` ne
 * désigne JAMAIS une version qui exige un serveur 1.25 ou plus récent : les
 * serveurs d'avant ne lisent pas cette exigence (lib/registry-entry.mjs).
 * Préserve le reste du fichier (2 espaces + newline final).
 *
 * La FICHE (nom, description, auteur) est recopiée depuis plugin.json à chaque
 * publication : ces champs avaient été saisis à la main lors de la première mise
 * en ligne et sont restés sur « Seer - Media Requests » jusqu'à la 1.14.0, bien
 * après le renommage en Vigie. L'`id`, lui, ne bouge jamais — c'est la clé des
 * installations existantes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyVersion } from "./lib/registry-entry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const registryPath = arg("registry");
const version = arg("version");
const downloadUrl = arg("url");
const checksum = arg("checksum");
const minTentacleVersion = arg("min", "1.1.0");
const maxRaw = arg("max", "");
const releaseDate = arg("date");
const changelogFile = arg("changelog-file");
// Le changelog (souvent multi-ligne) est passé par FICHIER pour éviter les
// soucis d'échappement shell ; --changelog reste possible en secours.
const changelog = changelogFile
  ? readFileSync(changelogFile, "utf8").trim()
  : arg("changelog", "");
const id = arg("id", "seer");
const manifestPath = arg("manifest", join(ROOT, "plugin.json"));

for (const [k, v] of Object.entries({ registry: registryPath, version, url: downloadUrl, checksum, date: releaseDate })) {
  if (!v) {
    console.error(`Argument manquant : --${k}`);
    process.exit(1);
  }
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const plugin = registry.plugins?.find((p) => p.id === id);
if (!plugin) {
  console.error(`Plugin « ${id} » introuvable dans ${registryPath}`);
  process.exit(1);
}

const entry = {
  version,
  minTentacleVersion,
  maxTentacleVersion: maxRaw ? maxRaw : null,
  downloadUrl,
  checksum,
  changelog,
  releaseDate,
};

// Fiche du marketplace : plugin.json fait foi (l'id reste celui du registry).
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const field of ["name", "description", "author"]) {
    if (manifest[field] && plugin[field] !== manifest[field]) {
      console.error(`Fiche : ${field} « ${plugin[field]} » → « ${manifest[field]} »`);
      plugin[field] = manifest[field];
    }
  }
} catch (err) {
  // Fiche inchangée plutôt que publication bloquée.
  console.error(`Fiche non synchronisée (${manifestPath}) : ${err.message}`);
}

applyVersion(plugin, entry);

writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.error(`Registry mis à jour : ${id} ${version} publiée, latestVersion → ${plugin.latestVersion}`);
