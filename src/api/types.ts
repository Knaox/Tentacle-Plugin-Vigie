/* ------------------------------------------------------------------ */
/*  Seer API Types                                                     */
/* ------------------------------------------------------------------ */

export type MediaType = "movie" | "tv";
export type DiscoverMediaType = "movies" | "tv" | "anime";
/** Le type d'une grille du catalogue : « all » mêle films et séries (cf. mixCatalogs). */
export type BrowseType = DiscoverMediaType | "all";
export type SortOption = "popularity" | "vote_average" | "release_date" | "title";
export type SortOrder = "asc" | "desc";
export type TvStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface DiscoverFilters {
  genres: number[];
  watchProviders: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  originalLanguage: string | null;
  tvStatus: TvStatus[];
  /* Canaux de sortie retenus — salle, streaming, Blu-ray. Filtré CÔTÉ CLIENT :
   * Jellyseerr refuse tout paramètre de type de sortie (400 sur `releaseType`
   * comme sur `withReleaseType`), le verdict vient donc du serveur du plugin. */
  sortBy: SortOption;
  sortOrder: SortOrder;
}

export interface SeerrSearchResult {
  id: number;
  mediaType: MediaType | "person";
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  originalTitle?: string;
  originalName?: string;
  originalLanguage?: string;
  originCountry?: string[];
  genreIds?: number[];
  mediaInfo?: {
    status: number;
    requests?: SeerrMediaRequest[];
    /** Ce qui descend en ce moment, relayé de la file *arr par Jellyseerr. */
    downloadStatus?: Array<{ status?: string; size?: number; sizeLeft?: number }>;
  };
}

export interface SeerrPagedResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrSearchResult[];
  /** Nombre d'éléments masqués par le blocage par tags Jellyseerr (search/trending). */
  blockedCount?: number;
  /** True si un blocage par tags est configuré côté Jellyseerr. */
  blockedActive?: boolean;
}

export interface SeerrMediaRequest {
  id: number;
  status: number;
  media: {
    id: number;
    mediaType: MediaType;
    tmdbId: number;
    status: number;
  };
  createdAt: string;
  updatedAt: string;
  requestedBy?: {
    id: number;
    displayName: string;
  };
}

export interface SeerrRequestsResponse {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: SeerrMediaRequest[];
}

export interface SeerrCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath?: string;
}

export interface SeerrProductionCompany {
  id: number;
  name: string;
  logoPath?: string;
}

export interface SeerrMovieDetail {
  id: number;
  title: string;
  originalTitle?: string;
  tagline?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  runtime?: number;
  budget?: number;
  revenue?: number;
  status?: string;
  originalLanguage?: string;
  certification?: string;
  genres?: { id: number; name: string }[];
  productionCompanies?: SeerrProductionCompany[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  mediaInfo?: { status: number };
  credits?: {
    cast?: SeerrCastMember[];
    crew?: SeerrCrewMember[];
  };
}

export interface SeerrTvDetail {
  id: number;
  name: string;
  originalName?: string;
  tagline?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate?: string;
  voteAverage?: number;
  voteCount?: number;
  numberOfSeasons?: number;
  status?: string;
  originalLanguage?: string;
  certification?: string;
  /** Prochain épisode à diffuser (TMDB) — date de sortie à venir. */
  nextEpisodeToAir?: SeerrEpisode;
  /** Dernier épisode diffusé (TMDB). */
  lastEpisodeToAir?: SeerrEpisode;
  seasons?: SeerrSeason[];
  genres?: { id: number; name: string }[];
  productionCompanies?: SeerrProductionCompany[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  networks?: { id: number; name: string; logoPath?: string }[];
  createdBy?: { id: number; name: string; profilePath?: string }[];
  mediaInfo?: {
    status: number;
    seasons?: { id: number; seasonNumber: number; status: number }[];
    /** Demandes actives — Jellyseerr n'expose les saisons seulement demandées
     * (pas encore dispo) que via requests[].seasons, pas via seasons[]. */
    requests?: { id: number; status: number; seasons?: { seasonNumber: number }[] }[];
  };
  credits?: {
    cast?: SeerrCastMember[];
    crew?: SeerrCrewMember[];
  };
}

export interface SeerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
}

/** Épisode TMDB (via Seerr /tv/{id} ou /tv/{id}/season/{n}). */
export interface SeerrEpisode {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name?: string;
  overview?: string;
  airDate?: string;
  stillPath?: string;
  runtime?: number;
}

export interface SeerrCastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
  order: number;
}

/** Seerr request status: 1=pending, 2=approved, 3=declined */
export type SeerrRequestStatus = 1 | 2 | 3;

/* ── Local request types (from Tentacle backend) ─────────────────── */

export type RequestStatus =
  | "queued"
  | "processing"
  | "sent_to_seer"
  | "approved"
  | "downloading"
  | "partially_available"
  | "available"
  | "unavailable"
  | "retry_pending"
  | "failed"
  | "deleting"
  | "delete_failed"
  /** Média retiré côté Jellyseerr (availability-sync : introuvable partout) */
  | "deleted";

export interface LocalRequest {
  id: string;
  jellyfinUserId: string;
  username: string;
  mediaType: MediaType;
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
  pendingCleanupId?: string | null;
  profileId: string | null;
  isAnime?: boolean;
  /** "local" si la demande est encore en queue côté plugin Tentacle, "seerr" si elle vient de Jellyseerr (source de vérité) */
  source?: "local" | "seerr";
}

/* Types d'administration et de profils — extraits dans types-admin.ts pour
 * tenir sous 300 lignes, ré-exportés ici pour ne rien casser côté appelants. */
export type {
  AdminUserRow, UpdateAdminUserBody, SeerBackendError,
  ProfileTargetMedia, SeerProfile, QualityOption, ArrTag, ArrServerInfo,
} from "./types-admin";

export interface LocalRequestsResponse {
  results: LocalRequest[];
  total: number;
  page: number;
  pages: number;
  /** Statistiques calculées avec la liste — plus de requête séparée. */
  stats?: import("./types-releases").RequestsStats;
  /** > 0 : des fiches (titres, affiches) sont encore en cours de remplissage. */
  metaPending?: number;
}

export interface QueueStatus {
  processing: LocalRequest | null;
  queued: number;
  retryPending: number;
  deleting: number;
  workerRunning: boolean;
}

export type {
  SeerNotification, NotificationsResponse, UserStats, GlobalStats, StatsResponse,
} from "./types-stats";
