/* ------------------------------------------------------------------ */
/*  Vigie — Glisser une feuille vers le bas pour la fermer              */
/* ------------------------------------------------------------------ */

/*
 * Au téléphone, une feuille qui monte du bas se referme du même geste qu'on
 * attend partout : la tirer vers le bas. Sa poignée le promettait sans le
 * tenir.
 *
 * Le geste ne se prend que depuis la poignée ou l'en-tête (`data-sheet-grip`),
 * ou depuis un contenu DÉJÀ en haut de son défilement : ailleurs, descendre
 * fait défiler, comme avant. Et il se décide au PREMIER mouvement du doigt —
 * WebKit ne laisse plus annuler un défilement une fois commencé : attendre
 * quelques pixels, c'est laisser la page partir avec le geste.
 *
 * Tout passe par `transform` et `opacity`, sur le panneau et son voile (règle
 * GPU du projet). Rien au-delà de 640 px : là, la feuille est une fenêtre.
 */

import { useEffect, useRef, type RefObject } from "react";

const PHONE = "(max-width: 639px)";
/** Au-delà de cette distance (ou d'un tiers du panneau), lâcher ferme. */
const CLOSE_DISTANCE = 140;
/** Un jet rapide ferme, même court (px/ms). */
const CLOSE_VELOCITY = 0.5;
const SETTLE = "220ms cubic-bezier(0.22,1,0.36,1)";

interface Options {
  /** Le panneau, qui suit le doigt. */
  panel: RefObject<HTMLElement | null>;
  /** Ce qui défile dans le panneau (le panneau lui-même s'il défile). */
  scroller?: RefObject<HTMLElement | null>;
  /** Le voile, qui s'éclaircit à mesure qu'on tire. */
  scrim?: RefObject<HTMLElement | null>;
  /** Appelé une fois la feuille sortie de l'écran. */
  onDismiss: () => void;
  enabled?: boolean;
}

export function useSheetSwipe({ panel, scroller, scrim, onDismiss, enabled = true }: Options): void {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const el = panel.current;
    if (!enabled || !el || !window.matchMedia?.(PHONE).matches) return;

    let state: "idle" | "pending" | "drag" | "pass" = "idle";
    let startX = 0, startY = 0, lastY = 0, lastT = 0, velocity = 0;
    let fromGrip = false;

    const veil = () => scrim?.current ?? null;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { state = "pass"; return; }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = lastY = touch.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      fromGrip = e.target instanceof Element && e.target.closest("[data-sheet-grip]") !== null;
      state = "pending";
    };

    const onMove = (e: TouchEvent) => {
      if (state === "idle" || state === "pass") return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (state === "pending") {
        const scrollTop = scroller?.current?.scrollTop ?? 0;
        if (dy > 0 && dy >= Math.abs(dx) && (fromGrip || scrollTop <= 0)) {
          state = "drag";
          // L'entrée (`animation … both`) garde son transform final : elle
          // écraserait celui du doigt.
          el.style.animation = "none";
          el.style.transition = "none";
          const v = veil();
          if (v) { v.style.animation = "none"; v.style.transition = "none"; }
        } else {
          state = "pass";
          return;
        }
      }
      e.preventDefault();
      velocity = (touch.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = touch.clientY;
      lastT = e.timeStamp;
      const offset = Math.max(0, dy);
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
      const v = veil();
      if (v) v.style.opacity = String(Math.max(0, 1 - offset / (el.offsetHeight || 1)));
    };

    const onEnd = () => {
      if (state !== "drag") { state = "idle"; return; }
      state = "idle";
      const offset = Math.max(0, lastY - startY);
      const height = el.offsetHeight || 1;
      const v = veil();
      el.style.transition = `transform ${SETTLE}`;
      if (v) v.style.transition = "opacity 220ms ease";
      if (offset > Math.min(CLOSE_DISTANCE, height / 3) || velocity > CLOSE_VELOCITY) {
        el.style.transform = `translate3d(0, ${height}px, 0)`;
        if (v) v.style.opacity = "0";
        window.setTimeout(() => dismiss.current(), 200);
      } else {
        el.style.transform = "";
        if (v) v.style.opacity = "";
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, panel, scroller, scrim]);
}
