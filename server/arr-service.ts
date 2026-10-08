/* ------------------------------------------------------------------ */
/*  Seer Plugin — Sonarr/Radarr service (via Jellyseerr settings)     */
/* ------------------------------------------------------------------ */

export interface ArrServerConfig {
  hostname: string;
  port: number;
  apiKey: string;
  useSsl: boolean;
  baseUrl: string;
}

let sonarrCache: { data: ArrServerConfig | null; expires: number } | null = null;
let radarrCache: { data: ArrServerConfig | null; expires: number } | null = null;

/** Récupère la config du serveur Sonarr ou Radarr par défaut via Seerr */
export async function getArrServerConfig(
  seerrUrl: string,
  apiKey: string,
  type: "sonarr" | "radarr",
): Promise<ArrServerConfig | null> {
  const cache = type === "sonarr" ? sonarrCache : radarrCache;
  if (cache && Date.now() < cache.expires) return cache.data;

  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Échec, pas une absence : mémorisé court, sinon une panne au démarrage
      // masquait Sonarr dix minutes SANS qu'aucune source n'échoue — et le
      // calendrier maître pouvait se figer « complet » sans les épisodes.
      setCacheForType(type, null, FAIL_TTL_MS);
      return null;
    }

    const servers = (await res.json()) as Record<string, unknown>[];
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer) {
      // Vraie absence (réponse saine, aucun serveur par défaut) : cachable long.
      setCacheForType(type, null, OK_TTL_MS);
      return null;
    }

    const data: ArrServerConfig = {
      hostname: defaultServer.hostname as string,
      port: defaultServer.port as number,
      apiKey: defaultServer.apiKey as string,
      useSsl: !!defaultServer.useSsl,
      baseUrl: (defaultServer.baseUrl as string) || "",
    };

    setCacheForType(type, data, OK_TTL_MS);
    return data;
  } catch {
    setCacheForType(type, null, FAIL_TTL_MS);
    return null;
  }
}

/** Réponse saine (config ou vraie absence de serveur) : dix minutes. */
const OK_TTL_MS = 600_000;
/** Échec de récupération : trente secondes, le temps que ça revienne. */
const FAIL_TTL_MS = 30_000;

function setCacheForType(type: "sonarr" | "radarr", data: ArrServerConfig | null, ttlMs: number) {
  const entry = { data, expires: Date.now() + ttlMs };
  if (type === "sonarr") sonarrCache = entry;
  else radarrCache = entry;
}

export function buildArrUrl(server: ArrServerConfig): string {
  const protocol = server.useSsl ? "https" : "http";
  const base = server.baseUrl ? `/${server.baseUrl.replace(/^\/|\/$/g, "")}` : "";
  return `${protocol}://${server.hostname}:${server.port}${base}`;
}

/** Récupère l'ID externe Sonarr/Radarr d'un média via l'endpoint Seerr */
export async function getMediaExternalId(
  seerrUrl: string,
  apiKey: string,
  mediaType: string,
  tmdbId: number,
): Promise<{ externalServiceId: number; serviceId: number } | null> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      mediaInfo?: { externalServiceId?: number; serviceId?: number };
    };
    if (!data.mediaInfo?.externalServiceId) return null;
    return {
      externalServiceId: data.mediaInfo.externalServiceId,
      serviceId: data.mediaInfo.serviceId ?? 0,
    };
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────
 * Suppression « douce » : on ne retire JAMAIS la série/le film de *arr.
 * On désactive la surveillance (unmonitor) — toujours — et on supprime les
 * fichiers seulement sur demande. La série/le film reste dans Sonarr/Radarr.
 * ────────────────────────────────────────────────────────────────── */

async function arrFetch(
  server: ArrServerConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${buildArrUrl(server)}${path}`, {
    ...init,
    headers: { "X-Api-Key": server.apiKey, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
}

/** True si la saison est ciblée : `seasons` vide/absent = toutes les saisons. */
function isTargetedSeason(seasonNumber: number, seasons?: number[] | null): boolean {
  if (!seasons || seasons.length === 0) return true;
  return seasons.includes(seasonNumber);
}

/* ── Sonarr ──────────────────────────────────────────────────────── */

interface SonarrSeries {
  id: number;
  monitored: boolean;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  [k: string]: unknown;
}

/**
 * Désactive la surveillance des saisons ciblées (toutes si `seasons` vide).
 * Sonarr exige l'objet série complet en PUT : on récupère la série, on mute
 * uniquement `seasons[].monitored`, et on désactive `series.monitored` si plus
 * aucune saison n'est surveillée. Empêche tout re-téléchargement.
 */
export async function unmonitorSonarrSeasons(
  server: ArrServerConfig,
  seriesId: number,
  seasons?: number[] | null,
): Promise<boolean> {
  try {
    const getRes = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const series = (await getRes.json()) as SonarrSeries;

    for (const s of series.seasons ?? []) {
      if (isTargetedSeason(s.seasonNumber, seasons)) s.monitored = false;
    }
    if ((series.seasons ?? []).every((s) => !s.monitored)) series.monitored = false;

    const putRes = await arrFetch(server, `/api/v3/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(series),
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorSonarrSeasons #${seriesId} failed:`, err);
    return false;
  }
}

/** Supprime les fichiers d'épisodes des saisons ciblées (garde la série). */
export async function deleteSonarrSeasonFiles(
  server: ArrServerConfig,
  seriesId: number,
  seasons?: number[] | null,
): Promise<boolean> {
  try {
    const res = await arrFetch(server, `/api/v3/episodefile?seriesId=${seriesId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = (await res.json()) as Array<{ id: number; seasonNumber: number }>;
    const targets = files.filter((f) => isTargetedSeason(f.seasonNumber, seasons));
    if (targets.length === 0) return true;

    // Suppression en masse si possible, sinon une par une.
    const bulk = await arrFetch(server, `/api/v3/episodefile/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeFileIds: targets.map((f) => f.id) }),
    });
    if (bulk.ok) return true;

    let ok = true;
    for (const f of targets) {
      const del = await arrFetch(server, `/api/v3/episodefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteSonarrSeasonFiles #${seriesId} failed:`, err);
    return false;
  }
}

/** Annule les téléchargements en cours des saisons ciblées (file Sonarr). */
export async function cancelSonarrQueue(
  server: ArrServerConfig,
  seriesId: number,
  seasons?: number[] | null,
): Promise<void> {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeSeries=false`);
    if (!res.ok) return;
    const data = (await res.json()) as { records?: Array<{ id: number; seriesId?: number; seasonNumber?: number }> };
    const records = data.records ?? [];
    for (const r of records) {
      if (r.seriesId !== seriesId) continue;
      if (r.seasonNumber !== undefined && !isTargetedSeason(r.seasonNumber, seasons)) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE",
      }).catch(() => {});
    }
  } catch (err) {
    console.warn(`[ArrService] cancelSonarrQueue #${seriesId} failed:`, err);
  }
}

/* ── Radarr ──────────────────────────────────────────────────────── */

interface RadarrMovie {
  id: number;
  monitored: boolean;
  [k: string]: unknown;
}

/** Désactive la surveillance d'un film (garde le film dans Radarr). */
export async function unmonitorRadarrMovie(
  server: ArrServerConfig,
  movieId: number,
): Promise<boolean> {
  try {
    const getRes = await arrFetch(server, `/api/v3/movie/${movieId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const movie = (await getRes.json()) as RadarrMovie;
    movie.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/movie/${movieId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movie),
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorRadarrMovie #${movieId} failed:`, err);
    return false;
  }
}

/** Supprime le(s) fichier(s) d'un film (garde le film dans Radarr). */
export async function deleteRadarrMovieFile(
  server: ArrServerConfig,
  movieId: number,
): Promise<boolean> {
  try {
    const res = await arrFetch(server, `/api/v3/moviefile?movieId=${movieId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = (await res.json()) as Array<{ id: number }>;
    if (files.length === 0) return true;
    let ok = true;
    for (const f of files) {
      const del = await arrFetch(server, `/api/v3/moviefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteRadarrMovieFile #${movieId} failed:`, err);
    return false;
  }
}

/** Annule les téléchargements en cours d'un film (file Radarr). */
export async function cancelRadarrQueue(
  server: ArrServerConfig,
  movieId: number,
): Promise<void> {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeMovie=false`);
    if (!res.ok) return;
    const data = (await res.json()) as { records?: Array<{ id: number; movieId?: number }> };
    for (const r of data.records ?? []) {
      if (r.movieId !== movieId) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE",
      }).catch(() => {});
    }
  } catch (err) {
    console.warn(`[ArrService] cancelRadarrQueue #${movieId} failed:`, err);
  }
}

/**
 * Déclenche un job planifié Jellyseerr (POST /settings/jobs/{id}/run).
 * Utilisé après une suppression de fichiers pour relancer `availability-sync`,
 * qui réconcilie la disponibilité par saison avec Jellyfin + Sonarr/Radarr
 * (au lieu d'attendre l'exécution planifiée, parfois quotidienne).
 */
export async function triggerSeerrJob(
  seerrUrl: string,
  apiKey: string,
  jobId: string,
): Promise<void> {
  try {
    await fetch(`${seerrUrl}/api/v1/settings/jobs/${jobId}/run`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn(`[ArrService] triggerSeerrJob ${jobId} failed:`, err);
  }
}
