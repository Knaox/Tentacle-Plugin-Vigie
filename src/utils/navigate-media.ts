import { tentacleApiFetch, tentacleNavigate } from "./tentacle-fetch";

export interface ResolveResult {
  jellyfinId: string | null;
  /** RemoteTrailers Jellyfin de l'item résolu (backend ≥ 1.9.3, sinon absent). */
  remoteTrailers?: { Url?: string; Name?: string }[];
}

/** Le lien que Jellyseerr garde vers l'élément Jellyfin d'un titre disponible. */
export interface LibraryLink {
  jellyfinMediaId?: string | null;
  jellyfinMediaId4k?: string | null;
}

/**
 * Au-delà, la résolution est abandonnée. Sur les versions de Jellyfin où le
 * filtre par identifiant TMDB n'agit pas, le serveur parcourt TOUTE la
 * bibliothèque avant de répondre (jusqu'à quinze secondes).
 */
const RESOLVE_TIMEOUT_MS = 12_000;
/** Une résolution réussie sert à nouveau pendant ce temps (fiche → bouton). */
const RESOLVE_TTL_MS = 5 * 60_000;

const resolved = new Map<string, { at: number; result: Promise<ResolveResult | null> }>();

/**
 * Résout un TMDB ID vers l'item Jellyfin correspondant (null si absent).
 * La fiche d'un titre disponible le demande déjà pour ses bandes-annonces :
 * le bouton « Regarder » reprend cette réponse au lieu de tout refaire.
 */
export function resolveTmdbMedia(tmdbId: number, mediaType: string): Promise<ResolveResult | null> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = resolved.get(key);
  if (hit && Date.now() - hit.at < RESOLVE_TTL_MS) return hit.result;
  const result = tentacleApiFetch<ResolveResult>(
    `/api/tmdb/resolve?tmdbId=${tmdbId}&mediaType=${mediaType}`,
    { timeoutMs: RESOLVE_TIMEOUT_MS },
  ).then((res) => {
    // Un échec ne se garde pas : le prochain essai redemande.
    if (!res?.jellyfinId) resolved.delete(key);
    return res;
  });
  resolved.set(key, { at: Date.now(), result });
  return result;
}

/** Un identifiant d'élément Jellyfin : 32 chiffres hexadécimaux, tirets permis. */
const JELLYFIN_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * L'élément Jellyfin que Jellyseerr associe au titre — c'est ce même lien qui
 * lui fait dire « Disponible ». Rien s'il n'en a pas (Overseerr, titre
 * absent) ou si la valeur n'a pas la forme d'un identifiant.
 */
export function libraryIdOf(info: LibraryLink | null | undefined): string | null {
  for (const id of [info?.jellyfinMediaId, info?.jellyfinMediaId4k]) {
    if (typeof id === "string" && JELLYFIN_ID.test(id)) return id;
  }
  return null;
}

/**
 * Ouvre la fiche Tentacle d'un titre disponible. L'élément que Jellyseerr
 * connaît déjà s'ouvre sur-le-champ ; sinon le serveur Tentacle le cherche
 * par son identifiant TMDB. Faux quand rien n'a été trouvé : l'appelant le
 * dit, au lieu d'un bouton qui ne fait rien.
 */
export async function navigateToMedia(tmdbId: number, mediaType: string, knownId?: string | null): Promise<boolean> {
  const id = knownId ?? (await resolveTmdbMedia(tmdbId, mediaType))?.jellyfinId ?? null;
  if (!id) return false;
  tentacleNavigate(`/media/${id}`);
  return true;
}
