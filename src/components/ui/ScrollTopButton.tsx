/* ------------------------------------------------------------------ */
/*  Vigie — Revenir en haut d'une longue page                          */
/* ------------------------------------------------------------------ */

/*
 * Après un long défilement (un écran et demi), un bouton rond apparaît en bas
 * à droite, au-dessus de la barre d'onglets de l'application : un toucher
 * remonte en haut de la page. Il n'existe que là où l'on a vraiment défilé —
 * le Catalogue d'abord, mais aussi Découvrir, Mes demandes ou une recherche.
 *
 * Écoute passive, un calcul par image au plus, et l'état ne change qu'au
 * franchissement du seuil. Fondu et glissement en `opacity` / `transform`
 * seulement (règle GPU du projet) ; caché, il ne capte rien.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHROME_BOTTOM } from "../../utils/host-chrome";
import { ArrowUpIcon } from "./icons";

/** En écrans de défilement : au-delà, le bouton se montre. */
const THRESHOLD_SCREENS = 1.5;

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function ScrollTopButton() {
  const { t } = useTranslation("seer");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight * THRESHOLD_SCREENS);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })}
      aria-label={t("seer:scrollToTop")}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={`fixed right-4 z-[35] flex h-12 w-12 items-center justify-center rounded-full bg-tentacle-surface-2 text-tentacle-text-primary shadow-tentacle-modal ring-1 ring-tentacle-border-strong transition-[opacity,transform] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)] md:right-8 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
      style={{ bottom: `calc(1rem + ${CHROME_BOTTOM})` }}
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
}
