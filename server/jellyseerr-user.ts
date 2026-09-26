/* ------------------------------------------------------------------ */
/*  Seer Plugin — Jellyseerr user lookup + auto-import                 */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { getOrCreateUserSettings, updateUserSettings } from "./db";

interface SeerConfig {
  seerrUrl: string;
  seerrApiKey: string;
}

/**
 * Jellyseerr refuse de créer le compte : par import (sa connexion à Jellyfin
 * ne liste plus les comptes) ET en compte local (il exige alors ses
 * notifications e-mail). Le code dit à la page quoi conseiller.
 */
export class SeerrAccountError extends Error {
  constructor(message: string, readonly code: "import-and-local-refused" | "local-needs-email") {
    super(message);
  }
}

export interface JellyseerrUser {
  id: number;
  email?: string;
  username?: string;
  displayName?: string;
  jellyfinUserId?: string;
  jellyfinUsername?: string;
  userType?: number;
  requestCount?: number;
}

/*
 * Le lien gardé en base était rendu tel quel, sans vérification : un compte
 * supprimé dans Jellyseerr faisait échouer chaque demande de son titulaire
 * (au nom d'un compte disparu) jusqu'à la synchro suivante. On le vérifie
 * désormais, et on garde la réponse dix minutes pour ne pas interroger
 * Jellyseerr à chaque demande.
 */
const LINK_CHECK_TTL_MS = 10 * 60_000;
const checkedLinks = new Map<number, number>();

/** Oublie les vérifications en mémoire : une synchro à la main repart du réel. */
export function forgetSeerrUserChecks(): void {
  checkedLinks.clear();
}

/** Le compte Jellyseerr existe-t-il encore ? `null` : Jellyseerr n'a pas su le dire. */
async function seerrUserExists(config: SeerConfig, id: number): Promise<boolean | null> {
  const until = checkedLinks.get(id);
  if (until && until > Date.now()) return true;
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/user/${id}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return false;
    if (!res.ok) return null;
    checkedLinks.set(id, Date.now() + LINK_CHECK_TTL_MS);
    return true;
  } catch {
    return null;
  }
}

/**
 * Résout l'ID Jellyseerr correspondant à un user Jellyfin :
 *  1) cache local (seer_user_settings.jellyseerr_user_id)
 *  2) lookup live par jellyfinUserId (user Jellyseerr déjà importé)
 *  3) réconciliation par username : si un user Jellyseerr "placeholder" existe
 *     avec le même username et SANS jellyfinUserId, on l'ATTACHE au user Jellyfin
 *     courant (PATCH /api/v1/user/{id}). Ça permet de récupérer l'historique
 *     d'un user dont le compte Jellyfin avait été supprimé puis recréé.
 *  4) import : POST /api/v1/user/import-from-jellyfin
 * Throw si rien ne marche — le worker retombera sur retry_pending.
 */
export async function resolveJellyseerrUserId(
  config: SeerConfig,
  prisma: PrismaClient,
  jellyfinUserId: string,
  username: string,
): Promise<number> {
  const settings = await getOrCreateUserSettings(prisma, jellyfinUserId, username);
  if (settings.jellyseerrUserId) {
    // Jellyseerr muet : on garde le lien, la demande échouera ou passera d'elle-même.
    if ((await seerrUserExists(config, settings.jellyseerrUserId)) !== false) return settings.jellyseerrUserId;
    await updateUserSettings(prisma, jellyfinUserId, { jellyseerrUserId: null, jellyseerrLastSync: null });
  }

  // Lookup live par jellyfinUserId
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: new Date(),
    });
    return found.id;
  }

  // Réconciliation par username : un placeholder orphelin ?
  if (username) {
    const placeholder = await findOrphanPlaceholderByUsername(config, username);
    if (placeholder) {
      await relinkJellyseerrUserToJellyfin(config, placeholder.id, jellyfinUserId);
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: placeholder.id,
        jellyseerrLastSync: new Date(),
      });
      return placeholder.id;
    }
  }

  // Import depuis Jellyfin (suppose que le user Jellyfin existe encore)
  let importError: string | null = null;
  try {
    const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
    if (imported) {
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: imported.id,
        jellyseerrLastSync: new Date(),
      });
      return imported.id;
    }
  } catch (err) {
    importError = err instanceof Error ? err.message : String(err);
  }

  // Dernier essai après import : Jellyseerr peut avoir importé sans renvoyer l'objet
  const refreshed = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (refreshed) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: refreshed.id,
      jellyseerrLastSync: new Date(),
    });
    return refreshed.id;
  }

  /*
   * Jellyseerr refuse l'import : sa propre connexion à Jellyfin ne sait plus
   * lister les comptes (erreur 500 au message vide, constatée le 26 sept.
   * 2026 — et alors AUCUN compte ne s'importe). Un compte Jellyseerr local, au
   * nom du compte Jellyfin, garde les demandes possibles : elles partent sous
   * ce nom. Il se crée comme les fantômes des comptes supprimés, et la
   * synchro le reconnaît comme le sien.
   */
  try {
    const local = await createPlaceholderJellyseerrUser(config, username || jellyfinUserId);
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: local.id,
      jellyseerrLastSync: new Date(),
    });
    console.warn(`[SeerUsers] Import refusé par Jellyseerr (${importError ?? "sans réponse"}) : compte local #${local.id} pour ${username}`);
    return local.id;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new SeerrAccountError(
      `Jellyseerr refuse d'importer ce compte depuis Jellyfin${importError ? ` (${importError})` : ""}, `
      + `et n'a pas voulu créer de compte local (${why}). Vérifiez la connexion de Jellyseerr à Jellyfin `
      + `(Jellyseerr → Paramètres → Jellyfin).`,
      /Email notifications must be enabled/i.test(why) ? "local-needs-email" : "import-and-local-refused",
    );
  }
}

/** Cherche un user Jellyseerr local ("placeholder") par username, sans jellyfinUserId attaché. */
async function findOrphanPlaceholderByUsername(
  config: SeerConfig,
  username: string,
): Promise<JellyseerrUser | null> {
  const all = await listAllJellyseerrUsers(config);
  const target = username.trim().toLowerCase();
  return all.find((u) =>
    !u.jellyfinUserId &&
    (
      (u.username && u.username.trim().toLowerCase() === target) ||
      (u.jellyfinUsername && u.jellyfinUsername.trim().toLowerCase() === target)
    ),
  ) ?? null;
}

/** Crée un user "placeholder" Jellyseerr de type local (sans lien Jellyfin), pour préserver
 *  l'historique d'un demandeur dont le compte Jellyfin a été supprimé. Si un user du même
 *  username existe déjà, on le réutilise. */
export async function createPlaceholderJellyseerrUser(
  config: SeerConfig,
  username: string,
): Promise<JellyseerrUser> {
  const existing = await findOrphanPlaceholderByUsername(config, username);
  if (existing) return existing;

  const email = `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, "")}@tentacle.local`;
  const res = await fetch(`${config.seerrUrl}/api/v1/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ email, username }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr POST /user failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JellyseerrUser;
}

/**
 * Vérifie quels jellyseerr_user_id en cache local pointent encore vers un user
 * réellement existant dans Jellyseerr. Met à NULL les caches stale.
 * Retourne le nombre d'invalidations effectuées.
 */
export async function invalidateStaleJellyseerrCache(
  config: SeerConfig,
  prisma: PrismaClient,
): Promise<number> {
  const seerUsers = await listAllJellyseerrUsers(config);
  const validIds = new Set(seerUsers.map((u) => u.id));

  const rows = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string; jellyseerr_user_id: number }>>(
    `SELECT jellyfin_user_id, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`,
  );

  let invalidated = 0;
  for (const row of rows) {
    if (!validIds.has(row.jellyseerr_user_id)) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyfin_user_id = ?`,
        row.jellyfin_user_id,
      );
      invalidated++;
    }
  }
  return invalidated;
}

/** Attache un jellyfinUserId à un user Jellyseerr existant via PATCH /api/v1/user/{id}. */
export async function relinkJellyseerrUserToJellyfin(
  config: SeerConfig,
  jellyseerrUserId: number,
  jellyfinUserId: string,
): Promise<void> {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${jellyseerrUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /user/${jellyseerrUserId} failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function findJellyseerrUserByJellyfinId(
  config: SeerConfig,
  jellyfinUserId: string,
): Promise<JellyseerrUser | null> {
  const all = await listAllJellyseerrUsers(config);
  const normalized = (id: string | undefined) => (id || "").toLowerCase().replace(/-/g, "");
  const target = normalized(jellyfinUserId);
  return all.find((u) => normalized(u.jellyfinUserId) === target) ?? null;
}

export async function listAllJellyseerrUsers(config: SeerConfig): Promise<JellyseerrUser[]> {
  const out: JellyseerrUser[] = [];
  let skip = 0;
  const take = 100;
  // Paginer (max 10 pages = 1000 users — suffisant)
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${config.seerrUrl}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Jellyseerr GET /user failed: ${res.status}`);
    }
    const data = (await res.json()) as { pageInfo?: { results?: number; pages?: number }; results?: JellyseerrUser[] };
    const page = data.results ?? [];
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}

/**
 * Supprime un compte Jellyseerr. Jellyseerr efface avec lui SES demandes :
 * l'appelant ne le propose qu'à un administrateur prévenu.
 */
export async function deleteJellyseerrUser(config: SeerConfig, id: number): Promise<void> {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${id}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr DELETE /user/${id} a répondu ${res.status}: ${text.slice(0, 200)}`);
  }
  checkedLinks.delete(id);
}

async function importJellyseerrUserFromJellyfin(
  config: SeerConfig,
  jellyfinUserId: string,
): Promise<JellyseerrUser | null> {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/import-from-jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserIds: [jellyfinUserId] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr import-from-jellyfin failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as JellyseerrUser[] | JellyseerrUser;
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (!Array.isArray(data) && data && typeof data === "object") return data;
  return null;
}
