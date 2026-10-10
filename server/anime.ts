/* ------------------------------------------------------------------ */
/*  Seer Plugin — Anime detection & overrides via Jellyseerr API      */
/* ------------------------------------------------------------------ */

export interface MediaDetail {
  keywords: { id: number; name: string }[];
  mediaInfo?: {
    id?: number;
    status?: number;
    requests?: { id: number; status: number; createdAt?: string; seasons?: { seasonNumber: number }[] }[];
    /** Disponibilité par saison (status: 5 = disponible). Renvoyé par /api/v1/tv/{id}. */
    seasons?: { seasonNumber: number; status: number }[];
  };
}

export interface AnimeOverrides {
  profileId: number;
  rootFolder: string;
  tags: number[];
  languageProfileId: number;
}

let overridesCache: { data: AnimeOverrides | null; expires: number } | null = null;

/** Fetch media detail from Jellyseerr (keywords, existing requests) */
export async function fetchMediaDetail(
  seerrUrl: string,
  apiKey: string,
  mediaType: string,
  tmdbId: number,
): Promise<MediaDetail | null> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as MediaDetail;
  } catch {
    return null;
  }
}

/** Check if media keywords contain "anime" */
export function isAnimeFromKeywords(detail: MediaDetail): boolean {
  if (!detail.keywords || !Array.isArray(detail.keywords)) return false;
  return detail.keywords.some((k) => k.name?.toLowerCase().includes("anime"));
}

/** Fetch anime overrides from default Sonarr server config (cached 10 min) */
export async function fetchAnimeOverrides(
  seerrUrl: string,
  apiKey: string,
): Promise<AnimeOverrides | null> {
  if (overridesCache && Date.now() < overridesCache.expires) {
    return overridesCache.data;
  }

  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/sonarr`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      overridesCache = { data: null, expires: Date.now() + 600_000 };
      return null;
    }

    const servers = (await res.json()) as Record<string, unknown>[];
    const defaultServer = servers.find((s) => s.isDefault);

    if (!defaultServer?.activeAnimeProfileId) {
      overridesCache = { data: null, expires: Date.now() + 600_000 };
      return null;
    }

    const data: AnimeOverrides = {
      profileId: defaultServer.activeAnimeProfileId as number,
      rootFolder: defaultServer.activeAnimeDirectory as string,
      tags: (defaultServer.animeTags as number[]) || [],
      languageProfileId: defaultServer.activeAnimeLanguageProfileId as number,
    };

    overridesCache = { data, expires: Date.now() + 600_000 };
    return data;
  } catch {
    overridesCache = { data: null, expires: Date.now() + 600_000 };
    return null;
  }
}
