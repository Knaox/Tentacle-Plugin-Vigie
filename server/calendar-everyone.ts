/* ------------------------------------------------------------------ */
/*  Seer Plugin — Les demandes de TOUT LE MONDE                        */
/* ------------------------------------------------------------------ */

/*
 * L'agenda ne savait montrer que les demandes de celui qui le consulte. Sur un
 * serveur partagé, la question « qu'est-ce qui arrive bientôt ici ? » n'avait
 * donc pas de réponse : chacun ne voyait que sa part.
 *
 * On assemble ici les mêmes lignes brutes que `buildMergedRows`, mais sans
 * filtre d'utilisateur — côté Jellyseerr comme côté table locale. Le résultat
 * se donne tel quel à `buildPersonalCalendar`, qui n'a pas eu à changer d'une
 * ligne : il consomme des lignes, pas une identité.
 *
 * Ce que cela expose est assumé : cette vue montre ce que les autres ont
 * demandé. Elle n'est pas réservée aux administrateurs — c'est un choix, et
 * l'interface le dit en toutes lettres.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerRequest } from "./types";
import type { MergedRows } from "./requests-list";
import type { SeerrRequestRow, WorkerCfg } from "./seerr-unified";
import { fetchAllSeerrRequests } from "./seerr-requests-fetch";
import { rowToRequest } from "./db-helpers";

/** Statuts locaux considérés comme « pas encore repris par Jellyseerr ». */
const LOCAL_PENDING_STATUSES = [
  "queued", "processing", "retry_pending", "failed", "deleting", "delete_failed",
];

/** L'agenda ne lit pas les statistiques : inutile de les calculer ici. */
const NO_STATS = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };

export async function buildEveryoneRows(
  db: VigieDb,
  cfg: WorkerCfg,
  log?: (err: unknown, msg: string) => void,
): Promise<MergedRows> {
  /* Demandes locales encore en attente — toutes, sans `jellyfin_user_id`. */
  const localPendingRows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN (${LOCAL_PENDING_STATUSES.map(() => "?").join(",")})
     ORDER BY created_at DESC, id ASC`,
    ...LOCAL_PENDING_STATUSES,
  );
  const localPending = localPendingRows.map(rowToRequest);

  const localBySeerrId = new Map<number, SeerRequest>();
  const allLocalRows = await db.query(
    `SELECT * FROM seer_requests WHERE seerr_request_id IS NOT NULL`,
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }

  /* `null` retire le filtre `requestedBy` : Jellyseerr renvoie alors les
   * demandes de tous les comptes. */
  let seerrRows: SeerrRequestRow[] = [];
  let seerrUnreachable = false;
  try {
    const all = await fetchAllSeerrRequests(cfg, null);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch (tous) failed, falling back to local only");
  }

  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId),
  );

  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds: new Set<number>(),
    stats: NO_STATS,
    fetchedAt: new Date().toISOString(),
    seerrUnreachable,
  };
}
