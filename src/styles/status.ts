import type React from "react";
import type { RequestStatus } from "../api/types";

/**
 * Styles de statut UNIFIÉS du plugin — source unique consommée par
 * RequestCard, RequestsStatsBar, MediaCard, MarkMenuSheet, HeroCarousel,
 * SeasonRow, NextEpisodeBanner, MovieRequestSection…
 *
 * Les couleurs vivent dans des variables `--seer-st-<slug>-{bg,fg,solid}`
 * définies PAR SCHÉMA (clair/sombre) dans host-theme-fallback.ts et injectées
 * par ensureHostTheme() — plus aucun `text-amber-300` codé en dur qui ignorait
 * le thème. `bg` est PRÉ-ALPHÉ (contrainte iframe : pas de modificateur `/NN`
 * sur une couleur en var()).
 */

export type SeerStatusKey = RequestStatus | "requested" | "pending" | "rating";

/* Slug CSS kebab-case UNIQUEMENT : dans une valeur arbitraire Tailwind,
 * un underscore serait réécrit en espace et casserait le var(). */
const SLUG: Record<SeerStatusKey, string> = {
  queued: "queued",
  processing: "processing",
  sent_to_seer: "processing",
  approved: "approved",
  downloading: "downloading",
  partially_available: "partial",
  available: "available",
  unavailable: "approved",
  retry_pending: "retry",
  failed: "failed",
  deleting: "deleting",
  delete_failed: "failed",
  deleted: "deleted",
  // Vocabulaire Jellyseerr (statuts numériques des médias) + note étoilée.
  requested: "requested",
  pending: "requested",
  rating: "rating",
};

export interface StatusStyle {
  /** Chip translucide : fond pré-alphé + texte accent du schéma. */
  chip: string;
  /** Texte accent seul. */
  text: string;
  /** Aplat plein (barres de progression, badges posés sur affiche). */
  solid: string;
}

function styleFor(slug: string): StatusStyle {
  return {
    chip: `bg-[var(--seer-st-${slug}-bg)] text-[var(--seer-st-${slug}-fg)]`,
    text: `text-[var(--seer-st-${slug}-fg)]`,
    solid: `bg-[var(--seer-st-${slug}-solid)]`,
  };
}

export const STATUS_STYLE: Record<SeerStatusKey, StatusStyle> = Object.fromEntries(
  (Object.keys(SLUG) as SeerStatusKey[]).map((key) => [key, styleFor(SLUG[key])]),
) as Record<SeerStatusKey, StatusStyle>;
