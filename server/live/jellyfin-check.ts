/* ------------------------------------------------------------------ */
/*  Vigie — Demander à Jellyfin si un titre parti l'est vraiment        */
/* ------------------------------------------------------------------ */

/*
 * La liste du serveur dit qu'un titre est parti ; pendant une mise à niveau
 * (Radarr remplace le fichier), l'ancien item part avant que le nouveau n'y
 * soit inscrit — le serveur attend ses métadonnées, jusqu'à dix minutes.
 * Avant de dire un titre « parti » tout juste après son départ, on le
 * demande donc à Jellyfin lui-même, titre par titre : la question ne porte
 * que sur ce qui vient de partir — quelques titres, de loin en loin.
 *
 * Par l'identifiant TMDB (`AnyProviderIdEquals`), filtré à la réception : un
 * Jellyfin qui ignorerait le filtre rend n'importe quoi, et la recherche se
 * rabat alors sur la liste des films et séries (une fois pour toute la passe).
 */

import type { VigieDb } from "../storage/vigie-db";
import { jellyfinAuthHeaders } from "../jellyfin-auth";
import { fetchJellyfinAccounts, jellyfinCredentials } from "../jellyfin-users";

export interface CheckTarget {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Séries : les saisons dont il faut savoir si elles sont encore là. */
  seasons?: readonly number[];
}

export interface CheckResult {
  present: boolean;
  /** Séries trouvées : les saisons qui ont au moins un épisode. */
  presentSeasons?: Set<number>;
}

interface Item {
  Id?: string;
  Type?: string;
  ParentIndexNumber?: number | null;
  ProviderIds?: Record<string, string | undefined>;
}

const LIMIT = 50;

function tmdbOf(ids: Item["ProviderIds"]): string | null {
  if (!ids) return null;
  for (const [key, value] of Object.entries(ids)) if (key.toLowerCase() === "tmdb" && value) return value;
  return null;
}

const typeOf = (t: CheckTarget) => (t.mediaType === "movie" ? "Movie" : "Series");

interface Session {
  base: string;
  headers: Record<string, string>;
  userId: string;
}

async function session(db: VigieDb): Promise<Session | null> {
  const creds = await jellyfinCredentials(db);
  if (!creds) return null;
  const accounts = await fetchJellyfinAccounts(db);
  const admin = accounts.find((a) => a.isAdmin && !a.isDisabled);
  if (!admin) return null;
  return { base: creds.url, headers: jellyfinAuthHeaders(creds.apiKey), userId: admin.id };
}

async function getItems(s: Session, query: string, timeoutMs: number): Promise<{ items: Item[]; total: number }> {
  const res = await fetch(`${s.base}/Users/${encodeURIComponent(s.userId)}/Items?${query}`, {
    headers: s.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Items ${res.status}`);
  const data = (await res.json()) as { Items?: Item[]; TotalRecordCount?: number };
  const items = Array.isArray(data.Items) ? data.Items : [];
  return { items, total: typeof data.TotalRecordCount === "number" ? data.TotalRecordCount : items.length };
}

/** L'item d'un titre par TMDB ; `undefined` : le filtre n'a pas été appliqué (réponse inexploitable). */
async function findByTmdb(s: Session, t: CheckTarget): Promise<Item | null | undefined> {
  const params = new URLSearchParams({
    Recursive: "true", IncludeItemTypes: typeOf(t), AnyProviderIdEquals: `Tmdb.${t.tmdbId}`,
    Fields: "ProviderIds", EnableImages: "false", EnableUserData: "false", Limit: String(LIMIT),
  });
  const { items, total } = await getItems(s, params.toString(), 8_000);
  const match = items.find((it) => tmdbOf(it.ProviderIds) === String(t.tmdbId));
  if (match) return match;
  // Filtré, la réponse ne porte que le titre cherché : vide ou sans lui, il n'y est pas.
  const filtered = items.every((it) => tmdbOf(it.ProviderIds) === String(t.tmdbId));
  return filtered && total <= LIMIT ? null : undefined;
}

/** Repli : tous les films et séries identifiés, une fois pour toute la passe. */
async function wholeIndex(s: Session): Promise<Map<string, Item>> {
  const params = new URLSearchParams({
    Recursive: "true", IncludeItemTypes: "Movie,Series", HasTmdbId: "true",
    Fields: "ProviderIds", EnableImages: "false", EnableUserData: "false",
  });
  const { items } = await getItems(s, params.toString(), 30_000);
  const out = new Map<string, Item>();
  for (const it of items) {
    const tmdb = tmdbOf(it.ProviderIds);
    const type = it.Type === "Movie" ? "movie" : it.Type === "Series" ? "tv" : null;
    if (tmdb && type && !out.has(`${type}:${tmdb}`)) out.set(`${type}:${tmdb}`, it);
  }
  return out;
}

/** Les saisons d'une série qui ont au moins un épisode. */
async function seasonsOf(s: Session, seriesId: string): Promise<Set<number>> {
  const params = new URLSearchParams({
    userId: s.userId, Fields: "", EnableImages: "false", EnableUserData: "false",
  });
  const res = await fetch(`${s.base}/Shows/${encodeURIComponent(seriesId)}/Episodes?${params}`, {
    headers: s.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Shows/{id}/Episodes ${res.status}`);
  const data = (await res.json()) as { Items?: Item[] };
  const out = new Set<number>();
  for (const ep of data.Items ?? []) if (typeof ep.ParentIndexNumber === "number") out.add(ep.ParentIndexNumber);
  return out;
}

/**
 * Ce que Jellyfin a de chaque titre. Une réponse `null` pour un titre : on
 * n'a pas pu le savoir (Jellyfin muet) — ne rien conclure.
 */
export async function checkInJellyfin(db: VigieDb, targets: readonly CheckTarget[]): Promise<Map<string, CheckResult | null>> {
  const out = new Map<string, CheckResult | null>();
  const keyOf = (t: CheckTarget) => `${t.mediaType}:${t.tmdbId}`;
  let s: Session | null = null;
  try {
    s = await session(db);
  } catch {
    s = null;
  }
  if (!s) {
    for (const t of targets) out.set(keyOf(t), null);
    return out;
  }
  let index: Map<string, Item> | null = null;
  for (const t of targets) {
    try {
      let item = await findByTmdb(s, t);
      if (item === undefined) {
        index ??= await wholeIndex(s);
        item = index.get(keyOf(t)) ?? null;
      }
      if (!item?.Id) {
        out.set(keyOf(t), { present: false, presentSeasons: t.mediaType === "tv" ? new Set() : undefined });
        continue;
      }
      if (t.mediaType === "tv" && t.seasons && t.seasons.length > 0) {
        out.set(keyOf(t), { present: true, presentSeasons: await seasonsOf(s, item.Id) });
      } else {
        out.set(keyOf(t), { present: true });
      }
    } catch {
      out.set(keyOf(t), null);
    }
  }
  return out;
}
