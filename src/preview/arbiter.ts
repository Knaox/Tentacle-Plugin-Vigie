/* ------------------------------------------------------------------ */
/*  Vigie — Un seul aperçu à la fois                                   */
/* ------------------------------------------------------------------ */

/*
 * Deux affiches peuvent se croire survolées ensemble — le pointeur sur l'une,
 * le focus clavier sur l'autre, une mini-carte encore en fondu quand la
 * suivante démarre —, jamais deux bandes-annonces ne jouent ni ne se chargent
 * en même temps : la plus récente prend la place, la précédente est évincée
 * (`previewArbiter.ts` du cœur).
 */

let occupant: { holder: symbol; onPreempt: () => void } | null = null;

/** Prend la place ; rend sa libération (sans effet pour un évincé). */
export function attachArbiter(onPreempt: () => void): () => void {
  const holder = Symbol("vigie-preview");
  const previous = occupant;
  occupant = { holder, onPreempt };
  previous?.onPreempt();
  return () => {
    if (occupant?.holder === holder) occupant = null;
  };
}
