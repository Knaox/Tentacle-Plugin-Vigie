/* ------------------------------------------------------------------ */
/*  Vigie — L'ordre des résultats                                      */
/* ------------------------------------------------------------------ */

/*
 * UN seul barème pour les deux sources : l'index local (instantané) et TMDB
 * (complet, un peu plus tard). S'ils classaient différemment, la liste se
 * réordonnerait sous les yeux à l'arrivée de la seconde réponse — c'est
 * précisément l'impression de lenteur qu'on veut éviter.
 *
 * L'échelle, par ordre de poids :
 *   1. la correspondance du texte (titre exact ≫ début de titre ≫ tous les
 *      mots, articles compris ≫ les mots qui comptent ≫ une partie) ;
 *   2. ce que la requête exigeait en plus — l'année, le type, l'animé ;
 *   3. la notoriété (votes, popularité) et l'avis de TMDB (son rang), qui
 *      départagent à égalité de texte : « Dune » rend le film de 2021 avant le
 *      téléfilm de 1984.
 */

import { significantTokens } from "./fold";
import type { ParsedQuery } from "./query";

export interface RankInput {
  /** Noms pliés : titres localisés et titre original. */
  names: readonly string[];
  mediaType: "movie" | "tv";
  year: number | null;
  voteCount: number;
  popularity: number;
  isAnime: boolean;
  /** Position dans la réponse TMDB (0 = premier), si TMDB l'a trouvé. */
  remoteRank?: number | null;
}

/** Tous les mots de la requête, articles compris : « the bear » n'est pas « yogi bear ». */
export const TEXT_ALL_WORDS = 650;
/** Les mots qui comptent seulement. */
export const TEXT_KEY_WORDS = 560;
/* Ce que coûte une correction : à texte égal, ce qui a été tapé l'emporte. */
export const FIX_PENALTY = 80;
/** Le titre exact, tapé (1000) ou atteint par correction (1000 − la pénalité). */
export const TEXT_EXACT_TITLE = 1000 - FIX_PENALTY;

function covered(words: readonly string[], wanted: readonly string[], lastIsPrefix: boolean): number {
  let found = 0;
  for (let i = 0; i < wanted.length; i++) {
    const w = wanted[i];
    const prefix = lastIsPrefix && i === wanted.length - 1;
    if (words.some((x) => x === w || (prefix && x.startsWith(w)))) found++;
  }
  return found;
}

/** Correspondance du texte seul, de 0 à 1000. */
export function textScore(names: readonly string[], tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  const phrase = tokens.join(" ");
  const key = significantTokens(tokens);
  // Le dernier mot peut être en cours de frappe — s'il est aussi le dernier des mots qui comptent.
  const lastIsKey = key[key.length - 1] === tokens[tokens.length - 1];
  let best = 0;
  for (const name of names) {
    if (name === phrase) return 1000;
    if (name.startsWith(phrase)) {
      // « Dune » avant « Dune : Deuxième partie » : le plus court l'emporte.
      best = Math.max(best, 880 - Math.min(80, name.length - phrase.length));
      continue;
    }
    const words = name.split(" ");
    const density = (n: number, span: number) => Math.round((span * n) / Math.max(words.length, 1));
    if (covered(words, tokens, true) === tokens.length) {
      best = Math.max(best, TEXT_ALL_WORDS + density(tokens.length, 150));
      continue;
    }
    const found = covered(words, key, lastIsKey);
    if (found === key.length) best = Math.max(best, TEXT_KEY_WORDS + density(key.length, 80));
    else if (found > 0) best = Math.max(best, Math.round((399 * found) / key.length));
  }
  return best;
}

export function popularityScore(voteCount: number, popularity: number): number {
  return Math.round(70 * Math.log10(1 + voteCount) + 25 * Math.log10(1 + popularity));
}

/** L'avis de TMDB : ses premiers résultats ont souvent trouvé par un titre que nous n'avons pas. */
export function remoteRankScore(rank: number | null | undefined): number {
  return rank === null || rank === undefined ? 0 : Math.max(0, 80 - 4 * rank);
}

/** Le score complet d'un titre pour une requête, à partir de son score de texte. */
export function scoreMediaWithText(item: RankInput, text: number, query: ParsedQuery): number {
  // TMDB trouve aussi par titre alternatif, que nous n'avons pas : une trouvaille
  // sans mot commun n'est pas nulle, elle est seulement moins sûre.
  let score = text === 0 && item.remoteRank !== null && item.remoteRank !== undefined ? 150 : text;
  score += popularityScore(item.voteCount, item.popularity) + remoteRankScore(item.remoteRank);
  if (query.year !== null && item.year !== null) {
    const gap = Math.abs(query.year - item.year);
    score += gap === 0 ? 500 : gap === 1 ? 150 : -250;
  }
  if (query.type !== null) score += query.type === item.mediaType ? 300 : -400;
  if (query.anime && item.isAnime) score += 300;
  // Un titre que personne n'a noté ne passe pas devant sur un simple mot commun.
  if (item.voteCount < 5 && text < 1000) score -= 100;
  return score;
}

export function scoreMedia(item: RankInput, query: ParsedQuery, tokens: readonly string[]): number {
  return scoreMediaWithText(item, textScore(item.names, tokens), query);
}

/**
 * Une personne : tous ses mots suffisent (« nolan » vaut « Christopher Nolan »
 * autant que « Nolan North »), puis sa notoriété et le rang TMDB départagent.
 */
export function scorePerson(name: string, popularity: number, tokens: readonly string[], remoteRank: number): number {
  const text = textScore([name], tokens);
  const normalized = text >= TEXT_KEY_WORDS ? 800 : text;
  return normalized + Math.round(150 * Math.log10(1 + popularity * 10)) + remoteRankScore(remoteRank) * 2;
}
