/* ------------------------------------------------------------------ */
/*  Vigie — Les avis déjà envoyés : une fois par cause et par titre     */
/* ------------------------------------------------------------------ */

/*
 * Un départ, un blocage par cause : UNE annonce par compte et par titre
 * (`seer_notices`), même si Sonarr réessaie, même si Vigie redémarre. Pas de
 * rafale : un import refusé trois fois de suite pour la même raison ne se
 * dit qu'une fois ; une AUTRE raison, elle, se dit.
 *
 * La mémoire d'un titre s'efface à son arrivée : une saison demandée plus
 * tard, bloquée pour la même raison, sera de nouveau annoncée.
 */

import type { VigieQueries } from "../storage/vigie-db";

export type NoticeKind = "departure" | "blocked";

export interface NoticeKey {
  jellyfinUserId: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  kind: NoticeKind;
  /** La cause d'un blocage ; vide pour un départ. */
  cause?: string;
}

/**
 * Réserve l'annonce : `true` si elle n'avait jamais été faite (la ligne est
 * posée), `false` si elle l'a déjà été. Une seule écriture — deux passes
 * concurrentes ne l'annoncent pas deux fois.
 */
export async function claimNotice(db: VigieQueries, key: NoticeKey, requestId: string, now: Date = new Date()): Promise<boolean> {
  const changed = await db.execute(
    `${db.sql.insertIgnore()} INTO seer_notices (jellyfin_user_id, media_type, tmdb_id, kind, cause, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    key.jellyfinUserId, key.mediaType, key.tmdbId, key.kind, key.cause ?? "", requestId, now,
  );
  return changed > 0;
}

/** Rend une réservation dont l'annonce n'a pas pu partir : elle repartira à la passe suivante. */
export async function releaseNotice(db: VigieQueries, key: NoticeKey): Promise<void> {
  await db.execute(
    `DELETE FROM seer_notices WHERE jellyfin_user_id = ? AND media_type = ? AND tmdb_id = ? AND kind = ? AND cause = ?`,
    key.jellyfinUserId, key.mediaType, key.tmdbId, key.kind, key.cause ?? "",
  );
}

/** Le titre est arrivé : sa mémoire d'avis s'efface. */
export async function forgetTitleNotices(
  db: VigieQueries, jellyfinUserId: string, mediaType: "movie" | "tv", tmdbId: number,
): Promise<void> {
  await db.execute(
    `DELETE FROM seer_notices WHERE jellyfin_user_id = ? AND media_type = ? AND tmdb_id = ?`,
    jellyfinUserId, mediaType, tmdbId,
  );
}
