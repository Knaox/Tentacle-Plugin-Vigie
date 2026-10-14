/* ------------------------------------------------------------------ */
/*  Vigie — Aucune mini-carte orpheline                                */
/* ------------------------------------------------------------------ */

/*
 * La page de Vigie est une iframe : quand le pointeur file de la mini-carte
 * vers la barre de Tentacle, rien ne garantit que la carte reçoive sa sortie
 * (au banc, une souris pilotée par CDP n'en envoie AUCUNE). Une bande-annonce
 * qui continuerait de jouer, avec le son, sans personne dessus : jamais.
 *
 * Le filet, posé le temps d'une session d'aperçu seulement :
 *   - le pointeur quitte le document (`mouseout` de la fenêtre sans
 *     `relatedTarget`), la fenêtre perd le focus, la page se cache → « away » :
 *     l'aperçu se ferme, et repart au prochain mouvement sur la carte ;
 *   - Échap → « escape » : fermé jusqu'à ce que le pointeur revienne sur la carte.
 */

export type PreviewExit = "away" | "escape";

interface VisibleDocument extends EventTarget {
  visibilityState?: string;
}

export function watchPreviewExits(win: EventTarget, doc: VisibleDocument, onExit: (kind: PreviewExit) => void): () => void {
  const onMouseOut = (e: Event) => {
    if ((e as MouseEvent).relatedTarget == null) onExit("away");
  };
  const onBlur = () => onExit("away");
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") onExit("away");
  };
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key === "Escape") onExit("escape");
  };
  win.addEventListener("mouseout", onMouseOut);
  win.addEventListener("blur", onBlur);
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("keydown", onKey);
  return () => {
    win.removeEventListener("mouseout", onMouseOut);
    win.removeEventListener("blur", onBlur);
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("keydown", onKey);
  };
}
