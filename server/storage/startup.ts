/* ------------------------------------------------------------------ */
/*  Vigie — Ouvrir la base au démarrage, ou ne rien démarrer           */
/* ------------------------------------------------------------------ */

import type { CorePrisma } from "./contract";
import { MIGRATIONS } from "./migrations";
import { createVigieDb, usableStorage, type VigieDb } from "./vigie-db";

/*
 * Vigie ne tourne que sur la base SQLite que Tentacle ≥ 1.25.0 prête
 * (`ctx.storage`). Sans elle — un serveur d'avant, ou un autre moteur —, rien
 * ne démarre : aucune route, aucun worker, aucune requête, et le journal dit
 * pourquoi. Avec elle, les migrations versionnées passent d'abord ; un échec
 * remonte, et Tentacle marque l'extension en échec au lieu de la lancer à moitié.
 */

export interface StorageHost {
  storage?: unknown;
  getPrisma?: () => unknown;
}

export async function openVigieDb(ctx: StorageHost): Promise<VigieDb | null> {
  if (!usableStorage(ctx.storage)) {
    console.error(
      "[SeerBackend] Pas de base SQLite prêtée par Tentacle (ctx.storage) : Vigie exige Tentacle 1.25.0 "
      + "ou plus récent. Rien n'est démarré, aucune donnée n'est touchée.",
    );
    return null;
  }
  const applied = await ctx.storage.migrate(MIGRATIONS);
  if (applied.length > 0) console.log(`[SeerDB] Migrations appliquées : ${applied.join(", ")}`);
  const core = (ctx.getPrisma?.() ?? null) as CorePrisma | null;
  if (!core) throw new Error("[SeerBackend] Client du cœur absent (getPrisma) : notifications impossibles");
  const db = createVigieDb(ctx.storage, core);
  const [{ cnt }] = await db.query<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM seer_requests");
  console.log(`[SeerDB] Base prête — ${cnt} demande(s)`);
  return db;
}
