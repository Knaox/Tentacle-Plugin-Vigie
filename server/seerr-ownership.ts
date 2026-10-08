/* ------------------------------------------------------------------ */
/*  Vigie — Propriétaires des demandes côté Jellyseerr (outils)         */
/* ------------------------------------------------------------------ */

/* Extrait de routes-users.ts pour tenir sous 300 lignes : les outils de la
 * réattribution des demandes, sans la route qui les enchaîne. */

import type { VigieDb } from "./storage/vigie-db";

/** Sélectionne le meilleur username Jellyfin pour un jellyfin_user_id donné.
 *  Préfère un username depuis seer_requests qui ne ressemble PAS à un UUID,
 *  fallback : la valeur la plus récente, fallback : `fallback`. */
export async function pickBestUsernameFor(
  db: VigieDb,
  jellyfinUserId: string,
  fallback: string,
): Promise<string> {
  const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
  const rows = await db.query<{ username: string }>(
    `SELECT username FROM seer_requests
     WHERE jellyfin_user_id = ? AND username IS NOT NULL AND username <> ''
     ORDER BY created_at DESC LIMIT 50`,
    jellyfinUserId,
  );
  for (const r of rows) {
    if (r.username && !isUuid.test(r.username) && r.username !== jellyfinUserId) {
      return r.username;
    }
  }
  // Aucun username valide en historique : essayer seer_user_settings
  const settings = await db.query<{ username: string }>(
    `SELECT username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
    jellyfinUserId,
  );
  if (settings[0]?.username && !isUuid.test(settings[0].username) && settings[0].username !== jellyfinUserId) {
    return settings[0].username;
  }
  // Fallback final : la valeur passée (peut être un UUID) ou rows[0] s'il existe
  return rows[0]?.username || fallback;
}

interface SeerrRequestPayload {
  id: number;
  status: number;
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
  languageProfileId?: number;
  tags?: number[];
  seasons?: Array<{ seasonNumber: number }>;
  requestedBy?: { id: number };
  media?: { id: number; tmdbId: number; mediaType: "movie" | "tv" };
}

/**
 * Réassigne le propriétaire d'une demande Jellyseerr.
 * - Tente d'abord PUT /api/v1/request/{id} avec userId: target
 * - Si Jellyseerr ne propage pas le changement, fallback DELETE + POST avec userId: target
 *   (le media reste, pas de re-téléchargement)
 * - Si la demande n'existe plus côté Jellyseerr (404) → recréation complète depuis les
 *   infos locales (mediaType, tmdbId, seasons) avec le bon userId.
 */
export async function reassignSeerrRequestOwnership(
  config: { seerrUrl: string; seerrApiKey: string },
  seerrRequestId: number,
  targetUserId: number,
  localMedia: { mediaType: "movie" | "tv"; tmdbId: number; seasons: number[] | null },
): Promise<{ method: "skip" | "put" | "recreate" | "create-missing"; newRequestId?: number }> {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };

  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });

  // Demande disparue côté Jellyseerr → on la recrée depuis les infos locales
  if (cur.status === 404) {
    if (!localMedia.tmdbId) throw new Error("missing local tmdbId for re-creation");
    const createBody: Record<string, unknown> = {
      mediaType: localMedia.mediaType,
      mediaId: localMedia.tmdbId,
      userId: targetUserId,
    };
    if (localMedia.seasons?.length) createBody.seasons = localMedia.seasons;

    const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST", headers, body: JSON.stringify(createBody),
      signal: AbortSignal.timeout(15_000),
    });
    // 202 : « No seasons available to request » — Seerr n'a RIEN créé.
    if (!postRes.ok || postRes.status === 202) {
      const text = await postRes.text().catch(() => "");
      throw new Error(`re-create missing failed (${postRes.status}): ${text.slice(0, 200)}`);
    }
    const created = (await postRes.json()) as { id: number };
    return { method: "create-missing", newRequestId: created.id };
  }

  if (!cur.ok) {
    throw new Error(`GET request ${seerrRequestId} failed: ${cur.status}`);
  }
  const req = (await cur.json()) as SeerrRequestPayload;
  if (req.requestedBy?.id === targetUserId) return { method: "skip" };

  // 1) Tentative PUT (préserve l'id de request)
  const putBody: Record<string, unknown> = {
    mediaType: req.media?.mediaType,
    userId: targetUserId,
  };
  if (req.serverId != null) putBody.serverId = req.serverId;
  if (req.profileId != null) putBody.profileId = req.profileId;
  if (req.rootFolder) putBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) putBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) putBody.tags = req.tags;

  const putRes = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "PUT", headers, body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(15_000),
  });
  if (putRes.ok) {
    const updated = (await putRes.json().catch(() => null)) as SeerrRequestPayload | null;
    if (updated?.requestedBy?.id === targetUserId) {
      return { method: "put" };
    }
  }
  // Seerr 3.5 ne modifie plus qu'une demande EN ATTENTE (seerr#3385). Le repli
  // ci-dessous la PERDRAIT : l'originale supprimée, Seerr refuse de redemander
  // les saisons d'une série déjà arrivée (202 « No seasons available »). Elle
  // reste donc à son auteur actuel.
  if (putRes.status === 409) {
    throw new Error("Jellyseerr ne change plus l'auteur d'une demande déjà validée — seulement celles en attente");
  }
  // Vérifié AVANT de supprimer : sans ces infos, rien ne pourrait la recréer.
  if (!req.media?.tmdbId || !req.media?.mediaType) {
    throw new Error("missing media info for recreate");
  }

  // 2) Fallback : supprimer la request (sans toucher au media), recréer avec userId
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE", headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
  const createBody: Record<string, unknown> = {
    mediaType: req.media.mediaType,
    mediaId: req.media.tmdbId,
    userId: targetUserId,
  };
  if (req.seasons?.length) createBody.seasons = req.seasons.map((s) => s.seasonNumber);
  if (req.serverId != null) createBody.serverId = req.serverId;
  if (req.profileId != null) createBody.profileId = req.profileId;
  if (req.rootFolder) createBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) createBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) createBody.tags = req.tags;

  const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
    method: "POST", headers, body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(15_000),
  });
  // 202 : « No seasons available to request » — Seerr n'a RIEN créé.
  if (!postRes.ok || postRes.status === 202) {
    const text = await postRes.text().catch(() => "");
    throw new Error(`recreate failed (${postRes.status}): ${text.slice(0, 200)}`);
  }
  const created = (await postRes.json()) as { id: number };
  return { method: "recreate", newRequestId: created.id };
}
