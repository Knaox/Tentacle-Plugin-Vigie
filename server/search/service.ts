/* ------------------------------------------------------------------ */
/*  Vigie — Le moteur de recherche                                     */
/* ------------------------------------------------------------------ */

/*
 * Deux vitesses pour une même requête :
 *
 *   - INSTANTANÉE : l'index en mémoire seul, quelques millisecondes, fautes
 *     de frappe comprises. C'est ce qui s'affiche d'abord ;
 *   - COMPLÈTE : l'index ET tout TMDB (via Jellyseerr) — la requête tapée et,
 *     si l'index y voit une faute, sa correction, EN PARALLÈLE ; puis les
 *     personnes et l'année de secours. Mise en commun une minute ; ce qu'elle
 *     trouve enrichit l'index pour la suite.
 *
 * Tapé ou corrigé, chaque titre garde sa meilleure correspondance (la
 * corrigée un peu moins créditée) : « interstelar » rend Interstellar, pas un
 * court métrage obscur qui porterait exactement la faute.
 *
 * Le statut (disponible, demandé) s'applique à la SORTIE, jamais en cache :
 * une demande qu'on vient de faire se voit à la recherche suivante.
 */

import type { PrismaClient } from "@prisma/client";
import { cached, peek } from "../cache";
import type { WorkerCfg } from "../seerr-unified";
import { foldText, tokenize } from "./fold";
import { parseQuery, type ParsedQuery } from "./query";
import { TitleIndex, type TitleEntry, type TitleRecord } from "./title-index";
import { ensureTitleIndex } from "./title-crawl";
import { queueTitles } from "./title-store";
import { refreshStatusMap } from "./status-map";
import { refreshLocalPending } from "./pending";
import { remoteSearch, type RemoteMedia, type RemotePage } from "./remote";
import { TEXT_KEY_WORDS, scoreMediaWithText, scorePerson, textScore } from "./rank";
import type { Candidate, PersonCandidate } from "./present";

export const titleIndex = new TitleIndex();

export interface SearchContext {
  prisma: PrismaClient;
  cfg: WorkerCfg;
}

export interface SearchOptions {
  lang: string;
  page: number;
  showBlocked: boolean;
}

/** Une recherche classée, SANS statuts — c'est ce qui se met en cache. */
export interface Ranked {
  parsed: ParsedQuery;
  searched: string;
  correction: string | null;
  media: Candidate[];
  people: PersonCandidate[];
  hasMore: boolean;
  blockedCount: number;
  blockedActive: boolean;
  complete: boolean;
}

const FULL_TTL_MS = 60_000;
const LOCAL_LIMIT = 80;
/* Ce que coûte une correction : à texte égal, ce qui a été tapé l'emporte. */
const FIX_PENALTY = 80;

function fromEntry(e: TitleEntry, lang: string): Candidate {
  const title = e.titles.get(lang) ?? e.titles.get("en") ?? e.originalTitle ?? [...e.titles.values()][0] ?? "";
  return {
    key: e.key, mediaType: e.mediaType, tmdbId: e.tmdbId, title, originalTitle: e.originalTitle,
    names: e.names, releaseDate: e.releaseDate, year: e.year, posterPath: e.posterPath,
    backdropPath: e.backdropPath, overview: null, voteAverage: e.voteAverage, voteCount: e.voteCount,
    popularity: e.popularity, genreIds: e.genreIds, originalLanguage: e.originalLanguage,
    isAnime: e.isAnime, remoteStatus: undefined, remoteRank: null, text: 0, score: 0,
  };
}

function fromRemote(m: RemoteMedia): Candidate {
  const names = [m.title, m.originalTitle].filter((n): n is string => !!n).map(foldText).filter((n) => n !== "");
  const year = m.releaseDate ? Number(m.releaseDate.slice(0, 4)) || null : null;
  const isAnime = m.genreIds.includes(16) && ["ja", "ko", "zh"].includes(m.originalLanguage ?? "");
  return {
    key: `${m.mediaType}:${m.id}`, mediaType: m.mediaType, tmdbId: m.id, title: m.title,
    originalTitle: m.originalTitle, names: [...new Set(names)], releaseDate: m.releaseDate, year,
    posterPath: m.posterPath, backdropPath: m.backdropPath, overview: m.overview,
    voteAverage: m.voteAverage, voteCount: m.voteCount, popularity: m.popularity, genreIds: m.genreIds,
    originalLanguage: m.originalLanguage, isAnime, remoteStatus: m.status, remoteRank: m.rank, text: 0, score: 0,
  };
}

/** La fiche TMDB gagne (titre dans la langue voulue, résumé) ; les noms s'additionnent, le meilleur rang reste. */
function merge(into: Map<string, Candidate>, c: Candidate): void {
  const known = into.get(c.key);
  if (!known) { into.set(c.key, c); return; }
  const ranks = [known.remoteRank, c.remoteRank].filter((r): r is number => r !== null);
  into.set(c.key, {
    ...known, ...c,
    names: [...new Set([...known.names, ...c.names])],
    remoteRank: ranks.length > 0 ? Math.min(...ranks) : null,
  });
}

function recordOf(m: RemoteMedia, lang: string): TitleRecord {
  return {
    mediaType: m.mediaType, tmdbId: m.id, lang, title: m.title, originalTitle: m.originalTitle,
    releaseDate: m.releaseDate, popularity: m.popularity, voteCount: m.voteCount, voteAverage: m.voteAverage,
    posterPath: m.posterPath, backdropPath: m.backdropPath, originalLanguage: m.originalLanguage, genreIds: m.genreIds,
  };
}

function rewrite(parsed: ParsedQuery, replacements: Array<[string, string]>): string {
  const map = new Map(replacements);
  return parsed.tokens.map((t) => map.get(t) ?? t).join(" ");
}

interface Scored {
  media: Candidate[];
  /** La correction a-t-elle fait gagner le meilleur résultat ? */
  fixWon: boolean;
}

/**
 * Classe les candidats sur la requête tapée ET sa correction, et retire le
 * bruit de l'index : un titre local qui ne contient qu'une partie des mots
 * n'a rien à faire là quand d'autres les contiennent tous.
 */
function score(candidates: Iterable<Candidate>, parsed: ParsedQuery, fixed: readonly string[] | null): Scored {
  let fixWon = false;
  const scored = [...candidates].map((c) => {
    const typed = textScore(c.names, parsed.tokens);
    const viaFix = fixed ? textScore(c.names, fixed) - FIX_PENALTY : -1;
    const text = Math.max(typed, viaFix);
    return { c: { ...c, text, score: scoreMediaWithText(c, text, parsed) }, viaFix: viaFix > typed };
  });
  scored.sort((a, b) => b.c.score - a.c.score);
  if (scored.length > 0) fixWon = scored[0].viaFix;
  const anyFull = scored.some((s) => s.c.text >= TEXT_KEY_WORDS);
  const media = scored
    .map((s) => s.c)
    .filter((c) => !(anyFull && c.text < TEXT_KEY_WORDS && c.remoteRank === null));
  return { media, fixWon };
}

function warm(ctx: SearchContext): void {
  ensureTitleIndex(ctx.prisma, ctx.cfg, titleIndex);
  refreshStatusMap(ctx.cfg);
  refreshLocalPending(ctx.prisma);
}

const EMPTY = (parsed: ParsedQuery): Ranked => ({
  parsed, searched: parsed.text, correction: null, media: [], people: [],
  hasMore: false, blockedCount: 0, blockedActive: false, complete: true,
});

/** La réponse de l'index seul — synchrone, quelques millisecondes. */
export function instantSearch(ctx: SearchContext, q: string, opts: SearchOptions): Ranked {
  warm(ctx);
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const { media, fixWon } = score(lookup.hits.map((h) => fromEntry(h.entry, opts.lang)), parsed, fixedText ? tokenize(fixedText) : null);
  const correction = fixWon ? fixedText : null;
  return { ...EMPTY(parsed), searched: correction ?? parsed.text, correction, media, complete: false };
}

async function tryRemote(ctx: SearchContext, text: string, opts: SearchOptions): Promise<RemotePage | null> {
  if (text.trim() === "") return null;
  try {
    return await remoteSearch(ctx.cfg, text, opts.page, opts.lang, opts.showBlocked,
      (mediaType, id) => titleIndex.get(`${mediaType}:${id}`) !== undefined);
  } catch {
    return null;
  }
}

async function computeFull(ctx: SearchContext, q: string, opts: SearchOptions): Promise<Ranked> {
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;

  // La requête tapée et sa correction partent ensemble : une faute ne double pas l'attente.
  const [typed, fixed] = await Promise.all([
    tryRemote(ctx, parsed.text, opts),
    fixedText ? tryRemote(ctx, fixedText, opts) : Promise.resolve(null),
  ]);
  const pages = [typed, fixed].filter((p): p is RemotePage => p !== null);

  const all = new Map<string, Candidate>();
  if (opts.page === 1) for (const h of lookup.hits) merge(all, fromEntry(h.entry, opts.lang));
  for (const page of pages) for (const m of page.media) merge(all, fromRemote(m));

  // « dune 1984 » sans aucun Dune de 1984 : peut-être que « 1984 » faisait partie du titre.
  if (parsed.year !== null && parsed.text !== parsed.raw && opts.page === 1) {
    const found = [...all.values()].some((c) => c.year === parsed.year && textScore(c.names, parsed.tokens) >= TEXT_KEY_WORDS);
    if (!found) {
      const raw = await tryRemote(ctx, parsed.raw, opts);
      if (raw) { pages.push(raw); for (const m of raw.media) merge(all, fromRemote(m)); }
    }
  }

  // Ce que TMDB a trouvé devient instantané pour la prochaine fois.
  if (!opts.showBlocked) {
    const learned = pages.flatMap((p) => p.media).filter((m) => m.title).map((m) => recordOf(m, opts.lang));
    for (const r of learned) titleIndex.upsert(r);
    if (learned.length > 0) queueTitles(ctx.prisma, learned);
  }

  const fixedTokens = fixedText ? tokenize(fixedText) : null;
  const { media, fixWon } = score(all.values(), parsed, fixedTokens);
  const correction = fixWon ? fixedText : null;
  const tokens = correction ? (fixedTokens as string[]) : parsed.tokens;

  const people = new Map<number, PersonCandidate>();
  for (const page of pages) {
    for (const p of page.people) {
      if (people.has(p.id)) continue;
      people.set(p.id, {
        id: p.id, name: p.name, profilePath: p.profilePath, popularity: p.popularity, department: p.department,
        knownFor: p.knownFor.map(fromRemote),
        score: scorePerson(foldText(p.name), p.popularity, tokens, p.rank),
      });
    }
  }

  const main = (correction ? fixed : typed) ?? typed ?? fixed;
  return {
    parsed,
    searched: correction ?? parsed.text,
    correction,
    media,
    people: [...people.values()].sort((a, b) => b.score - a.score),
    hasMore: (main?.totalPages ?? 0) > opts.page,
    blockedCount: pages.reduce((n, p) => n + p.blockedCount, 0),
    blockedActive: pages.some((p) => p.blockedActive),
    complete: true,
  };
}

function fullKey(q: string, opts: SearchOptions): string {
  return `vigie:full:${opts.lang}:${opts.showBlocked ? 1 : 0}:${opts.page}:${foldText(q)}`;
}

/** La réponse complète — mise en commun pour une minute. */
export function fullSearch(ctx: SearchContext, q: string, opts: SearchOptions): Promise<Ranked> {
  warm(ctx);
  return cached(fullKey(q, opts), FULL_TTL_MS, () => computeFull(ctx, q, opts));
}

/** La réponse complète si elle est déjà là, sinon `undefined` (et elle se prépare). */
export function fullIfReady(ctx: SearchContext, q: string, opts: SearchOptions): Ranked | undefined {
  const hit = peek<Ranked>(fullKey(q, opts));
  if (hit) return hit;
  void fullSearch(ctx, q, opts).catch(() => undefined);
  return undefined;
}
