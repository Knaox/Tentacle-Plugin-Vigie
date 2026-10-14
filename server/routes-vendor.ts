/* ------------------------------------------------------------------ */
/*  Vigie — Les bibliothèques chargées à la demande par la page        */
/* ------------------------------------------------------------------ */

/*
 * `GET /vendor/hls.js` : hls.js, pour l'aperçu de bande-annonce au survol
 * (src/preview/hlsLoader.ts). Il pèse ~540 Ko : hors du paquet de la page,
 * chargé dans chaque iframe, il n'est demandé qu'au PREMIER aperçu, et le
 * navigateur de l'hôte le garde (adresse versionnée `?v=`). Le fichier est
 * livré avec l'extension (`dist/vendor/`, copié par le build), lu une fois.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

export function registerVendorRoutes(app: FastifyInstance, pluginDir: string): void {
  let hls: Promise<string | null> | null = null;
  app.get("/vendor/hls.js", async (_request, reply) => {
    hls ??= readFile(join(pluginDir, "dist", "vendor", "hls.min.js"), "utf8").catch(() => null);
    const code = await hls;
    if (code === null) {
      hls = null;
      return reply.status(404).send({ message: "hls.js absent" });
    }
    return reply
      .header("Content-Type", "application/javascript; charset=utf-8")
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .send(code);
  });
}
