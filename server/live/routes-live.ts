/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le hub interroge pour rester à jour                  */
/* ------------------------------------------------------------------ */

/*
 *   GET /sync/state → { generation }
 *       Un nombre qui change dès que l'état d'un titre a pu changer : un
 *       titre supprimé de Jellyfin, une demande supprimée ou modifiée dans
 *       Jellyseerr. Le hub le relit toutes les dix secondes tant qu'il est
 *       affiché, et relit ses listes quand il bouge — rien d'autre ne
 *       circule tant que rien ne bouge. Lu en mémoire : aucune requête.
 *
 * Toute route de Vigie appelée met aussi la boucle en direct au rythme
 * rapide (markActivity, posé par index.ts).
 */

import type { FastifyInstance } from "fastify";
import { liveGeneration } from "./live-sync";

export function registerLiveRoutes(app: FastifyInstance): void {
  app.get("/sync/state", async () => ({ generation: liveGeneration() }));
}
