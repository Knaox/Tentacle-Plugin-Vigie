/** Statuts média Jellyseerr (mediaInfo.status et mediaInfo.seasons[].status). */
export const MEDIA_STATUS_DELETED = 7;

/**
 * Une saison compte « demandée » à partir de PENDING (2) — jamais quand
 * Jellyseerr la dit SUPPRIMÉE : ses données ont été retirées, elle est libre
 * et Jellyseerr la laisse redemander.
 */
export function isRequestedSeasonStatus(status: number | undefined): boolean {
  return status !== undefined && status >= 2 && status !== MEDIA_STATUS_DELETED;
}

/**
 * Ce qu'une affiche dit de son titre, en un mot — le statut Jellyseerr
 * ramené à ce que l'utilisateur veut savoir : puis-je le regarder, l'ai-je
 * déjà demandé ? `null` : rien à dire, le titre se demande.
 */
export type MediaState = "available" | "partial" | "processing" | "requested";

export function mediaStateOf(status: number | undefined): MediaState | null {
  switch (status) {
    case 2: return "requested";
    case 3: return "processing";
    case 4: return "partial";
    case 5: return "available";
    default: return null;
  }
}
