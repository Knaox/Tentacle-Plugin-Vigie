/* ------------------------------------------------------------------ */
/*  Vigie — L'origine d'une demande, en base                            */
/* ------------------------------------------------------------------ */

/*
 * Deux colonnes AJOUTÉES à `seer_requests` (`ensureTables`, comme les
 * précédentes) : `origin` et `platform`, vides pour tout ce qui ne dit pas
 * d'où il part (cf. titles/request-origin.ts). Rien n'est renommé ni supprimé.
 *
 * Écrites APRÈS la demande, au mieux : la demande part quoi qu'il arrive. Une
 * base qui aurait refusé les colonnes la laisse sans origine — elle ne paraît
 * alors dans aucune liste filtrée, rien de plus.
 */

import type { PrismaClient } from "@prisma/client";
import type { RequestOrigin } from "./titles/request-origin";

/** Les colonnes, telles que `ensureTables` les ajoute. */
export const ORIGIN_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["origin", "VARCHAR(16) DEFAULT NULL"],
  ["platform", "VARCHAR(24) DEFAULT NULL"],
];

let warned = false;

export async function recordRequestOrigin(prisma: PrismaClient, id: string, origin: RequestOrigin): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET origin = ?, platform = ? WHERE id = ?`,
      origin.origin, origin.platform, id,
    );
  } catch (err) {
    // Une fois suffit : la même base refusera toutes les suivantes.
    if (!warned) console.warn("[SeerDB] Origine de la demande non gardée :", err);
    warned = true;
  }
}
