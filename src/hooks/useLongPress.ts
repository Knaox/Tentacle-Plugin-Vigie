/* ------------------------------------------------------------------ */
/*  Vigie — L'appui long, au doigt                                     */
/* ------------------------------------------------------------------ */

/*
 * Au doigt, pas de survol : c'est l'appui long qui ouvre les gestes d'une
 * affiche (la feuille), comme sur les cartes de Tentacle. Un appui qui glisse
 * (on fait défiler la rangée) n'en est pas un, et le toucher qui suit un
 * appui long n'ouvre pas la fiche. La souris n'est jamais concernée.
 */

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const HOLD_MS = 480;
/** Au-delà, le doigt défile : ce n'est plus un appui. */
const SLOP_PX = 10;

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse") return;
      cancel();
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        navigator.vibrate?.(10);
        latest.current();
      }, HOLD_MS);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Le menu du système (« Enregistrer l'image »…) ne double pas la feuille.
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (fired.current || timer.current !== null) e.preventDefault();
    },
    /** Au clic : vrai s'il suit un appui long — à ignorer, la feuille est ouverte. */
    consumeClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
