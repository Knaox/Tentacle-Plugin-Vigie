import { build } from "esbuild";
import { globSync, rmSync } from "node:fs";

/*
 * Le serveur est vérifié par `npm run typecheck` (tsc -p server : Fastify en
 * dépendance de développement pour ses seuls types ; la base passe par le
 * contrat `ctx.storage`, plus par @prisma/client).
 *
 * Node lit le TypeScript nativement, mais sa résolution ESM exige des chemins
 * avec extension — que le code source n'écrit pas, esbuild s'en chargeant.
 * Plutôt que de tordre les imports pour le seul confort du runner, on passe par
 * le bundler déjà utilisé pour le serveur : aucune dépendance de test à
 * installer, et les fichiers testés restent tels qu'ils sont livrés.
 */

/* Table rase à chaque fois : un test supprimé ou déplacé laissait sinon son
 * ancienne version derrière lui, et elle continuait de passer au vert. */
rmSync("test-build", { recursive: true, force: true });

const entryPoints = [...globSync("server/**/*.test.ts"), ...globSync("src/**/*.test.ts")];
if (entryPoints.length === 0) {
  console.log("[build-tests] aucun test à construire");
  process.exit(0);
}

await build({
  entryPoints,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // Sans point devant : le runner de Node ignore les répertoires cachés.
  outdir: "test-build",
  external: ["@prisma/client", "fastify", "node:*"],
});

console.log(`[build-tests] ${entryPoints.length} fichier(s) de test construits`);
