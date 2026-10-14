#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  Build — les bibliothèques servies à la demande (dist/vendor/)       */
/* ------------------------------------------------------------------ */

/*
 * hls.js n'entre pas dans le paquet de la page (src/preview/hlsLoader.ts) :
 * il est livré à côté, dans `dist/vendor/`, et servi par le serveur de Vigie
 * (server/routes-vendor.ts). Copié APRÈS `vite build`, qui vide `dist/`.
 * Licence Apache-2.0 : sa notice part avec lui.
 */

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HLS = resolve(ROOT, "node_modules", "hls.js");
const OUT = resolve(ROOT, "dist", "vendor");

mkdirSync(OUT, { recursive: true });
copyFileSync(resolve(HLS, "dist", "hls.min.js"), resolve(OUT, "hls.min.js"));
copyFileSync(resolve(HLS, "LICENSE"), resolve(OUT, "hls.js.LICENSE"));
console.log("[copy-vendor] dist/vendor/hls.min.js");
