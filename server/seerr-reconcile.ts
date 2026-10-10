/* ------------------------------------------------------------------ */
/*  Seer Plugin — Réconciliation des demandes Jellyseerr (saisons)     */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";

interface SeerrMediaRequest {
  id: number;
  status: number; // 1=pending, 2=approved, 3=declined, 4=failed
  createdAt?: string;
  seasons?: Array<{ seasonNumber: number }>;
}

export interface ReconcileOptions {
  /** Une demande à laisser telle quelle (une redemande de ce qui est parti). */
  spare?: (r: { createdAt?: string; seasons: number[] }) => boolean;
  /**
   * Jellyseerr refuse de réduire la demande (validée, Seerr ≥ 3.5) : la
   * supprimer en entier — sinon la saison partie resterait « demandée » et
   * ne se redemanderait jamais. Sonarr garde les saisons encore attendues.
   */
  lockedGoesWhole?: boolean;
}

/**
 * Répercute une suppression de saisons sur les demandes Jellyseerr.
 *
 * Jellyseerr ne retire jamais une saison d'une demande existante : après une
 * suppression partielle (ex. garder S1, retirer S2), la demande continue de
 * lister S2 comme demandée — c'est le bug « la saison ne se supprime jamais
 * de Jellyseerr ». Les fichiers ayant été retirés/dé-surveillés côté *arr
 * (action globale au serveur), on aligne TOUTES les demandes couvrant une
 * saison retirée :
 *   - toutes ses saisons sont retirées → DELETE /request/{id}
 *   - sinon → PUT /request/{id} avec les saisons restantes
 *
 * Idempotent : au retry, une demande déjà réduite n'intersecte plus les
 * saisons retirées et est ignorée. Les lignes locales liées suivent (delete
 * ou réduction de la liste de saisons).
 */
export async function reconcileSeerrSeasons(
  db: VigieDb,
  config: { seerrUrl: string; seerrApiKey: string },
  tmdbId: number,
  removedSeasons: number[],
  options: ReconcileOptions = {},
): Promise<void> {
  if (removedSeasons.length === 0) return;
  const removed = new Set(removedSeasons);
  const headers = { "X-Api-Key": config.seerrApiKey };

  const res = await fetch(`${config.seerrUrl}/api/v1/tv/${tmdbId}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return; // média inconnu de Jellyseerr → rien à faire
  if (!res.ok) {
    throw new Error(`Jellyseerr GET /tv/${tmdbId} returned ${res.status}`);
  }
  const detail = (await res.json()) as {
    mediaInfo?: { requests?: SeerrMediaRequest[] };
  };

  for (const req of detail.mediaInfo?.requests ?? []) {
    const seasons = (req.seasons ?? [])
      .map((s) => s.seasonNumber)
      .filter((n) => typeof n === "number");
    if (seasons.length === 0) continue;
    const remaining = seasons.filter((n) => !removed.has(n));
    if (remaining.length === seasons.length) continue; // demande non concernée
    if (options.spare?.({ createdAt: req.createdAt, seasons })) continue;

    if (remaining.length === 0) {
      await deleteSeerrRequest(db, config, tmdbId, req.id, seasons);
    } else {
      const put = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: "tv", seasons: remaining }),
        signal: AbortSignal.timeout(10_000),
      });
      if (put.status === 409 && options.lockedGoesWhole) {
        console.log(
          `[SeerReconcile] tv#${tmdbId} : Jellyseerr ne modifie plus la demande #${req.id} (statut ${req.status}) — ` +
          `supprimée en entier pour que S${seasons.filter((n) => removed.has(n)).join(", S")} se redemande(nt)`,
        );
        await deleteSeerrRequest(db, config, tmdbId, req.id, seasons);
        continue;
      }
      await afterPut(db, tmdbId, req, seasons, remaining, put);
    }
  }
}

/** Supprime une demande Jellyseerr et ses lignes locales. */
async function deleteSeerrRequest(
  db: VigieDb,
  config: { seerrUrl: string; seerrApiKey: string },
  tmdbId: number,
  requestId: number,
  seasons: number[],
): Promise<void> {
  const del = await fetch(`${config.seerrUrl}/api/v1/request/${requestId}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!del.ok && del.status !== 404) {
    throw new Error(`Jellyseerr DELETE /request/${requestId} returned ${del.status}`);
  }
  await db.execute(`DELETE FROM seer_requests WHERE seerr_request_id = ?`, requestId);
  console.log(`[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${requestId} supprimée (S${seasons.join(", S")} retirées)`);
}

/** Ce qu'une réduction a donné : la ligne locale suit, un refus inattendu relance le job. */
async function afterPut(
  db: VigieDb,
  tmdbId: number,
  req: SeerrMediaRequest,
  seasons: number[],
  remaining: number[],
  put: Response,
): Promise<void> {
  if (put.status === 409) {
    // Seerr 3.5 ne modifie plus qu'une demande EN ATTENTE (seerr#3385) :
    // validée ou terminée, elle garde ses saisons. Terminée, elle ne bloque
    // rien (Seerr l'écarte des saisons « déjà demandées ») et la
    // disponibilité se resynchronise d'elle-même. Relancer le job n'y
    // changerait rien : la suppression locale va au bout.
    console.log(
      `[SeerReconcile] tv#${tmdbId} : Jellyseerr ne modifie plus la demande #${req.id} ` +
      `(statut ${req.status}) — S${seasons.join(", S")} y restent listées`,
    );
  } else if (!put.ok && put.status !== 404) {
    const text = await put.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /request/${req.id} returned ${put.status} ${text.slice(0, 200)}`);
  } else {
    console.log(`[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} réduite aux saisons S${remaining.join(", S")}`);
  }
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seasons = ? WHERE seerr_request_id = ?`,
    JSON.stringify(remaining),
    req.id,
  );
}
