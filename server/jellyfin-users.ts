/* ------------------------------------------------------------------ */
/*  Vigie — Les comptes Jellyfin, lus avec la clé du serveur Tentacle   */
/* ------------------------------------------------------------------ */

/*
 * La synchro lisait `JELLYFIN_URL` et `JELLYFIN_ADMIN_API_KEY` dans
 * l'environnement. Le serveur Tentacle ne les fournit plus depuis longtemps :
 * l'assistant d'installation range l'adresse et la clé dans sa table
 * `server_config`. Sur une installation récente, la liste des comptes Jellyfin
 * échouait donc en silence, et la synchro ne voyait que les comptes déjà
 * connus de Jellyseerr — jamais un compte supprimé, jamais un nouveau venu.
 *
 * On lit la table du serveur (la même base, le même client Prisma), et
 * l'environnement ne sert plus que de repli pour les très vieux serveurs.
 */

import type { PrismaClient } from "@prisma/client";
import { cached, invalidate } from "./cache";

export interface JellyfinAccount {
  /** Identifiant Jellyfin tel que Jellyfin le rend (32 hexadécimaux). */
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  /** Étiquette de l'avatar : `null` quand le compte n'en a pas. */
  imageTag: string | null;
  lastActivityDate: string | null;
}

interface JellyfinUserDto {
  Id: string;
  Name: string;
  PrimaryImageTag?: string | null;
  LastActivityDate?: string | null;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
}

const ACCOUNTS_KEY = "seer:jellyfin:accounts";
/* La page d'administration relit la liste à chaque ouverture et chaque synchro :
 * une demi-minute évite de solliciter Jellyfin deux fois pour le même geste. */
const ACCOUNTS_TTL_MS = 30_000;

/** Même identifiant, quelle que soit la graphie (tirets, casse). */
export function normalizeJellyfinId(id: string | null | undefined): string {
  return (id ?? "").toLowerCase().replace(/-/g, "");
}

export async function jellyfinCredentials(prisma: PrismaClient): Promise<{ url: string; apiKey: string } | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ k: string; v: string }>>(
      "SELECT `key` AS k, `value` AS v FROM server_config WHERE `key` IN ('jellyfin_url', 'jellyfin_api_key')",
    );
    const url = rows.find((r) => r.k === "jellyfin_url")?.v ?? "";
    const apiKey = rows.find((r) => r.k === "jellyfin_api_key")?.v ?? "";
    if (url && apiKey) return { url: url.replace(/\/$/, ""), apiKey };
  } catch {
    /* Table absente (serveur très ancien) : on tente l'environnement. */
  }
  const url = (process.env.JELLYFIN_URL || "").replace(/\/$/, "");
  const apiKey = process.env.JELLYFIN_ADMIN_API_KEY || "";
  return url && apiKey ? { url, apiKey } : null;
}

/**
 * Tous les comptes Jellyfin, désactivés compris — la synchro doit les voir
 * pour dire qu'ils le sont. Lève quand Jellyfin est injoignable ou non
 * configuré : un échec ne doit JAMAIS se lire « plus aucun compte », sinon
 * la synchro retirerait tout le monde.
 */
export async function fetchJellyfinAccounts(prisma: PrismaClient): Promise<JellyfinAccount[]> {
  return cached(ACCOUNTS_KEY, ACCOUNTS_TTL_MS, async () => {
    const creds = await jellyfinCredentials(prisma);
    if (!creds) throw new Error("Jellyfin n'est pas configuré sur le serveur Tentacle");
    const res = await fetch(`${creds.url}/Users`, {
      headers: { "X-Emby-Token": creds.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Jellyfin GET /Users a répondu ${res.status}`);
    const data = (await res.json()) as JellyfinUserDto[];
    if (!Array.isArray(data)) throw new Error("Réponse inattendue de Jellyfin (GET /Users)");
    return data.map((u) => ({
      id: u.Id,
      name: u.Name,
      isAdmin: u.Policy?.IsAdministrator === true,
      isDisabled: u.Policy?.IsDisabled === true,
      imageTag: u.PrimaryImageTag ?? null,
      lastActivityDate: u.LastActivityDate ?? null,
    }));
  });
}

/** Oublie la liste en mémoire : une synchro demandée à la main relit Jellyfin. */
export function forgetJellyfinAccounts(): void {
  invalidate(ACCOUNTS_KEY);
}
