/* ------------------------------------------------------------------ */
/*  Vigie — De la recherche classée à la réponse                        */
/* ------------------------------------------------------------------ */

/*
 * C'est ici, et seulement ici, que le statut s'applique : une recherche
 * classée se met en cache une minute, un statut non — la demande qu'on
 * vient de faire doit se voir tout de suite.
 */

import { foldText, tokenize } from "./fold";
import { textScore } from "./rank";
import { MEDIA_STATUS, statusOf } from "./status-map";
import { isLocallyPending } from "./pending";
import type { Facet } from "./facets";
import type { Ranked } from "./service";
import {
  inLibraryOrBlocked, toProviderItem, toSearchItem,
  type Candidate, type HubSearchResponse, type ProviderResponse, type SearchPerson,
} from "./present";

const GOOD_TEXT = 650;
const GROUP_LIMIT = 40;
const PEOPLE_LIMIT = 10;

export function statusFor(c: Pick<Candidate, "key" | "mediaType" | "tmdbId" | "remoteStatus">): number | undefined {
  const known = statusOf(c.mediaType, c.tmdbId) ?? c.remoteStatus;
  const settled = known !== undefined && known !== MEDIA_STATUS.UNKNOWN && known !== MEDIA_STATUS.DELETED;
  if (!settled && isLocallyPending(c.key)) return MEDIA_STATUS.PENDING;
  return known;
}

function visible(media: readonly Candidate[]): Candidate[] {
  return media.filter((c) => statusFor(c) !== MEDIA_STATUS.BLOCKLISTED);
}

function toPerson(p: Ranked["people"][number]): SearchPerson {
  return {
    id: p.id,
    mediaType: "person",
    name: p.name,
    profilePath: p.profilePath ?? undefined,
    knownForDepartment: p.department ?? undefined,
    popularity: p.popularity,
    knownFor: [...p.knownFor]
      .sort((a, b) => b.voteCount - a.voteCount)
      .filter((c) => statusFor(c) !== MEDIA_STATUS.BLOCKLISTED)
      .map((c) => toSearchItem(c, statusFor(c))),
  };
}

export function presentHub(
  ranked: Ranked,
  page: number,
  facets: Facet[],
  indexing: boolean,
  startedAt: number,
): HubSearchResponse {
  const media = visible(ranked.media);
  const tokens = tokenize(ranked.searched);
  const bestMedia = media[0];
  const bestPerson = ranked.people[0];
  const mediaText = bestMedia ? textScore(bestMedia.names, tokens) : 0;
  const personText = bestPerson ? textScore([foldText(bestPerson.name)], tokens) : 0;

  let top: HubSearchResponse["top"] = null;
  if (page === 1 && bestPerson && personText >= GOOD_TEXT && (!bestMedia || bestPerson.score > bestMedia.score)) {
    top = { kind: "person", person: toPerson(bestPerson) };
  } else if (page === 1 && bestMedia && mediaText >= GOOD_TEXT) {
    top = { kind: "media", item: toSearchItem(bestMedia, statusFor(bestMedia)) };
  }
  const topKey = top?.kind === "media" ? `${top.item.mediaType}:${top.item.id}` : null;
  const rest = media.filter((c) => c.key !== topKey);

  return {
    query: ranked.parsed.raw,
    searched: ranked.searched,
    correction: ranked.correction,
    year: ranked.parsed.year,
    type: ranked.parsed.type,
    complete: ranked.complete,
    top,
    movies: rest.filter((c) => c.mediaType === "movie").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    series: rest.filter((c) => c.mediaType === "tv").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    people: ranked.people
      .filter((p) => top?.kind !== "person" || p.id !== top.person.id)
      .slice(0, PEOPLE_LIMIT)
      .map(toPerson),
    facets,
    page,
    hasMore: ranked.hasMore,
    blockedCount: ranked.blockedCount,
    blockedActive: ranked.blockedActive,
    indexing,
    tookMs: Date.now() - startedAt,
  };
}

/**
 * Le contrat générique de la recherche de Tentacle : seulement ce qui n'est
 * PAS encore dans la bibliothèque — le reste, Tentacle le trouve lui-même.
 */
export function presentProvider(
  ranked: Ranked,
  type: "movie" | "series" | null,
  limit: number,
  lang: string,
  today: string,
): ProviderResponse {
  const items = visible(ranked.media)
    .filter((c) => type === null || (type === "movie") === (c.mediaType === "movie"))
    .filter((c) => !inLibraryOrBlocked(statusFor(c)))
    .slice(0, limit)
    .map((c) => toProviderItem(c, statusFor(c), lang, today));
  const q = ranked.parsed.raw;
  return {
    query: q,
    correction: ranked.correction,
    complete: ranked.complete,
    items,
    moreHref: q ? `/discover?q=${encodeURIComponent(q)}` : null,
  };
}
