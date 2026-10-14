#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  Déploiement local — copie le build dans l'instance de dev         */
/* ------------------------------------------------------------------ */

/*
 * La procédure était décrite en prose dans le README et faite à la main —
 * avec les ratés qu'on imagine : bundle copié au mauvais niveau (jamais lu
 * par l'hôte), version d'installed.json jamais bumpée donc `?v=` inchangé et
 * navigateur servant l'ancien bundle depuis son cache HTTP.
 *
 * L'hôte lit EXACTEMENT trois chemins (voir apps/backend/src/routes/plugins.ts
 * et pluginBackendLoader.ts) :
 *   - <seer>/dist/plugin-seer.iife.js   (bundle client, chemin EN DUR)
 *   - <seer>/server/index.mjs           (module serveur)
 *   - <seer>/plugin.json                (manifeste)
 * et le cache-buster du bundle vient de installed.json → version.
 *
 * Après la copie : REDÉMARRER le backend (il charge le module serveur au boot,
 * et son watcher ignore data/ par construction).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(ROOT, "..", "Tentacle-TV", "apps", "backend", "data", "plugins", "seer");
const INSTALLED = resolve(TARGET, "..", "installed.json");

const fail = (msg) => { console.error(`[deploy-local] ${msg}`); process.exit(1); };

if (!existsSync(TARGET)) fail(`cible introuvable : ${TARGET}`);

const bundle = resolve(ROOT, "dist", "plugin-seer.iife.js");
const serverModule = resolve(ROOT, "server", "index.mjs");
const manifest = resolve(ROOT, "plugin.json");
if (!existsSync(bundle)) fail("dist/plugin-seer.iife.js absent — lancer `npm run build` d'abord");
if (!existsSync(serverModule)) fail("server/index.mjs absent — lancer `npm run build` d'abord");

const version = JSON.parse(readFileSync(manifest, "utf8")).version;

mkdirSync(resolve(TARGET, "dist"), { recursive: true });
mkdirSync(resolve(TARGET, "server"), { recursive: true });
copyFileSync(bundle, resolve(TARGET, "dist", "plugin-seer.iife.js"));
copyFileSync(serverModule, resolve(TARGET, "server", "index.mjs"));
copyFileSync(manifest, resolve(TARGET, "plugin.json"));
/* hls.js, servi à la demande par le module serveur (server/routes-vendor.ts). */
mkdirSync(resolve(TARGET, "dist", "vendor"), { recursive: true });
for (const file of ["hls.min.js", "hls.js.LICENSE"]) {
  const from = resolve(ROOT, "dist", "vendor", file);
  if (existsSync(from)) copyFileSync(from, resolve(TARGET, "dist", "vendor", file));
}

/* Cache-buster : l'URL du bundle est `.../bundle?v=<version d'installed.json>`.
 * Sans cette mise à jour, le navigateur ressert l'ancien bundle indéfiniment. */
let cacheBusted = false;
if (existsSync(INSTALLED)) {
  const list = JSON.parse(readFileSync(INSTALLED, "utf8"));
  const entry = Array.isArray(list) ? list.find((p) => p?.pluginId === "seer") : null;
  if (entry && entry.version !== version) {
    entry.version = version;
    writeFileSync(INSTALLED, JSON.stringify(list, null, 2) + "\n");
    cacheBusted = true;
  }
}

/* Orphelins de copies manuelles passées, jamais lus par l'hôte — les laisser
 * ferait croire, un jour, qu'ils servent à quelque chose. */
for (const orphan of ["plugin-seer.iife.js", "index.mjs"]) {
  const p = resolve(TARGET, orphan);
  if (existsSync(p)) {
    rmSync(p);
    console.log(`[deploy-local] orphelin supprimé : ${orphan}`);
  }
}

console.log(`[deploy-local] Vigie ${version} déployé vers ${TARGET}`);
console.log(`[deploy-local] installed.json ${cacheBusted ? "mis à jour" : "déjà à jour"} — redémarrer le backend pour recharger le module serveur`);
