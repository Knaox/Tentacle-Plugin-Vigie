import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// La version du paquet, pour l'adresse versionnée de hls.js (src/preview/hlsLoader.ts) :
// une nouvelle version de Vigie ne relit pas l'ancien fichier du cache du navigateur.
const VERSION = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  plugins: [react()],
  define: { __VIGIE_VERSION__: JSON.stringify(VERSION) },
  build: {
    lib: {
      entry: "src/plugin.tsx",
      name: "TentaclePluginSeer",
      formats: ["iife"],
      // Nom IMPOSÉ par Tentacle TV : la route qui sert le bundle construit
      // le chemin `plugin-<id>.iife.js` en dur et ignore le champ `entry`
      // du manifeste. Renommer ce fichier casse le plugin sur toutes les
      // installations existantes. Seul le nom affiché devient « Vigie ».
      fileName: () => "plugin-seer.iife.js",
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-i18next",
        "@tanstack/react-query",
        "@tentacle-tv/plugins-api",
      ],
      output: {
        globals: {
          react: "TentacleShared.React",
          "react/jsx-runtime": "TentacleShared.ReactJSXRuntime",
          "react-i18next": "TentacleShared.ReactI18next",
          "@tanstack/react-query": "TentacleShared.TanStackQuery",
          "@tentacle-tv/plugins-api": "TentacleShared.PluginsAPI",
        },
      },
    },
    outDir: "dist",
    minify: true,
    sourcemap: false,
  },
});
