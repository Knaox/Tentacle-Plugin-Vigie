/* ------------------------------------------------------------------ */
/*  Vigie — Le moteur de recherche                                     */
/* ------------------------------------------------------------------ */

/*
 * Deux vitesses pour une même requête :
 *
 *   - INSTANTANÉE : l'index en mémoire seul, quelques millisecondes, fautes
 *     de frappe comprises. C'est ce qui s'affiche d'abord ;
 *   - COMPLÈTE : l'index ET tout TMDB (via Jellyseerr), avec correction
 *     vérifiée, personnes et année de secours. Mise en cache une minute pour
 *     tout le monde ; ce qu'elle trouve enrichit l'index pour la suite.
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
import { scoreMedia, scorePerson, textScore } from "./rank";
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
/* Correspondance « tous les mots » (cf. rank.ts) : en dessous, TMDB n'a pas
 * vraiment trouvé ce qu'on cherchait. */
const GOOD_TEXT = 650;

function fromEntry(e: TitleEntry, lang: string): Candidate {
  const title = e.titles.get(lang) ?? e.titles.get("en") ?? e.originalTitle ?? [...e.titles.values()][0] ?? "";
  return {
    key: e.key, mediaType: e.mediaType, tmdbId: e.tmdbId, title, originalTitle: e.originalTitle,
    names: e.names, releaseDate: e.releaseDate, year: e.year, posterPath: e.posterPath,
    backdropPath: e.backdropPath, overview: null, voteAverage: e.voteAverage, voteCount: e.voteCount,
    popularity: e.popularity, genreIds: e.genreIds, originalLanguage: e.originalLanguage,
    isAnime: e.isAnime, remoteStatus: undefined, score: 0,
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
    originalLanguage: m.originalLanguage, isAnime, remoteStatus: m.status, score: 0,
  };
}

/** La fiche TMDB gagne (titre dans la langue voulue, résumé) ; les noms s'additionnent. */
function merge(into: Map<string, Candidate>, c: Candidate): void {
  const known = into.get(c.key);
  if (!known) { into.set(c.key, c); return; }
  into.set(c.key, { ...known, ...c, names: [...new Set([...known.names, ...c.names])] });
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

function rank(candidates: Iterable<Candidate>, parsed: ParsedQuery, tokens: readonly string[]): Candidate[] {
  const out = [...candidates].map((c) => ({ ...c, score: scoreMedia(c, parsed, tokens) }));
  return out.sort((a, b) => b.score - a.score);
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
  const correction = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const tokens = correction !== null ? tokenize(correction) : parsed.tokens;
  const media = rank(lookup.hits.map((h) => fromEntry(h.entry, opts.lang)), parsed, tokens);
  return { ...EMPTY(parsed), searched: correction ?? parsed.text, correction, media, complete: false };
}

function bestText(page: RemotePage | null, tokens: readonly string[]): number {
  let best = 0;
  for (const m of page?.media ?? []) best = Math.max(best, textScore(fromRemote(m).names, tokens));
  return best;
}

async function tryRemote(ctx: SearchContext, text: string, opts: SearchOptions): Promise<RemotePage | null> {
  if (text.trim() === "") return null;
  try {
    return await remoteSearch(ctx.cfg, text, opts.page, opts.lang, opts.showBlocked);
  } catch {
    return null;
  }
}

async function computeFull(ctx: SearchContext, q: string, opts: SearchOptions): Promise<Ranked> {
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY(parsed);
  const lookup = opts.page === 1 ? titleIndex.lookup(parsed.tokens, LOCAL_LIMIT) : { hits: [], replacements: [] };
  const first = await tryRemote(ctx, parsed.text, opts);

  let searched = parsed.text;
  let correction: string | null = null;
  let main = first;
  const pages: RemotePage[] = first ? [first] : [];

  // L'index soupçonne une faute ET TMDB n'a rien trouvé de franc : on vérifie la correction.
  if (lookup.replacements.length > 0 && bestText(first, parsed.tokens) < GOOD_TEXT) {
    const fixed = rewrite(parsed, lookup.replacements);
    const second = await tryRemote(ctx, fixed, opts);
    if (second && (bestText(second, tokenize(fixed)) >= GOOD_TEXT || first === null)) {
      searched = fixed;
      correction = fixed;
      main = second;
      pages.unshift(second);
    }
  }

  const tokens = tokenize(searched);
  const all = new Map<string, Candidate>();
  for (const h of lookup.hits) merge(all, fromEntry(h.entry, opts.lang));
  for (const page of pages) for (const m of page.media) merge(all, fromRemote(m));

  // « dune 1984 » sans aucun Dune de 1984 : peut-être que « 1984 » faisait partie du titre.
  if (parsed.year !== null && parsed.text !== parsed.raw && opts.page === 1) {
    const found = [...all.values()].some((c) => c.year === parsed.year && textScore(c.names, tokens) >= GOOD_TEXT);
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

  const people = new Map<number, PersonCandidate>();
  for (const page of pages) {
    for (const p of page.people) {
      if (people.has(p.id)) continue;
      people.set(p.id, {
        id: p.id, name: p.name, profilePath: p.profilePath, popularity: p.popularity, department: p.department,
        knownFor: rank(p.knownFor.map(fromRemote), parsed, tokens).slice(0, 8),
        score: scorePerson(foldText(p.name), p.popularity, tokens),
      });
    }
  }

  return {
    parsed, searched, correction,
    media: rank(all.values(), parsed, tokens),
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
