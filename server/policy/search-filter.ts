/* ------------------------------------------------------------------ */
/*  Vigie — Les réponses de la recherche, au contrôle parental          */
/* ------------------------------------------------------------------ */

/*
 * La recherche se calcule et se met en cache pour tous (search/service.ts) ;
 * le contrôle parental s'applique APRÈS, à la réponse d'un compte, en une
 * seule question au pont pour tous les titres qu'elle porte : la vedette, les
 * films, les séries, les œuvres des personnes (`knownFor`). Une personne
 * reste ; ses œuvres interdites partent. Un compte libre reçoit la réponse
 * elle-même (même référence), sans un appel de plus.
 */

import type { HubSearchResponse, ProviderItem, ProviderResponse, SearchItem } from "../search/present";
import { restrictionFor, titleKey, type ExternalTitle, type Restriction } from "./content-gate";

function itemTitle(i: SearchItem): ExternalTitle {
  return { mediaType: i.mediaType, tmdbId: i.id };
}

function providerTitle(i: ProviderItem): ExternalTitle {
  return { mediaType: i.kind === "movie" ? "movie" : "tv", tmdbId: i.tmdbId };
}

/** Les clés permises parmi `titles`, en une question. */
async function allowedKeys(r: Restriction, titles: ExternalTitle[]): Promise<Set<string>> {
  const kept = await r.filter(titles, (t) => t);
  return new Set(kept.map(titleKey));
}

/** La recherche du hub, sans un titre que le profil ne peut pas voir. */
export async function filterHubSearch(userId: string, res: HubSearchResponse): Promise<HubSearchResponse> {
  const r = await restrictionFor(userId);
  if (!r) return res;
  const all: SearchItem[] = [
    ...res.movies, ...res.series,
    ...res.people.flatMap((p) => p.knownFor),
    ...(res.top?.kind === "media" ? [res.top.item] : []),
    ...(res.top?.kind === "person" ? res.top.person.knownFor : []),
  ];
  const ok = await allowedKeys(r, all.map(itemTitle));
  const keep = (list: SearchItem[]) => list.filter((i) => ok.has(titleKey(itemTitle(i))));
  const person = <P extends { knownFor: SearchItem[] }>(p: P): P => ({ ...p, knownFor: keep(p.knownFor) });
  let top = res.top;
  if (top?.kind === "media" && !ok.has(titleKey(itemTitle(top.item)))) top = null;
  else if (top?.kind === "person") top = { kind: "person", person: person(top.person) };
  return { ...res, top, movies: keep(res.movies), series: keep(res.series), people: res.people.map(person) };
}

/** Le contrat `search` (barre globale, filmographie, saga) du cœur, filtré de même. */
export async function filterProviderSearch(userId: string, res: ProviderResponse): Promise<ProviderResponse> {
  const r = await restrictionFor(userId);
  if (!r) return res;
  const ok = await allowedKeys(r, res.items.map(providerTitle));
  return { ...res, items: res.items.filter((i) => ok.has(titleKey(providerTitle(i)))) };
}
