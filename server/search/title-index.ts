/* ------------------------------------------------------------------ */
/*  Vigie — L'index des titres, en mémoire                             */
/* ------------------------------------------------------------------ */

/*
 * Ce qui rend la recherche INSTANTANÉE hors de la bibliothèque. TMDB, derrière
 * Jellyseerr, répond en deux à quatre cents millisecondes — et ne pardonne
 * aucune faute. Cet index garde les titres connus (les plus populaires, les
 * plus votés, les animés, et tout ce que les gens ont déjà cherché) et répond
 * en quelques millisecondes, fautes de frappe comprises.
 *
 * Trois structures, toutes reconstruites paresseusement :
 *   - `postings` : mot plié → titres qui le contiennent (recherche exacte) ;
 *   - `sorted`   : le vocabulaire trié (complétion du mot en cours de frappe) ;
 *   - `byInitial`: le vocabulaire par première lettre (correction des fautes).
 */

import { editDistance, foldText, nameForms, significantTokens } from "./fold";

export interface TitleRecord {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Langue de `title`. */
  lang: string;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  popularity: number;
  voteCount: number;
  voteAverage: number;
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage: string | null;
  genreIds: number[];
}

export interface TitleEntry {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  titles: Map<string, string>;
  originalTitle: string | null;
  releaseDate: string | null;
  year: number | null;
  popularity: number;
  voteCount: number;
  voteAverage: number;
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage: string | null;
  genreIds: number[];
  isAnime: boolean;
  /** Tous les noms, pliés — c'est sur eux que tout se compare. */
  names: string[];
  /** Les mots de ces noms : un mot déjà indexé pour ce titre ne l'est pas deux fois. */
  tokens: Set<string>;
}

export interface IndexHit {
  entry: TitleEntry;
  /** Nombre de mots significatifs de la requête retrouvés. */
  matched: number;
}

export interface IndexLookup {
  hits: IndexHit[];
  /** Les mots réellement cherchés, s'ils diffèrent de ceux tapés (fautes corrigées). */
  corrected: string[] | null;
  /** Chaque mot fautif et son remplaçant — pour réécrire la requête telle qu'elle a été tapée. */
  replacements: Array<[string, string]>;
}

/* Au-delà, un index de recherche ne gagne plus rien et la mémoire, si. */
const MAX_ENTRIES = 60_000;
/* Complétion du dernier mot : au-delà, la requête est trop vague pour aider. */
const MAX_PREFIX_TOKENS = 300;
const MIN_PREFIX = 2;
/* Écart de poids au-delà duquel un voisin d'une lettre « écrase » un mot connu :
 * trois points, c'est dix fois plus de votes ; six, cent fois plus. */
const DOMINANCE = 6;

export function entryWeight(e: Pick<TitleEntry, "voteCount" | "popularity">): number {
  return Math.log10(1 + e.voteCount) * 3 + Math.log10(1 + e.popularity);
}

function isAnimeOf(genreIds: number[], originalLanguage: string | null): boolean {
  return genreIds.includes(16) && (originalLanguage === "ja" || originalLanguage === "ko" || originalLanguage === "zh");
}

export class TitleIndex {
  private list: TitleEntry[] = [];
  private byKey = new Map<string, number>();
  private postings = new Map<string, number[]>();
  private vocabWeight = new Map<string, number>();
  private sorted: string[] = [];
  private byInitial = new Map<string, string[]>();
  private dirty = false;

  size(): number {
    return this.list.length;
  }

  get(key: string): TitleEntry | undefined {
    const i = this.byKey.get(key);
    return i === undefined ? undefined : this.list[i];
  }

  /** Ajoute ou complète un titre. Les noms déjà connus restent : un titre ne s'oublie pas. */
  upsert(r: TitleRecord): void {
    if (!r.title && !r.originalTitle) return;
    const key = `${r.mediaType}:${r.tmdbId}`;
    let index = this.byKey.get(key);
    let entry: TitleEntry;
    if (index === undefined) {
      if (this.list.length >= MAX_ENTRIES) return;
      entry = {
        key, mediaType: r.mediaType, tmdbId: r.tmdbId, titles: new Map(), originalTitle: null,
        releaseDate: null, year: null, popularity: 0, voteCount: 0, voteAverage: 0,
        posterPath: null, backdropPath: null, originalLanguage: null, genreIds: [], isAnime: false,
        names: [], tokens: new Set(),
      };
      index = this.list.length;
      this.list.push(entry);
      this.byKey.set(key, index);
    } else {
      entry = this.list[index];
    }

    if (r.title) entry.titles.set(r.lang, r.title);
    entry.originalTitle = r.originalTitle ?? entry.originalTitle;
    entry.releaseDate = r.releaseDate ?? entry.releaseDate;
    entry.year = entry.releaseDate ? Number(entry.releaseDate.slice(0, 4)) || null : entry.year;
    // Les chiffres de popularité bougent : la dernière lecture fait foi.
    entry.popularity = r.popularity || entry.popularity;
    entry.voteCount = r.voteCount || entry.voteCount;
    entry.voteAverage = r.voteAverage || entry.voteAverage;
    entry.posterPath = r.posterPath ?? entry.posterPath;
    entry.backdropPath = r.backdropPath ?? entry.backdropPath;
    entry.originalLanguage = r.originalLanguage ?? entry.originalLanguage;
    if (r.genreIds.length > 0) entry.genreIds = r.genreIds;
    entry.isAnime = isAnimeOf(entry.genreIds, entry.originalLanguage);

    const weight = entryWeight(entry);
    const forms = [r.title, r.originalTitle].flatMap((name) => (name ? nameForms(foldText(name)) : []));
    for (const folded of forms) {
      if (folded === "" || entry.names.includes(folded)) continue;
      entry.names.push(folded);
      for (const token of folded.split(" ")) {
        if ((this.vocabWeight.get(token) ?? -1) < weight) this.vocabWeight.set(token, weight);
        if (entry.tokens.has(token)) continue;
        entry.tokens.add(token);
        const list = this.postings.get(token);
        if (list === undefined) {
          this.postings.set(token, [index]);
          this.dirty = true;
        } else {
          list.push(index);
        }
      }
    }
  }

  private rebuild(): void {
    if (!this.dirty) return;
    this.sorted = [...this.postings.keys()].sort();
    this.byInitial = new Map();
    for (const token of this.sorted) {
      const initial = token[0];
      const bucket = this.byInitial.get(initial);
      if (bucket) bucket.push(token); else this.byInitial.set(initial, [token]);
    }
    this.dirty = false;
  }

  /** Les mots du vocabulaire qui commencent par `prefix`, les plus porteurs d'abord. */
  complete(prefix: string): string[] {
    this.rebuild();
    if (prefix.length < MIN_PREFIX) return this.postings.has(prefix) ? [prefix] : [];
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sorted[mid] < prefix) lo = mid + 1; else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < this.sorted.length && this.sorted[i].startsWith(prefix); i++) out.push(this.sorted[i]);
    if (out.length <= MAX_PREFIX_TOKENS) return out;
    return out
      .sort((a, b) => (this.vocabWeight.get(b) ?? 0) - (this.vocabWeight.get(a) ?? 0))
      .slice(0, MAX_PREFIX_TOKENS);
  }

  /**
   * Le mot connu le plus proche d'un mot inconnu — mêmes garde-fous que le
   * moteur de la bibliothèque, calibrés sur du bruit réel : cinq lettres au
   * moins, première lettre juste, une faute jusqu'à sept lettres, deux au-delà.
   * Un mot collé (« spiderman ») se décolle s'il se coupe en deux mots connus.
   */
  correctToken(token: string): string | null {
    this.rebuild();
    if (this.postings.has(token) || token.length < 5 || /\d/.test(token)) return null;
    const max = token.length >= 8 ? 2 : 1;
    let best: string | null = null;
    let bestDistance = max + 1;
    let bestWeight = -1;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (Math.abs(candidate.length - token.length) > max) continue;
      const d = editDistance(token, candidate, max);
      const w = this.vocabWeight.get(candidate) ?? 0;
      if (d < bestDistance || (d === bestDistance && d <= max && w > bestWeight)) {
        best = candidate;
        bestDistance = d;
        bestWeight = w;
      }
    }
    if (best !== null && bestDistance <= max) return best;
    for (let cut = 3; cut <= token.length - 3; cut++) {
      const left = token.slice(0, cut);
      const right = token.slice(cut);
      if (this.postings.has(left) && this.postings.has(right)) return `${left} ${right}`;
    }
    return null;
  }

  /**
   * Un mot CONNU, mais seulement par des titres obscurs, à une lettre d'un mot
   * cent fois plus porteur : c'est presque toujours une faute. « interstelar »
   * est le titre d'un film de 2014 à deux votes — celui qui le tape cherche
   * « Interstellar ». Sans ce garde-fou, il suffisait qu'une recherche fasse
   * entrer ce titre obscur dans l'index pour que la faute cesse d'être corrigée.
   * Le titre tapé reste trouvable : la recherche complète interroge aussi la
   * requête telle quelle, et « Rechercher quand même » la rétablit.
   */
  dominantNeighbor(token: string): string | null {
    this.rebuild();
    if (token.length < 5 || /\d/.test(token)) return null;
    let best: string | null = null;
    let bestWeight = (this.vocabWeight.get(token) ?? 0) + DOMINANCE;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (candidate === token || Math.abs(candidate.length - token.length) > 1) continue;
      const weight = this.vocabWeight.get(candidate) ?? 0;
      if (weight < bestWeight || editDistance(token, candidate, 1) > 1) continue;
      best = candidate;
      bestWeight = weight;
    }
    return best;
  }

  private postingsOf(token: string, isLast: boolean): Set<number> {
    const out = new Set<number>(this.postings.get(token) ?? []);
    if (isLast) {
      for (const word of this.complete(token)) {
        for (const i of this.postings.get(word) ?? []) out.add(i);
      }
    }
    return out;
  }

  /**
   * Les titres dont les noms contiennent les mots de la requête — le dernier
   * pouvant être un début de mot. `allowFix` à faux : pas de correction.
   */
  lookup(tokens: readonly string[], limit = 200, allowFix = true): IndexLookup {
    const words = significantTokens(tokens);
    if (words.length === 0) return { hits: [], corrected: null, replacements: [] };
    const direct = this.match(words, limit);
    if (!allowFix) return { hits: direct, corrected: null, replacements: [] };
    const whole = direct.length > 0 && direct[0].matched === words.length;

    // Un mot inconnu se corrige — sauf le dernier s'il commence un mot connu
    // (frappe en cours), ou si tous les mots ont déjà trouvé. Un mot connu ne
    // cède qu'à un voisin qui l'écrase.
    const replacements: Array<[string, string]> = [];
    const fixed = words.flatMap((word, i) => {
      let fix: string | null = null;
      if (this.postings.has(word)) fix = this.dominantNeighbor(word);
      else if (!whole && !(i === words.length - 1 && this.complete(word).length > 0)) fix = this.correctToken(word);
      if (fix === null) return [word];
      replacements.push([word, fix]);
      return fix.split(" ");
    });
    if (replacements.length === 0) return { hits: direct, corrected: null, replacements: [] };
    const corrected = this.match(fixed, limit);
    if (corrected.length === 0 || corrected[0].matched < (direct[0]?.matched ?? 0)) {
      return { hits: direct, corrected: null, replacements: [] };
    }
    return { hits: corrected, corrected: fixed, replacements };
  }

  private match(words: readonly string[], limit: number): IndexHit[] {
    const sets = words.map((w, i) => this.postingsOf(w, i === words.length - 1));
    const counts = new Map<number, number>();
    for (const set of sets) for (const i of set) counts.set(i, (counts.get(i) ?? 0) + 1);
    const hits: IndexHit[] = [];
    // Tous les mots d'abord ; à défaut, les titres qui en couvrent le plus.
    const need = words.length === 1 ? 1 : Math.max(1, words.length - 1);
    for (const [i, matched] of counts) if (matched >= need) hits.push({ entry: this.list[i], matched });
    hits.sort((a, b) => b.matched - a.matched || entryWeight(b.entry) - entryWeight(a.entry));
    return hits.slice(0, limit);
  }

  /** Tout l'index — pour la persistance. */
  entries(): readonly TitleEntry[] {
    return this.list;
  }

  /** Repartir de zéro (la liste de blocage a changé). */
  clear(): void {
    this.list = [];
    this.byKey = new Map();
    this.postings = new Map();
    this.vocabWeight = new Map();
    this.sorted = [];
    this.byInitial = new Map();
    this.dirty = false;
  }
}
