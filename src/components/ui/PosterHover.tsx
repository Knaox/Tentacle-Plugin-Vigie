/* ------------------------------------------------------------------ */
/*  Vigie — Le survol d'une affiche                                    */
/* ------------------------------------------------------------------ */

/*
 * Le MÊME survol que les cartes de Tentacle (`CardHoverShell` du cœur) : un
 * titre se lit pareil ici, sur la recherche ou sur les recommandations.
 *
 *   1. un voile qui assombrit l'affiche par le bas ;
 *   2. au centre, l'action primaire, seule en couleur — « Demander », « Choisir
 *      les saisons », ou « Regarder » pour un titre déjà là ;
 *   3. en bas, les étoiles (sa note), puis la capsule : « Ma liste » — tout de
 *      suite, ou à son arrivée pour un titre absent.
 *
 * Posé sur MÉDIA : couleurs constantes des médias (`white` suit le thème dans
 * ce cadre), pas de flou — le voile est presque opaque en bas, il n'y aurait
 * rien à flouter. Monté au survol seulement, par l'appelant ; les fondus ne
 * touchent que l'opacité et la transformation (classes `vg-hover-*`, cf.
 * plugin.tsx).
 */

import type { KeyboardEvent, MouseEvent } from "react";
import type { PosterGestures } from "../../hooks/usePosterGestures";
import { StarsInput } from "./StarsInput";
import { BookmarkIcon, BookmarkOutlineIcon, PlayIcon, PlusIcon } from "./icons";

/* Le voile des cartes de Tentacle (`--card-hover-veil`) : noir dans les deux thèmes. */
const VEIL = "linear-gradient(180deg, rgba(var(--scrim-media-rgb, 0, 0, 0), 0.1) 0%, rgba(var(--scrim-media-rgb, 0, 0, 0), 0.3) 38%, rgba(var(--scrim-media-rgb, 0, 0, 0), 0.9) 100%)";

/** Un geste du calque ne doit jamais ouvrir la fiche (le clic de la carte). */
function stop(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}

export function PosterHover({ gestures, name, visible, band }: {
  gestures: PosterGestures;
  /** Le titre, lu par les lecteurs d'écran. */
  name: string;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** Un bandeau d'état au pied de l'affiche : le calque s'arrête au-dessus, il reste lisible. */
  band: boolean;
}) {
  const { primary, watchlist, rating } = gestures;
  // Entrée/Espace sur un bouton du calque ne remontent pas à la carte.
  const stopKeys = (e: KeyboardEvent) => e.stopPropagation();

  return (
    // La géométrie de l'affiche, moins son bandeau d'état (h-6) quand il y en a un.
    <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3]">
      <div
        className={`vg-hover absolute inset-x-0 top-0 overflow-hidden ${band ? "bottom-6 rounded-t-xl" : "bottom-0 rounded-xl"}`}
        data-shown={visible}
        onKeyDown={stopKeys}
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: VEIL }} />

        {primary && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* L'entrée sur une enveloppe : le ressort du bouton écrit sa propre transformation. */}
            <div className="vg-hover-pop pointer-events-auto" data-shown={visible}>
              <button
                type="button"
                onClick={(e) => { stop(e); primary.run(); }}
                aria-label={`${primary.label} — ${name}`}
                title={primary.label}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-tentacle-cta-brand-fg shadow-[0_8px_24px_rgba(var(--brand-rgb),0.45)] ring-1 ring-[rgba(255,255,255,0.25)] transition-transform duration-150 hover:scale-[1.08] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fff]"
              >
                {primary.kind === "watch" ? <PlayIcon className="ml-0.5 h-5 w-5" /> : <PlusIcon className="h-6 w-6" />}
              </button>
            </div>
          </div>
        )}

        <div className="vg-hover-rise absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-1.5 px-2 pb-2.5" data-shown={visible}>
          <div className="flex justify-center" onClick={stop}>
            <StarsInput value={rating.value} onRate={rating.rate} onClear={rating.clear} size="sm" tone="onMedia" />
          </div>
          <div className="flex justify-center">
            <div
              role="toolbar"
              aria-label={name}
              onClick={stop}
              className="flex items-center gap-0.5 rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.12)] p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                onClick={(e) => { stop(e); watchlist.toggle(); }}
                aria-label={watchlist.label}
                aria-pressed={watchlist.active}
                title={watchlist.label}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fff] ${
                  watchlist.active
                    ? "bg-[rgba(255,255,255,0.15)] text-tentacle-on-media-primary"
                    : "text-tentacle-on-media-secondary hover:bg-[rgba(255,255,255,0.1)] hover:text-tentacle-on-media-primary"
                }`}
              >
                {watchlist.active ? <BookmarkIcon className="h-3.5 w-3.5" /> : <BookmarkOutlineIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
