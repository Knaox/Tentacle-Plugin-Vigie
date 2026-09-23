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
 *      mots ≫ une partie des mots) ;
 *   2. ce que la requête exigeait en plus — l'année, le type, l'animé ;
 *   3. la notoriété (votes, popularité), qui départage à égalité de texte :
 *      « Dune » rend le film de 2021 avant le téléfilm de 1984.
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
}

/** Correspondance du texte seul, de 0 à 1000. */
export function textScore(names: readonly string[], tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  const phrase = tokens.join(" ");
  const wanted = significantTokens(tokens);
  let best = 0;
  for (const name of names) {
    if (name === phrase) return 1000;
    if (name.startsWith(phrase)) {
      // « Dune » avant « Dune : Deuxième partie » : le plus court l'emporte.
      best = Math.max(best, 880 - Math.min(80, name.length - phrase.length));
      continue;
    }
    const words = name.split(" ");
    let found = 0;
    for (let i = 0; i < wanted.length; i++) {
      const w = wanted[i];
      const last = i === wanted.length - 1;
      if (words.some((x) => x === w || (last && x.startsWith(w)))) found++;
    }
    if (found === wanted.length) {
      // Tous les mots : mieux vaut un titre qu'ils remplissent qu'un titre où ils se noient.
      best = Math.max(best, 650 + Math.round((150 * wanted.length) / Math.max(words.length, 1)));
    } else if (found > 0) {
      best = Math.max(best, Math.round((400 * found) / wanted.length));
    }
  }
  return best;
}

export function popularityScore(voteCount: number, popularity: number): number {
  return Math.round(70 * Math.log10(1 + voteCount) + 25 * Math.log10(1 + popularity));
}

/** Le score complet d'un titre pour une requête. */
export function scoreMedia(item: RankInput, query: ParsedQuery, tokens: readonly string[]): number {
  let score = textScore(item.names, tokens);
  // TMDB trouve aussi par titre alternatif, que nous n'avons pas : une trouvaille
  // sans mot commun n'est pas nulle, elle est seulement moins sûre.
  if (score === 0) score = 150;
  score += popularityScore(item.voteCount, item.popularity);
  if (query.year !== null && item.year !== null) {
    const gap = Math.abs(query.year - item.year);
    score += gap === 0 ? 500 : gap === 1 ? 150 : -250;
  }
  if (query.type !== null) score += query.type === item.mediaType ? 300 : -400;
  if (query.anime && item.isAnime) score += 300;
  // Un titre que personne n'a noté ne passe pas devant sur un simple mot commun.
  if (item.voteCount < 5 && score < 1000) score -= 100;
  return score;
}

/** Une personne : son nom, puis sa notoriété. */
export function scorePerson(name: string, popularity: number, tokens: readonly string[]): number {
  return textScore([name], tokens) + Math.round(60 * Math.log10(1 + popularity * 10));
}
