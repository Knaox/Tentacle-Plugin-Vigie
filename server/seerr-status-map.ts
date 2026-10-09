/* ------------------------------------------------------------------ */
/*  Vigie — Le statut d'une demande, d'après Jellyseerr                */
/* ------------------------------------------------------------------ */

/*
 * Extrait de worker-sync.ts (plus de trois cents lignes) : la traduction du
 * couple statut de demande / statut de média de Jellyseerr en statut de
 * Vigie, partagée par la synchro et par l'affichage (request-status.ts).
 */

import type { SeerRequest } from "./types";

/**
 * Mapping Jellyseerr → status local. L'état du MÉDIA Jellyseerr (source de
 * vérité, y compris posé manuellement via « Marquer comme ») prime.
 *
 * Jellyseerr media.status :
 *   1 = UNKNOWN, 2 = PENDING, 3 = PROCESSING, 4 = PARTIALLY_AVAILABLE,
 *   5 = AVAILABLE, 6 = BLOCKLISTED, 7 = DELETED
 * Jellyseerr request.status :
 *   1 = PENDING_APPROVAL, 2 = APPROVED, 3 = DECLINED, 4 = FAILED, 5 = COMPLETED
 */
export function mapSeerrStatus(
  requestStatus: number, mediaStatus?: number,
  // `status` optionnel : Jellyseerr ne garantit pas le champ sur tous les items
  // de la file *arr (un grab tout juste envoyé peut arriver sans).
  downloadStatus?: Array<{ status?: string }>,
): SeerRequest["status"] {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";

  // Disponible / partiellement disponible AVANT les échecs de téléchargement :
  // un état posé (par Jellyseerr ou manuellement par l'utilisateur) ne doit
  // jamais être re-écrasé en « échec » — et donc auto-retenté — sur la foi
  // d'un downloadStatus périmé.
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";

  // Média dégradé DELETED par l'availability-sync Jellyseerr (introuvable dans
  // Jellyfin et sans fichier *arr) : badge « Supprimé » côté Jellyseerr — on
  // affiche pareil, et surtout PAS « échec » (pas d'auto-retry destructif).
  if (mediaStatus === 7) return "deleted";

  // Média marqué « Demandée » (UNKNOWN) — posé à la main via « Marquer comme »
  // ou par Jellyseerr. État FINAL tant que rien ne bouge : un downloadStatus
  // périmé (warning/failed résiduel dans la file *arr) ne doit JAMAIS le
  // requalifier « échec », sinon l'auto-retry supprime la demande Jellyseerr
  // qu'on vient précisément de requalifier (bug « la demande se supprime »).
  if (mediaStatus === 1) return "unavailable";

  // PROCESSING = approuvé, en cours d'acquisition. Jellyseerr n'affiche « en
  // traitement » que si un download est réellement actif — sans download
  // actif, son badge est « Demandé », on mappe pareil.
  //
  // Un download qui COINCE (source morte, import refusé, client en pause…)
  // reste un download : il est BLOQUÉ, jamais en échec. Le classer « failed »
  // déclenchait l'auto-retry, qui supprimait la demande Jellyseerr pour la
  // recréer — tout le contraire de ce qu'attend un titre à qui il ne manque
  // qu'une source. Le signal « bloqué » voyage avec l'avancement (`stalled`,
  // cf. download-progress.ts), là où l'affichage le lit.
  if (mediaStatus === 3) {
    return downloadStatus && downloadStatus.length > 0 ? "downloading" : "unavailable";
  }
  if (requestStatus === 1) return "sent_to_seer";
  return "approved";
}
