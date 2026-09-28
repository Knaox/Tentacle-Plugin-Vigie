/* ------------------------------------------------------------------ */
/*  Vigie — Les étoiles de saisie (sa note, sur cinq, à la demi-étoile) */
/* ------------------------------------------------------------------ */

/*
 * Le jumeau des étoiles des cartes de Tentacle (`StarRating`) : cinq étoiles,
 * dix niveaux, note interne 1..10 — jamais 0. Survol = aperçu, clic = note,
 * re-clic sur la même valeur = retrait. Chaque étoile porte deux moitiés
 * cliquables, ce qui donne aussi les dix valeurs au clavier. Seules
 * l'opacité (remplissage) et la transformation (survol) s'animent.
 *
 * `onMedia` : posées sur une affiche — contour blanc et ombre portée
 * statiques, lisibles sur une image claire comme sur une sombre.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";

const SIZE = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" } as const;

const STAR = "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z";

function StarGlyph({ className, outline, clip }: { className: string; outline?: boolean; clip?: "left" | "right" }) {
  // clip-path STATIQUE : la moitié gauche et la moitié droite du glyphe plein,
  // dont seule l'opacité varie.
  const style = clip === "left" ? { clipPath: "inset(0 50% 0 0)" } : clip === "right" ? { clipPath: "inset(0 0 0 50%)" } : undefined;
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill={outline ? "none" : "currentColor"}
      stroke={outline ? "currentColor" : "none"} strokeWidth={outline ? 1.5 : 0} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={STAR} />
    </svg>
  );
}

export function StarsInput({ value, onRate, onClear, size = "sm", tone = "themed" }: {
  /** Sa note 1..10, `null` : pas notée. */
  value: number | null;
  onRate: (score: number) => void;
  onClear: () => void;
  size?: keyof typeof SIZE;
  tone?: "themed" | "onMedia";
}) {
  const { t } = useTranslation("seer");
  const [hovered, setHovered] = useState<number | null>(null);
  const displayed = hovered ?? value ?? 0;
  const box = SIZE[size];
  // Sur une affiche : le blanc CONSTANT des médias (`white` suit le thème dans ce cadre).
  const outline = tone === "onMedia" ? "text-tentacle-on-media-secondary" : "text-tentacle-text-tertiary opacity-40";
  const shadow = tone === "onMedia" ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" : "";
  const pick = (score: number) => (value === score ? onClear() : onRate(score));

  return (
    <div role="group" aria-label={t("seer:gestureYourRating")} className="flex items-center" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fraction = Math.min(Math.max(displayed - (star - 1) * 2, 0), 2) / 2;
        const lifted = hovered !== null && Math.ceil(hovered / 2) === star;
        return (
          <span key={star} className={`relative ${box} ${shadow} transition-transform duration-150 ${lifted ? "scale-110" : ""}`}>
            <StarGlyph className={`absolute inset-0 ${box} ${outline}`} outline />
            <StarGlyph
              className={`absolute inset-0 ${box} text-[var(--brand-accent)] transition-opacity duration-150 ${fraction >= 0.5 ? "opacity-100" : "opacity-0"}`}
              clip="left"
            />
            <StarGlyph
              className={`absolute inset-0 ${box} text-[var(--brand-accent)] transition-opacity duration-150 ${fraction === 1 ? "opacity-100" : "opacity-0"}`}
              clip="right"
            />
            {([star * 2 - 1, star * 2] as const).map((score, half) => {
              const current = value === score;
              const label = current ? t("seer:gestureRemoveRatingAria", { score }) : t("seer:gestureRateAria", { score });
              return (
                <button
                  key={score}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={current}
                  onMouseEnter={() => setHovered(score)}
                  onFocus={() => setHovered(score)}
                  onBlur={() => setHovered(null)}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); pick(score); }}
                  className={`absolute inset-y-0 w-1/2 ${half === 0 ? "left-0" : "right-0"} focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)]`}
                />
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
