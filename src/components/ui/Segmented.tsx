/* ------------------------------------------------------------------ */
/*  Vigie — Le sélecteur segmenté                                      */
/* ------------------------------------------------------------------ */

/*
 * Films / Séries / Animés, Semaine / Liste / Mois, Mes demandes / Tout le
 * serveur : un seul dessin pour tous les choix exclusifs. Le segment choisi
 * se SOULÈVE (surface claire, ombre courte) au lieu de se teinter : il se lit
 * même sans couleur, et le violet reste aux actions.
 *
 * Cibles de 40 px (36 en compact), texte à 14 px : on vise au pouce comme à
 * la souris. `stretch` partage toute la largeur en segments égaux — `mobile` :
 * seulement au téléphone (trois segments plutôt qu'une pilule tassée à
 * gauche), à sa taille naturelle au-delà, où rien ne doit se tronquer.
 */

import type { ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Libellé du téléphone, quand le complet ne tient pas en trois segments. */
  short?: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  /** Occupe toute la largeur, segments égaux — toujours, ou au téléphone seulement. */
  stretch?: "always" | "mobile";
  className?: string;
}

const SIZE = {
  md: "h-10 px-4 text-sm",
  sm: "h-9 px-3 text-[13px]",
} as const;

const CONTAINER = {
  always: "flex w-full",
  mobile: "flex w-full sm:inline-flex sm:w-auto sm:max-w-full",
  none: "inline-flex max-w-full",
} as const;

const SEGMENT = { always: "flex-1", mobile: "flex-1 sm:flex-none", none: "" } as const;

export function Segmented<T extends string>({ value, options, onChange, ariaLabel, size = "md", stretch, className = "" }: Props<T>) {
  const mode = stretch ?? "none";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`${CONTAINER[mode]} items-center gap-1 overflow-x-auto rounded-full bg-tentacle-fill-subtle p-1 ring-1 ring-tentacle-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.short ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${SIZE[size]} ${SEGMENT[mode]} ${
              selected
                ? "bg-[var(--vg-raised)] text-tentacle-text-primary shadow-[var(--elev-1)] ring-1 ring-[var(--vg-raised-ring)]"
                : "text-tentacle-text-tertiary hover:text-tentacle-text-primary"
            }`}
          >
            {option.icon && <span className={`shrink-0 ${selected ? "text-[var(--brand-light)]" : ""}`}>{option.icon}</span>}
            {option.short ? (
              <>
                <span className="truncate sm:hidden">{option.short}</span>
                <span className="hidden truncate sm:inline">{option.label}</span>
              </>
            ) : (
              <span className="truncate">{option.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
