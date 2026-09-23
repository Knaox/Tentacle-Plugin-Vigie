/* ------------------------------------------------------------------ */
/*  Vigie — Pliage du texte et distance d'édition                      */
/* ------------------------------------------------------------------ */

/*
 * Tout ce que le moteur compare passe par ici : « Le Seigneur des Anneaux »,
 * « le seigneur des anneaux » et « Le Seigneur des anneaux : » doivent se
 * reconnaître, et une apostrophe ou un tiret ne doivent jamais empêcher une
 * correspondance (« Spider-Man » / « spider man », « L'Âge de glace »).
 */

/* Les ligatures ne se décomposent pas en NFD : « œuvre » resterait « œuvre ». */
const LIGATURES: Record<string, string> = {
  "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d",
};

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function foldText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[œæßøłđ]/g, (c) => LIGATURES[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Les mots pliés d'un texte. */
export function tokenize(input: string): string[] {
  const folded = foldText(input);
  return folded === "" ? [] : folded.split(" ");
}

/*
 * Les mots qui ne départagent rien. Ils comptent pour une égalité exacte
 * (« Les Évadés » n'est pas « Évadés »), jamais pour exiger une correspondance :
 * chercher « seigneur anneaux » doit trouver « Le Seigneur des anneaux ».
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "et",
  "the", "a", "an", "of", "and", "in", "on",
]);

/** Les mots qui portent le sens de la requête — tous, si elle n'a que des mots vides. */
export function significantTokens(tokens: readonly string[]): string[] {
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  return kept.length > 0 ? kept : [...tokens];
}

/* Les élisions : « d'une », « l'enfer », « qu'il ». */
const ELIDED = new Set(["d", "l", "j", "m", "n", "s", "t", "c", "qu"]);

/**
 * Les formes d'un nom plié sous lesquelles on peut le taper : lui-même, et
 * recollé à l'élision de tête — « L'Ours » se tape aussi « lours », comme
 * TMDB le comprend. Sans cette forme, « lours » devenait « loups ».
 */
export function nameForms(folded: string): string[] {
  const space = folded.indexOf(" ");
  if (space < 0 || !ELIDED.has(folded.slice(0, space))) return [folded];
  return [folded, folded.slice(0, space) + folded.slice(space + 1)];
}

/**
 * TMDB lit « d'une » comme « dune » : chercher Dune ramenait « Anatomie d'une
 * chute » ou « La Vengeance d'une femme ». Vrai quand un mot de la requête
 * n'apparaît dans un nom QUE recollé à une élision, ailleurs qu'en tête — en
 * tête (« lours » pour « L'Ours »), c'est bien le titre qu'on a tapé.
 */
export function onlyThroughElision(names: readonly string[], tokens: readonly string[]): boolean {
  return names.some((name) => {
    const words = name.split(" ");
    for (let i = 1; i < words.length - 1; i++) {
      if (ELIDED.has(words[i]) && tokens.includes(words[i] + words[i + 1])) return true;
    }
    return false;
  });
}

/**
 * Distance de Damerau (alignement optimal) BORNÉE : au-delà de `max`, la
 * valeur exacte n'intéresse personne et le calcul s'arrête — `max + 1` est
 * rendu. C'est ce qui permet de balayer tout un vocabulaire à chaque frappe.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0 || lb === 0) return Math.max(la, lb) > max ? max + 1 : Math.max(la, lb);

  let before = new Array<number>(lb + 1).fill(0);
  let previous = Array.from({ length: lb + 1 }, (_, j) => j);
  let current = new Array<number>(lb + 1).fill(0);

  for (let i = 1; i <= la; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      // Deux lettres inversées ne coûtent qu'une faute : « intersetllar ».
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[lb] > max ? max + 1 : previous[lb];
}
