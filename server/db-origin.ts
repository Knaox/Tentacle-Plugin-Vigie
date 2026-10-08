/* ------------------------------------------------------------------ */
/*  Vigie — L'origine d'une demande, en base                            */
/* ------------------------------------------------------------------ */

/*
 * Deux colonnes de `seer_requests` (storage/schema.ts) : `origin` et
 * `platform`, vides pour tout ce qui ne dit pas d'où il part (cf.
 * titles/request-origin.ts).
 *
 * Écrites APRÈS la demande, au mieux : la demande part quoi qu'il arrive. Une
 * base qui aurait refusé les colonnes la laisse sans origine — elle ne paraît
 * alors dans aucune liste filtrée, rien de plus.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { RequestOrigin } from "./titles/request-origin";

let warned = false;

export async function recordRequestOrigin(db: VigieDb, id: string, origin: RequestOrigin): Promise<void> {
  try {
    await db.execute(
      `UPDATE seer_requests SET updated_at = ${db.sql.now()}, origin = ?, platform = ? WHERE id = ?`,
      origin.origin, origin.platform, id,
    );
  } catch (err) {
    // Une fois suffit : la même base refusera toutes les suivantes.
    if (!warned) console.warn("[SeerDB] Origine de la demande non gardée :", err);
    warned = true;
  }
}
