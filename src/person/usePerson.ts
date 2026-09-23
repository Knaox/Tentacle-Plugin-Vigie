/* ------------------------------------------------------------------ */
/*  Vigie — Une personne et sa filmographie                            */
/* ------------------------------------------------------------------ */

import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { SeerrSearchResult } from "../api/types";

export interface PersonDetail {
  id: number;
  name: string;
  biography?: string;
  profilePath?: string;
  knownForDepartment?: string;
  birthday?: string;
  placeOfBirth?: string;
}

type Credit = SeerrSearchResult & { character?: string; job?: string; department?: string };

export interface PersonCredits {
  cast: Credit[];
  crew: Credit[];
}

export function usePerson(id: number | null) {
  const lang = getCurrentLanguage();
  const detail = useQuery({
    queryKey: ["vigie-person", id, lang],
    queryFn: () => proxyFetch<PersonDetail>(`/api/v1/person/${id}?language=${lang}`),
    enabled: id !== null,
    staleTime: 60 * 60_000,
  });
  const credits = useQuery({
    queryKey: ["vigie-person-credits", id, lang],
    queryFn: () => proxyFetch<PersonCredits>(`/api/v1/person/${id}/combined_credits?language=${lang}`),
    enabled: id !== null,
    staleTime: 10 * 60_000,
  });
  return { detail, credits };
}

/**
 * Une ligne par œuvre, les plus connues d'abord : un acteur apparaît dans des
 * dizaines d'émissions où il joue « lui-même », un réalisateur figure deux fois
 * (réalisation, scénario) au générique d'un même film.
 */
export function filmography(credits: PersonCredits | undefined, department: string | undefined): SeerrSearchResult[] {
  if (!credits) return [];
  const main = department === "Acting" ? credits.cast : [...credits.crew, ...credits.cast];
  const seen = new Set<string>();
  const out: SeerrSearchResult[] = [];
  for (const c of main) {
    if (c.mediaType !== "movie" && c.mediaType !== "tv") continue;
    const key = `${c.mediaType}:${c.id}`;
    if (seen.has(key)) continue;
    // Les talk-shows et cérémonies où l'on joue « soi-même » noient le reste.
    if (/^(himself|herself|self|lui-même|elle-même)$/i.test(c.character ?? "")) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
}
