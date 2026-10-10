/* ------------------------------------------------------------------ */
/*  Vigie — Chercher dans les demandes                                  */
/* ------------------------------------------------------------------ */

/*
 * Par le titre ; dans la vue de tout le serveur, aussi par le compte qui a
 * demandé (« bob » trouve les demandes de Bob). Le serveur filtre pareil
 * (`filterAndPaginate`, `byRequester`).
 */

import type { LocalRequest } from "../api/types";

export function matchesRequestQuery(
  request: Pick<LocalRequest, "title" | "username">,
  query: string,
  byRequester: boolean,
): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return true;
  if ((request.title ?? "").toLocaleLowerCase().includes(q)) return true;
  return byRequester && (request.username ?? "").toLocaleLowerCase().includes(q);
}
