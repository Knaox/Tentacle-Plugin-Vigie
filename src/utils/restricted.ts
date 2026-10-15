/* ------------------------------------------------------------------ */
/*  Vigie — Un titre que le profil ne peut pas voir                     */
/* ------------------------------------------------------------------ */

/*
 * Le serveur de Vigie applique le contrôle parental du cœur
 * (docs/CONTROLE-PARENTAL.md) : une fiche interdite répond 403
 * `restricted_title`, une demande refusée porte `seer:errRestrictedTitle`.
 * Le hub ne montre alors ni erreur ni trou : « Non disponible pour ce profil ».
 */

import { SeerrProxyError } from "../api/endpoints";
import { SeerBackendApiError } from "../api/seer-client";

/** Le code que le serveur donne à ce refus ; il traverse le réseau, il ne se renomme pas. */
export const RESTRICTED_TITLE_CODE = "restricted_title";

export function isRestrictedError(err: unknown): boolean {
  if (err instanceof SeerrProxyError) return err.code === RESTRICTED_TITLE_CODE;
  if (err instanceof SeerBackendApiError) return err.errorKey === "seer:errRestrictedTitle";
  return false;
}

/** Une fiche refusée au profil ne se redemande pas trois fois : la réponse ne changera pas. */
export function retryUnlessRestricted(failures: number, err: unknown): boolean {
  return !isRestrictedError(err) && failures < 3;
}
