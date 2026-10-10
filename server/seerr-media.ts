/* ------------------------------------------------------------------ */
/*  Vigie — Le média d'un titre dans Jellyseerr : le lire, le remettre  */
/*  à zéro                                                              */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr garde, par titre, un « média » : sa disponibilité, ses saisons,
 * ses demandes, et l'identifiant du film ou de la série chez Radarr ou
 * Sonarr. Après une suppression, ce média peut mentir : tant que Jellyfin
 * garde une fiche Série vide (dossier resté), la revérification de Jellyseerr
 * passe les saisons « supprimées » mais laisse le titre « partiellement
 * disponible » (mesuré, Jellyseerr 3.5).
 *
 * Quand Vigie vient de supprimer la dernière demande d'un titre que Jellyfin
 * n'a plus du tout, il remet ce média à zéro (`DELETE /media/:id`, le
 * « Effacer les données » de Jellyseerr) : son scan suivant le recrée
 * « inconnu », demandable — jamais plus « en partie » (mesuré). Rien n'est
 * remis à zéro tant qu'une demande y reste ou que Jellyfin a encore le titre.
 */

import { goneFromJellyfin } from "./live/live-state";

export interface SeerrMediaRequest {
  id: number;
  status: number;
  is4k: boolean;
}

export interface SeerrMediaState {
  id: number;
  status: number;
  /** L'identifiant du film (Radarr) ou de la série (Sonarr), s'il y a été ajouté. */
  externalServiceId: number | null;
  serviceId: number | null;
  requests: SeerrMediaRequest[];
}

interface SeerrConn {
  seerrUrl: string;
  seerrApiKey: string;
}

/** Disponible, en partie, demandé, en cours : ce qu'un titre parti ne peut plus être. */
const CLAIMS_SOMETHING = new Set([2, 3, 4, 5]);

/** Le média d'un titre ; `null` : Jellyseerr n'en a pas (ou n'a pas répondu). */
export async function getSeerrMedia(
  cfg: SeerrConn,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<SeerrMediaState | null> {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      mediaInfo?: {
        id?: number; status?: number; externalServiceId?: number | null; serviceId?: number | null;
        requests?: Array<{ id?: number; status?: number; is4k?: boolean }>;
      };
    };
    const m = data.mediaInfo;
    if (!m || typeof m.id !== "number") return null;
    return {
      id: m.id,
      status: m.status ?? 1,
      externalServiceId: m.externalServiceId ?? null,
      serviceId: m.serviceId ?? null,
      requests: (m.requests ?? [])
        .filter((r) => typeof r.id === "number")
        .map((r) => ({ id: r.id as number, status: r.status ?? 0, is4k: r.is4k === true })),
    };
  } catch {
    return null;
  }
}

/**
 * Remet à zéro le média d'un titre que Jellyfin n'a plus et que plus aucune
 * demande ne vise. Rend vrai s'il l'a fait. Ne lève jamais : c'est un
 * rattrapage, la suppression de la demande est déjà faite.
 */
export async function resetGoneMedia(
  cfg: SeerrConn,
  mediaType: "movie" | "tv",
  tmdbId: number,
  title: string,
): Promise<boolean> {
  if (!goneFromJellyfin(mediaType, tmdbId)) return false;
  const media = await getSeerrMedia(cfg, mediaType, tmdbId);
  if (!media || media.requests.length > 0 || !CLAIMS_SOMETHING.has(media.status)) return false;
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/media/${media.id}`, {
      method: "DELETE",
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 404) return false;
    console.log(`[SeerWorker] « ${title} » n'est plus dans Jellyfin : son média Jellyseerr est remis à zéro (statut ${media.status} périmé)`);
    return true;
  } catch {
    return false;
  }
}
