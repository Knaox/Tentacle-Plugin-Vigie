/* ------------------------------------------------------------------ */
/*  Vigie — Les noms de l'onglet, par langue                            */
/* ------------------------------------------------------------------ */

/* Même règles que le serveur (server/nav-label.ts) : une langue laissée
 * vide prend le nom de l'autre, puis « Vigie » ; 24 caractères au plus. */

export const DEFAULT_NAV_LABEL = "Vigie";
export const NAV_LABEL_MAX = 24;

export interface NavLabels {
  fr: string;
  en: string;
}

export function shownLabels(labels: NavLabels): NavLabels {
  const fr = labels.fr.trim();
  const en = labels.en.trim();
  return { fr: fr || en || DEFAULT_NAV_LABEL, en: en || fr || DEFAULT_NAV_LABEL };
}

/** Le nom que voit un utilisateur dans sa langue (le français pour « fr-* », l'anglais sinon). */
export function labelFor(labels: NavLabels, lang: string): string {
  const shown = shownLabels(labels);
  return lang.toLowerCase().startsWith("fr") ? shown.fr : shown.en;
}

/** Des noms qui disent ce qu'on vient faire : demander ce qui n'est pas encore là. */
export const LABEL_SUGGESTIONS: readonly NavLabels[] = [
  { fr: "Demander", en: "Request" },
  { fr: "Ajouter", en: "Add" },
  { fr: "Envies", en: "Wishes" },
  { fr: "Vigie", en: "Vigie" },
];
