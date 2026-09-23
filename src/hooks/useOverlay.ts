/* ------------------------------------------------------------------ */
/*  Vigie — La pile des panneaux ouverts                               */
/* ------------------------------------------------------------------ */

/*
 * Fiche, filmographie, filtres, bande-annonce : ces panneaux s'empilent (la
 * filmographie s'ouvre depuis le casting d'une fiche, la bande-annonce depuis
 * la fiche). Deux choses ne se décident donc qu'à l'échelle de la pile,
 * jamais d'un panneau seul :
 *
 *   - le voile de l'hôte (`setOverlay`) se lève au premier panneau et ne
 *     retombe qu'au dernier. Chaque panneau le gérait seul : fermer la
 *     filmographie le retirait alors que la fiche restait ouverte, et la
 *     barre de l'hôte redevenait vive et cliquable au-dessus du voile ;
 *   - Échap ferme le panneau du DESSUS, et lui seul. Chacun écoutait le
 *     document : un seul appui les fermait tous d'un coup.
 */

import { useEffect, useRef } from "react";

interface Entry {
  onEscape: () => void;
}

const stack: Entry[] = [];

function hostOverlay(open: boolean): void {
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { setOverlay?: (open: boolean) => void } | undefined;
  bridge?.setOverlay?.(open);
}

// En capture : Échap est pris avant tout autre écouteur (champ de recherche compris).
function onKey(e: KeyboardEvent): void {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  stack[stack.length - 1].onEscape();
}

/** Ajoute un panneau à la pile ; la fonction rendue l'en retire. */
export function pushOverlay(onEscape: () => void): () => void {
  const entry: Entry = { onEscape };
  stack.push(entry);
  if (stack.length === 1) {
    hostOverlay(true);
    document.addEventListener("keydown", onKey, true);
  }
  return () => {
    const at = stack.indexOf(entry);
    if (at < 0) return;
    stack.splice(at, 1);
    if (stack.length === 0) {
      hostOverlay(false);
      document.removeEventListener("keydown", onKey, true);
    }
  };
}

/** Le panneau est dans la pile tant que `open` est vrai ; Échap appelle `onEscape`. */
export function useOverlay(open: boolean, onEscape: () => void): void {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    if (!open) return;
    return pushOverlay(() => latest.current());
  }, [open]);
}
