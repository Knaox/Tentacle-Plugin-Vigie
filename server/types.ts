/* ------------------------------------------------------------------ */
/*  Seer Plugin — Server-side types                                    */
/* ------------------------------------------------------------------ */

export type RequestStatus =
  | "queued"
  | "processing"
  | "sent_to_seer"
  | "approved"
  | "downloading"
  | "partially_available"
  | "available"
  /** Média marqué « non disponible » (UNKNOWN) côté Jellyseerr */
  | "unavailable"
  | "retry_pending"
  | "failed"
  | "deleting"
  | "delete_failed"
  | "deleted";

export interface SeerRequest {
  id: string;
  jellyfinUserId: string;
  username: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  year: string | null;
  seasons: number[] | null;
  /** Saisons déjà notifiées comme disponibles (delta anti-doublon) */
  notifiedSeasons: number[] | null;
  status: RequestStatus;
  seerrRequestId: number | null;
  seerrMediaId: number | null;
  seerrMediaStatus: number | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  completedAt: string | null;
  pendingCleanupId: string | null;
  profileId: string | null;
  isAnime: boolean;
}

export interface SeerUserSettings {
  jellyfinUserId: string;
  username: string;
  blocked: boolean;
  dailyLimit: number | null;
  allowMovies: boolean;
  allowTv: boolean;
  allowAnime: boolean;
  jellyseerrUserId: number | null;
  jellyseerrLastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRow extends SeerUserSettings {
  requestsToday: number;
  requestsTotal: number;
}

/**
 * Avancement réel d'un téléchargement, dérivé de `media.downloadStatus` que
 * Jellyseerr renvoie DÉJÀ dans la liste des demandes (alimenté par Sonarr /
 * Radarr). Le plugin recevait cette donnée et n'en lisait que la longueur du
 * tableau pour décider d'afficher « Téléchargement ».
 *
 * Tous les champs sont nullables : `DownloadingItem` n'est pas un contrat
 * stable côté Jellyseerr, et Sonarr laisse `size` à 0 tant qu'il cherche.
 */
export interface DownloadProgress {
  /** 0..100, ou null si la taille est inconnue (barre indéterminée). */
  percent: number | null;
  size: number | null;
  sizeLeft: number | null;
  etaSeconds: number | null;
  estimatedCompletionAt: string | null;
  /** Statut brut : downloading | queued | paused | delay | warning | failed… */
  status: string;
  /** Fichier complet, mais pas encore vérifié ni rangé dans la bibliothèque. */
  validating: boolean;
  /**
   * N'avance plus tout seul : source morte, import refusé, client en pause.
   * JAMAIS un échec — la demande reste un téléchargement, affiché « bloqué ».
   * Sur le résumé d'une demande : tout ce qui n'est pas arrivé est bloqué.
   */
  stalled?: boolean;
  /** Résumé d'une demande : combien de ses éléments sont bloqués. */
  stalledCount?: number;
  title: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

export interface UnifiedRequest {
  id: string;
  source: "local" | "seerr";
  jellyfinUserId: string;
  username: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  year: string | null;
  seasons: number[] | null;
  status: RequestStatus;
  seerrRequestId: number | null;
  seerrMediaId: number | null;
  seerrMediaStatus: number | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  completedAt: string | null;
  profileId: string | null;
  isAnime: boolean;
  /** Agrégat de tous les téléchargements actifs du média. null si aucun. */
  download?: DownloadProgress | null;
  /** Détail par épisode (séries), plafonné. Absent quand il n'y en a qu'un. */
  downloads?: DownloadProgress[];
}

export interface RequestsStats {
  total: number;
  byStatus: Record<string, number>;
  byType: { movie: number; tv: number };
}

export interface CreateRequestBody {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
  profileId?: string | null;
}

export type ProfileTargetMedia = "all" | "movie" | "tv" | "anime";

export interface SeerProfile {
  id: string;
  name: string;
  targetMediaType?: ProfileTargetMedia;
  radarrServerId?: number;
  radarrProfileId?: number;
  radarrRootFolder?: string;
  sonarrServerId?: number;
  sonarrProfileId?: number;
  sonarrRootFolder?: string;
  sonarrLanguageProfileId?: number;
  tags?: number[];
  isDefault?: boolean;
}

export interface ProxyPayload {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}
