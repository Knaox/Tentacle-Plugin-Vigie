/* ------------------------------------------------------------------ */
/*  Seer Plugin — Anti-doublon : claims de contenu (table CORE)        */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";

/**
 * Revendique un contenu dans la table CORE générique `content_claims` : tant
 * que le claim n'est pas expiré, le notifier d'ajouts biblio du core n'envoie
 * pas de push doublon pour ce (tmdbId/titre, user) — c'est Seer qui notifie la
 * dispo. TTL glissant (rafraîchi tant que la demande est active ; expire seul
 * quand elle devient disponible).
 */
export async function upsertContentClaim(
  db: VigieDb, tmdbId: number, jellyfinUserId: string,
  mediaType: string, title: string, ttlSeconds: number,
): Promise<void> {
  // Table du cœur, relue par Prisma : l'échéance en millisecondes entières.
  const expiresAt = db.sql.dateParam(new Date(Date.now() + ttlSeconds * 1000));
  await db.execute(
    db.sql.upsert({
      table: "content_claims",
      columns: ["tmdbId", "jellyfinUserId", "mediaType", "title", "expiresAt"],
      conflict: ["tmdbId", "jellyfinUserId"],
      update: ["mediaType", "title", "expiresAt"],
    }),
    tmdbId, jellyfinUserId, mediaType, title, expiresAt,
  );
}

/** Purge les revendications expirées (table CORE content_claims). */
export async function purgeExpiredContentClaims(db: VigieDb): Promise<void> {
  await db.execute(`DELETE FROM content_claims WHERE expiresAt < ${db.sql.now()}`);
}
