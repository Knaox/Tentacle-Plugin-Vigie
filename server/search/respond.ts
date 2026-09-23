/* ------------------------------------------------------------------ */
/*  Vigie — De la recherche classée à la réponse                        */
/* ------------------------------------------------------------------ */

/*
 * C'est ici, et seulement ici, que le statut s'applique : une recherche
 * classée se met en cache une minute, un statut non — la demande qu'on
 * vient de faire doit se voir tout de suite.
 */

import { foldText, significantTokens, tokenize } from "./fold";
import { TEXT_ALL_WORDS, TEXT_EXACT_TITLE, TEXT_KEY_WORDS, textScore } from "./rank";
import { MEDIA_STATUS, statusMapReady, statusOf } from "./status-map";
import { isLocallyPending } from "./pending";
import type { Facet } from "./facets";
import type { Ranked } from "./service";
import {
  inLibrary, inLibraryOrBlocked, toProviderItem, toSearchItem,
  type Candidate, type HubSearchResponse, type ProviderResponse, type SearchPerson,
} from "./present";

/* Un seul mot (« dune », « comédie ») : le meilleur résultat n'est mis en avant
 * que si son titre COMMENCE par ce mot — sinon n'importe quel titre qui le
 * contient passerait en vedette. */
const TOP_SINGLE_WORD = 800;
const GROUP_LIMIT = 40;
const TMDB_FIRST_CHOICES = 5;
const PEOPLE_LIMIT = 10;
/* Ce qui mérite d'être proposé à côté d'un titre que la bibliothèque a déjà. */
const NOTABLE_VOTES = 30;
const NOTABLE_POPULARITY = 3;

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

/* Un genre ou une plateforme tapés tels quels (« comédie », « netflix ») : c'est
 * eux qu'on cherchait, pas un titre qui porte le même mot. */
function facetNamed(facets: readonly Facet[], query: string): boolean {
  const q = foldText(query);
  return facets.some((f) => foldText(f.label) === q);
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
  const facetQuery = facetNamed(facets, ranked.parsed.raw);
  const bestMedia = media[0];
  const bestPerson = ranked.people[0];
  const personText = bestPerson ? textScore([foldText(bestPerson.name)], tokens) : 0;
  const needed = significantTokens(tokens).length <= 1 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;

  let top: HubSearchResponse["top"] = null;
  if (page !== 1 || facetQuery) {
    top = null;
  } else if (bestPerson && personText >= TEXT_KEY_WORDS && (!bestMedia || bestPerson.score > bestMedia.score)) {
    top = { kind: "person", person: toPerson(bestPerson) };
  } else if (bestMedia && bestMedia.text >= needed) {
    top = { kind: "media", item: toSearchItem(bestMedia, statusFor(bestMedia)) };
  } else if (!media.some((c) => c.text >= TEXT_KEY_WORDS)) {
    // Aucun nom affiché ne contient les mots tapés : TMDB a trouvé par un autre
    // titre (« shingeki no kyojin » → L'Attaque des Titans). Parmi ses premiers
    // choix, le plus connu — son tout premier était une comédie musicale.
    const first = media
      .filter((c) => c.remoteRank !== null && c.remoteRank < TMDB_FIRST_CHOICES)
      .sort((a, b) => b.voteCount - a.voteCount)[0];
    if (first) top = { kind: "media", item: toSearchItem(first, statusFor(first)) };
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
  // La barre de Tentacle veut des réponses NETTES : tous les mots, articles compris.
  // Et si la requête nomme exactement un titre — même déjà dans la bibliothèque —,
  // les autres doivent au moins COMMENCER pareil : « the bear » ne propose pas
  // tous les ours du catalogue.
  const media = visible(ranked.media);
  const best = media.reduce((m, c) => Math.max(m, c.text), 0);
  const threshold = best >= 1000 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;
  // La requête nomme exactement un titre que la bibliothèque a DÉJÀ : c'est lui
  // qu'on cherchait, et Tentacle le montre. Ne restent que les homonymes et les
  // suites qui comptent (« Dune » de 1984, « Dune : Troisième partie ») — pas
  // « Breaking Bad Wolf », un court sans date, ni « Interstelar », homonyme
  // obscur d'une faute de frappe sur « Interstellar ».
  const libraryHasIt = media.some((c) => c.text >= TEXT_EXACT_TITLE && inLibrary(statusFor(c)));
  // Quelques secondes après le démarrage, la carte des statuts n'est pas encore
  // chargée : un titre venu de l'index seul pourrait être sur le serveur. Seul
  // TMDB (via Jellyseerr, qui joint le statut) le dit alors — et le client
  // redemande tant que la réponse n'est pas complète.
  const statusesKnown = statusMapReady();
  const items = media
    .filter((c) => statusesKnown || c.remoteRank !== null)
    .filter((c) => c.text >= threshold)
    .filter((c) => !libraryHasIt || c.voteCount >= NOTABLE_VOTES || c.popularity >= NOTABLE_POPULARITY)
    .filter((c) => type === null || (type === "movie") === (c.mediaType === "movie"))
    .filter((c) => !inLibraryOrBlocked(statusFor(c)))
    .slice(0, limit)
    .map((c) => toProviderItem(c, statusFor(c), lang, today));
  const q = ranked.parsed.raw;
  return {
    query: q,
    correction: ranked.correction,
    complete: ranked.complete && statusesKnown,
    items,
    moreHref: q ? `/discover?q=${encodeURIComponent(q)}` : null,
  };
}
