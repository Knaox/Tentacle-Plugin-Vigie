/* ------------------------------------------------------------------ */
/*  Vigie — Ce qu'un profil de qualité règle, en quelques mots          */
/* ------------------------------------------------------------------ */

import type { ArrServerInfo, ProfileTargetMedia, SeerProfile } from "../../../api/types";

export const TARGETS: readonly ProfileTargetMedia[] = ["all", "movie", "tv", "anime"];

/** Radarr sert les films ; Sonarr les séries et les animés. */
export const usesRadarr = (target: ProfileTargetMedia | undefined) => !target || target === "all" || target === "movie";
export const usesSonarr = (target: ProfileTargetMedia | undefined) => !target || target === "all" || target === "tv" || target === "anime";

export interface ArrChoice {
  /** Le serveur retenu (celui du profil, sinon celui par défaut) ; `null` : aucun. */
  server: ArrServerInfo | null;
  /** Nom de la qualité choisie ; `null` : celle par défaut du serveur. */
  quality: string | null;
  /** Dossier choisi ; `null` : celui par défaut. */
  folder: string | null;
}

export function arrChoice(servers: readonly ArrServerInfo[], serverId?: number, profileId?: number, folder?: string): ArrChoice {
  const server = servers.find((s) => s.id === serverId) ?? servers.find((s) => s.isDefault) ?? servers[0] ?? null;
  const quality = server?.profiles.find((p) => p.id === profileId)?.name ?? null;
  return { server, quality, folder: folder || null };
}

/** Les tags d'un profil, par leur nom quand Sonarr ou Radarr le connaissent. */
export function tagLabels(servers: readonly ArrServerInfo[], ids: readonly number[] | undefined): string[] {
  const known = new Map<number, string>();
  for (const s of servers) for (const tag of s.tags ?? []) known.set(tag.id, tag.label);
  return (ids ?? []).map((id) => known.get(id) ?? `#${id}`);
}

export function emptyProfile(): SeerProfile {
  return { id: crypto.randomUUID(), name: "", targetMediaType: "all", isDefault: false, tags: undefined };
}

/** Un seul profil par défaut : le choisir retire le drapeau des autres. */
export function withDefault(profiles: readonly SeerProfile[], id: string): SeerProfile[] {
  return profiles.map((p) => ({ ...p, isDefault: p.id === id }));
}

/** Remplace le profil de même identifiant, ou l'ajoute à la fin. */
export function upsertProfile(profiles: readonly SeerProfile[], profile: SeerProfile): SeerProfile[] {
  const at = profiles.findIndex((p) => p.id === profile.id);
  if (at < 0) return [...profiles, profile];
  return profiles.map((p, i) => (i === at ? profile : p));
}
