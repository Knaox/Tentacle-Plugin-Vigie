/* ------------------------------------------------------------------ */
/*  Vigie — Ce que CHAQUE compte a fait d'un titre                     */
/* ------------------------------------------------------------------ */

/*
 * Une affiche de Vigie disait où en est un titre pour le serveur (demandé,
 * en route, disponible…), jamais ce que la personne devant l'écran en a
 * fait. Cinq marques, comme sur les plateformes de streaming :
 *
 *   - dans la bibliothèque : Jellyfin a le titre (fournisseur TMDB) ;
 *   - vu : `UserData.Played` — pour une série, Jellyfin ne le pose que
 *     quand TOUT ce qu'il a est vu ;
 *   - dans « Ma liste » : `UserData.Likes`, la liste de Tentacle ;
 *   - aimé : `IsFavorite` en bibliothèque, la table `user_likes` du serveur
 *     Tentacle hors bibliothèque (c'est ainsi que le cœur les range) ;
 *   - sa note : la table `user_ratings` (1..10, une demi-étoile par point).
 *
 * Les tables du serveur Tentacle se lisent en SQL brut, comme `server_config`
 * (cf. jellyfin-users.ts) : un serveur trop ancien qui ne les a pas rend
 * simplement moins de marques, jamais une erreur.
 *
 * La réponse est compacte — un quadruplet par titre marqué, rien pour les
 * autres : une bibliothèque de trois mille titres tient en quelques dizaines
 * de kilo-octets au lieu du mégaoctet que rend Jellyfin.
 */

import type { VigieDb } from "./storage/vigie-db";
import { cached } from "./cache";
import { jellyfinAuthHeaders } from "./jellyfin-auth";
import { jellyfinCredentials } from "./jellyfin-users";

export const MARK_LIBRARY = 1;
export const MARK_WATCHED = 2;
export const MARK_WATCHLIST = 4;
export const MARK_LIKED = 8;

/** `[type, tmdbId, marques, note]` — note 0 : aucune. */
export type MarkEntry = ["movie" | "tv", number, number, number];

export interface UserMarksResponse {
  items: MarkEntry[];
}

export interface LibraryItem {
  Type?: string;
  ProviderIds?: Record<string, string | undefined>;
  UserData?: { Played?: boolean; IsFavorite?: boolean; Likes?: boolean | null };
}

/** Le vocabulaire du cœur (« series ») ramené à celui de Vigie (« tv »). */
function vigieType(type: string | undefined): "movie" | "tv" | null {
  if (type === "Movie" || type === "movie") return "movie";
  if (type === "Series" || type === "series" || type === "tv") return "tv";
  return null;
}

/** Cherche la clé TMDB quelle que soit sa casse (« Tmdb », « tmdb »). */
function tmdbOf(ids: LibraryItem["ProviderIds"]): number | null {
  if (!ids) return null;
  for (const [key, value] of Object.entries(ids)) {
    if (key.toLowerCase() !== "tmdb" || !value) continue;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

/**
 * Assemble les marques. Deux versions d'un même film (4K et HD) se cumulent :
 * vu dans l'une, vu tout court.
 */
export function buildMarks(
  library: readonly LibraryItem[],
  likes: ReadonlyArray<{ mediaType: string; tmdbId: number }>,
  ratings: ReadonlyArray<{ mediaType: string; tmdbId: number; score: number }>,
): MarkEntry[] {
  const byKey = new Map<string, MarkEntry>();
  const entry = (type: "movie" | "tv", id: number): MarkEntry => {
    const key = `${type}:${id}`;
    let found = byKey.get(key);
    if (!found) {
      found = [type, id, 0, 0];
      byKey.set(key, found);
    }
    return found;
  };

  for (const item of library) {
    const type = vigieType(item.Type);
    const id = tmdbOf(item.ProviderIds);
    if (!type || id === null) continue;
    const e = entry(type, id);
    let bits = MARK_LIBRARY;
    if (item.UserData?.Played) bits |= MARK_WATCHED;
    if (item.UserData?.Likes === true) bits |= MARK_WATCHLIST;
    if (item.UserData?.IsFavorite) bits |= MARK_LIKED;
    e[2] |= bits;
  }
  for (const like of likes) {
    const type = vigieType(like.mediaType);
    if (type && like.tmdbId > 0) entry(type, like.tmdbId)[2] |= MARK_LIKED;
  }
  for (const rating of ratings) {
    const type = vigieType(rating.mediaType);
    const score = Math.round(rating.score);
    if (type && rating.tmdbId > 0 && score >= 1 && score <= 10) entry(type, rating.tmdbId)[3] = score;
  }
  return [...byKey.values()].filter((e) => e[2] !== 0 || e[3] !== 0);
}

/* Une minute : un « vu » posé ailleurs se voit au plus tard à l'ouverture suivante. */
const TTL_MS = 60_000;

async function fetchLibrary(db: VigieDb, userId: string): Promise<LibraryItem[]> {
  const creds = await jellyfinCredentials(db);
  if (!creds) return [];
  // Champs minimaux : ni images, ni synopsis — seulement l'identité TMDB et l'état.
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    Fields: "ProviderIds",
    HasTmdbId: "true",
    EnableImages: "false",
    EnableUserData: "true",
  });
  const res = await fetch(`${creds.url}/Users/${encodeURIComponent(userId)}/Items?${params}`, {
    headers: jellyfinAuthHeaders(creds.apiKey),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Users/{id}/Items a répondu ${res.status}`);
  const data = (await res.json()) as { Items?: LibraryItem[] };
  return Array.isArray(data.Items) ? data.Items : [];
}

/** Une table absente (serveur Tentacle d'avant les notes) rend une liste vide. */
async function readRows<T>(db: VigieDb, sql: string, userId: string): Promise<T[]> {
  try {
    return await db.query<T>(sql, userId);
  } catch {
    return [];
  }
}

export async function userMarks(db: VigieDb, userId: string): Promise<UserMarksResponse> {
  return cached(`vigie:marks:${userId}`, TTL_MS, async () => {
    const [library, likes, ratings] = await Promise.all([
      fetchLibrary(db, userId).catch(() => [] as LibraryItem[]),
      readRows<{ mediaType: string; tmdbId: number }>(
        db, "SELECT mediaType, tmdbId FROM user_likes WHERE jellyfinUserId = ?", userId,
      ),
      // La note d'un TITRE, pas d'un épisode ; une note en cours de retrait n'en est plus une.
      readRows<{ mediaType: string; tmdbId: number; score: number }>(
        db,
        "SELECT mediaType, tmdbId, score FROM user_ratings WHERE jellyfinUserId = ? AND deletedAt IS NULL AND seasonNumber = 0 AND episodeNumber = 0",
        userId,
      ),
    ]);
    // MySQL rend parfois les entiers en BigInt : on les ramène à des nombres.
    const num = (v: unknown) => Number(v);
    return {
      items: buildMarks(
        library,
        likes.map((l) => ({ mediaType: l.mediaType, tmdbId: num(l.tmdbId) })),
        ratings.map((r) => ({ mediaType: r.mediaType, tmdbId: num(r.tmdbId), score: num(r.score) })),
      ),
    };
  });
}
