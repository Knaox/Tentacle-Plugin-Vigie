/* ------------------------------------------------------------------ */
/*  Vigie — types d'administration                                     */
/* ------------------------------------------------------------------ */

/* Extraits de types.ts pour tenir sous 300 lignes. Ré-exportés depuis
 * ./types pour ne rien casser côté appelants. */

/** Lien d'un compte avec Jellyseerr : relié, sans compte, ou relié à un compte supprimé. */
export type SeerLinkState = "linked" | "unlinked" | "stale";

export interface SeerrAccountRef {
  id: number;
  name: string;
  requestCount: number | null;
}

export interface AdminUserRow {
  jellyfinUserId: string;
  username: string;
  blocked: boolean;
  /** `null` : le plafond par défaut ; `-1` : illimité ; sinon le plafond du compte. */
  dailyLimit: number | null;
  allowMovies: boolean;
  allowTv: boolean;
  allowAnime: boolean;
  jellyseerrUserId: number | null;
  jellyseerrLastSync: string | null;
  createdAt: string;
  updatedAt: string;
  requestsToday: number;
  requestsTotal: number;
  activeRequests: number;
  /** `null` : Jellyfin injoignable. */
  jellyfin: {
    isAdmin: boolean;
    isDisabled: boolean;
    imageTag: string | null;
    lastActivityDate: string | null;
  } | null;
  link: SeerLinkState;
  seerr: SeerrAccountRef | null;
}

export interface UpdateAdminUserBody {
  blocked?: boolean;
  dailyLimit?: number | null;
  allowMovies?: boolean;
  allowTv?: boolean;
  allowAnime?: boolean;
  /** Nom à donner à la ligne si elle n'existe pas encore. */
  username?: string;
}

/** Le compte rendu d'une passe de synchro (automatique ou demandée). */
export interface UserSyncReport {
  at: string;
  trigger: "auto" | "manual";
  durationMs: number;
  jellyfinError: string | null;
  seerrError: string | null;
  created: string[];
  renamed: Array<{ from: string; to: string }>;
  linked: string[];
  unlinked: string[];
  removed: string[];
  imported: string[];
  failures: Array<{ username: string; reason: string }>;
}

export interface UsersOverview {
  users: AdminUserRow[];
  sync: {
    last: UserSyncReport | null;
    running: boolean;
    autoEveryMinutes: number;
    pending: number;
    jellyfinError: string | null;
    seerrError: string | null;
  };
  attention: {
    gone: Array<{ jellyfinUserId: string; username: string; activeRequests: number; seerr: SeerrAccountRef | null }>;
    orphanSeerr: Array<SeerrAccountRef & { email: string | null; placeholder: boolean }>;
    missingSeerr: Array<{ jellyfinUserId: string; username: string }>;
  };
  defaults: { dailyLimit: number | null };
}

/** Erreur métier renvoyée par le backend (clé i18n + paramètres) */
export interface SeerBackendError {
  message?: string;
  errorKey?: string;
  limit?: number;
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

export interface QualityOption {
  id: number;
  name: string;
}

export interface ArrTag {
  id: number;
  label: string;
}

export interface ArrServerInfo {
  id: number;
  name: string;
  isDefault: boolean;
  profiles: QualityOption[];
  rootFolders: { id: number; path: string }[];
  tags: ArrTag[];
}
