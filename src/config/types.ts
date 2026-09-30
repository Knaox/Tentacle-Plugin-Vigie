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

export interface SeerConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  autoApprove: boolean;
  allowMaskedRequests?: boolean;
  userLimit: number;
  profiles?: SeerProfile[];
}

export interface SeerStatus {
  configured: boolean;
  connected: boolean;
  url?: string;
  error?: string;
}
