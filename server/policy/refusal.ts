/* ------------------------------------------------------------------ */
/*  Vigie — Le refus d'un titre que le profil ne peut pas voir           */
/* ------------------------------------------------------------------ */

/*
 * Un seul corps, partout : la demande (request-submit.ts, renvois), la fiche
 * relayée par le proxy. `code` est lu par les clients (le hub en tire ses
 * mots, « Non disponible pour ce profil ») ; `errorKey` suit la convention
 * des refus du hub (clé i18n `seer:…`). Ils traversent le réseau : ils ne se
 * renomment jamais.
 */

import type { FastifyReply } from "fastify";
import { allowsRawTitle } from "./content-gate";

export const RESTRICTED_TITLE_CODE = "restricted_title";

export const RESTRICTED_REFUSAL = {
  code: RESTRICTED_TITLE_CODE,
  errorKey: "seer:errRestrictedTitle",
  message: "This title isn't available for this profile",
} as const;

/**
 * Refuse (403) un geste sur un titre interdit au compte ; vrai si la réponse
 * est partie (`allowsRawTitle` : un titre illisible n'est permis qu'à un
 * compte libre).
 */
export async function refusedTitle(
  reply: FastifyReply,
  userId: string,
  title: { mediaType?: unknown; tmdbId?: unknown },
): Promise<boolean> {
  if (await allowsRawTitle(userId, title)) return false;
  reply.status(403).send(RESTRICTED_REFUSAL);
  return true;
}
