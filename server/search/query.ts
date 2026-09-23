/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la requête veut dire                                */
/* ------------------------------------------------------------------ */

/*
 * TMDB cherche du texte, rien d'autre : « dune 2021 » y cherche un titre qui
 * contient « 2021 », et « série the office » un titre qui contient « série ».
 * On lit donc l'intention d'abord — une année, un type, une saison — et l'on
 * n'envoie que le titre.
 *
 * Tout est PRUDENT : on ne retire jamais le dernier mot (« 1917 », « 2012 »,
 * « Film » sont des titres), et une année n'en est une que si elle est
 * plausible — « Blade Runner 2049 » garde son nombre.
 */

import { foldText, tokenize } from "./fold";

export type QueryType = "movie" | "tv";

export interface ParsedQuery {
  /** Tel que tapé, espaces normalisés. */
  raw: string;
  /** Le titre à chercher : sans année, type ni saison. */
  text: string;
  /** `text` plié, mot par mot. */
  tokens: string[];
  year: number | null;
  type: QueryType | null;
  anime: boolean;
}

const MOVIE_HINTS = new Set(["film", "films", "movie", "movies"]);
const TV_HINTS = new Set(["serie", "series", "show", "shows", "tv", "feuilleton"]);
const ANIME_HINTS = new Set(["anime", "animes", "manga", "mangas"]);
const SEASON_WORDS = new Set(["saison", "season", "staffel", "temporada"]);

/** « s2 », « s02 », « s02e05 ». */
const SEASON_CODE = /^s\d{1,2}(e\d{1,3})?$/;

function yearOf(word: string, maxYear: number): number | null {
  const m = /^\(?((?:19|20)\d\d)\)?$/.exec(word);
  if (!m) return null;
  const year = Number(m[1]);
  return year <= maxYear ? year : null;
}

export function parseQuery(input: string, now: Date = new Date()): ParsedQuery {
  const raw = input.replace(/\s+/g, " ").trim();
  const words = raw === "" ? [] : raw.split(" ");
  const maxYear = now.getFullYear() + 3;
  let year: number | null = null;
  let type: QueryType | null = null;
  let anime = false;

  // Une année entre parenthèses se retire où qu'elle soit : « Dune (2021) ».
  const inParens = words.findIndex((w) => /^\(\d{4}\)$/.test(w) && yearOf(w, maxYear) !== null);
  if (inParens >= 0 && words.length > 1) {
    year = yearOf(words[inParens], maxYear);
    words.splice(inParens, 1);
  }

  // Un mot à la fois, par les bords, tant qu'il en reste au moins un.
  for (let changed = true; changed && words.length > 1; ) {
    changed = false;
    const first = foldText(words[0]);
    const last = foldText(words[words.length - 1]);
    const beforeLast = words.length > 2 ? foldText(words[words.length - 2]) : "";

    if (type === null && (MOVIE_HINTS.has(last) || TV_HINTS.has(last))) {
      type = MOVIE_HINTS.has(last) ? "movie" : "tv";
      words.pop();
    } else if (type === null && (MOVIE_HINTS.has(first) || TV_HINTS.has(first))) {
      type = MOVIE_HINTS.has(first) ? "movie" : "tv";
      words.shift();
    } else if (!anime && (ANIME_HINTS.has(last) || ANIME_HINTS.has(first))) {
      anime = true;
      if (ANIME_HINTS.has(last)) words.pop(); else words.shift();
    } else if (year === null && yearOf(words[words.length - 1], maxYear) !== null) {
      year = yearOf(words.pop() as string, maxYear);
    } else if (SEASON_CODE.test(last)) {
      type = type ?? "tv";
      words.pop();
    } else if (words.length > 2 && SEASON_WORDS.has(beforeLast) && /^\d{1,2}$/.test(last)) {
      type = type ?? "tv";
      words.splice(words.length - 2, 2);
    } else {
      break;
    }
    changed = true;
  }

  const text = words.join(" ");
  return { raw, text, tokens: tokenize(text), year, type, anime };
}
