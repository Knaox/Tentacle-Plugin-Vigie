/* ------------------------------------------------------------------ */
/*  Seer Plugin — Marquer, dans « Tout », ce qui a déjà été demandé    */
/* ------------------------------------------------------------------ */

/*
 * Le mode « Tout » sert le calendrier des sorties de la région, d'une source
 * entièrement distincte des demandes : une sortie déjà demandée y était donc
 * noyée parmi des centaines d'autres, sans rien pour la distinguer. Sur une
 * journée qui compte trente titres, retrouver les siens relevait de la chance.
 *
 * On croise donc les entrées avec les demandes connues. Toutes les demandes de
 * l'instance, pas seulement celles de l'appelant : cette vue est la même pour
 * tout le monde et son résultat est mis en cache une fois pour tous. La
 * distinguer par utilisateur reviendrait à multiplier ce cache par le nombre de
 * comptes, pour une nuance que la page n'affiche même pas.
 *
 * Une seule requête, sur la table locale — les fiches demandées y sont, et
 * l'identifiant TMDB est justement ce qu'elles ont en commun avec le
 * calendrier.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { CalendarItem } from "./calendar-types";
import { cached } from "./cache";

/**
 * Les identifiants demandés de l'instance, cachés une minute : le calendrier
 * global n'a plus de cache de réponse (le store maître le remplace), cette
 * requête partirait donc à CHAQUE tranche servie. La purge suit les demandes
 * via invalidateRequestCaches — la pastille reste immédiate.
 */
async function requestedIds(db: VigieDb): Promise<Set<string>> {
  return cached(
    "seer:requested:index",
    60_000,
    async () => {
      const rows = await db.query<{ media_type: string; tmdb_id: number }>(
        `SELECT DISTINCT media_type, tmdb_id FROM seer_requests WHERE tmdb_id > 0`,
      );
      return new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
    },
    { staleMs: 600_000 },
  );
}

export async function markRequested(
  db: VigieDb,
  items: CalendarItem[],
): Promise<void> {
  if (items.length === 0) return;

  try {
    const demandes = await requestedIds(db);
    if (demandes.size === 0) return;

    for (const item of items) {
      if (demandes.has(`${item.mediaType}:${item.tmdbId}`)) {
        /* Le statut exact n'est pas recherché : la vue n'affiche qu'une
         * pastille « Demandé », et aller le chercher coûterait une jointure
         * pour une nuance invisible. */
        item.requestStatus = item.requestStatus ?? "processing";
      }
    }
  } catch {
    // Un marquage manquant n'est pas une raison de ne pas rendre le calendrier.
  }
}
