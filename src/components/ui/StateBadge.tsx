/* ------------------------------------------------------------------ */
/*  Vigie — Le badge d'état : demandé, en route, importation, bloqué… */
/* ------------------------------------------------------------------ */

/*
 * UN dessin par état, partout — affiche, calendrier, demandes, fiche : la
 * même couleur, la même icône, le même mot. La couleur n'est jamais seule
 * (icône + mot), et elle ne dit que l'état : le reste de Vigie est neutre.
 *
 * Quatre variantes :
 *   - `band`  : bandeau au pied d'une affiche, sur une plaque presque opaque —
 *     aucune affiche ne peut plus avaler la couleur de l'état ; son filet
 *     supérieur est la barre d'avancement de ce qui arrive ;
 *   - `media` : pastille posée sur une image (en-tête de fiche) ;
 *   - `chip`  : pastille teintée, sur les surfaces de la page ;
 *   - `text`  : icône et mot, dans une ligne de texte.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TitleState, TitleStatus } from "../../utils/title-state";
import { stateLabel } from "../../utils/state-labels";
import { AlertIcon, ArrowDownIcon, CheckIcon, ClockIcon, HalfCircleIcon, InboxInIcon } from "./icons";

const ICON: Record<TitleState, (p: { className?: string }) => ReactNode> = {
  requested: ClockIcon,
  downloading: ArrowDownIcon,
  importing: InboxInIcon,
  stalled: AlertIcon,
  available: CheckIcon,
  partial: HalfCircleIcon,
};

export type StateBadgeVariant = "band" | "media" | "chip" | "text";

interface Props {
  status: TitleStatus;
  variant?: StateBadgeVariant;
  className?: string;
}

export const StateBadge = memo(function StateBadge({ status, variant = "chip", className = "" }: Props) {
  const { t } = useTranslation("seer");
  const { state, percent } = status;
  const Icon = ICON[state];
  const known = state === "downloading" && percent != null;
  const pct = known ? Math.floor(percent as number) : null;

  if (variant === "band") {
    // Étroit : « 45 % » suffit à côté de la flèche et du filet qui avance.
    const label = pct !== null ? t("seer:stPercent", { percent: pct }) : stateLabel(state, t, "short");
    const tone = `var(--vg-media-${state})`;
    return (
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center gap-1 px-2 text-[11px] font-bold leading-none ${className}`}
        style={{ background: "var(--vg-plate)", color: tone }}
      >
        <span className="absolute inset-x-0 top-0 h-[2px] opacity-30" style={{ background: tone }} />
        {/* Une transformation, jamais une largeur : rien ne se repeint (règle GPU). */}
        <span
          className="absolute inset-x-0 top-0 h-[2px] origin-left"
          style={{ background: tone, transform: `scaleX(${pct !== null ? Math.max(0.04, pct / 100) : 1})`, transition: "transform 700ms ease" }}
        />
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </span>
    );
  }

  const label = pct !== null ? `${stateLabel(state, t)} · ${t("seer:stPercent", { percent: pct })}` : stateLabel(state, t);

  if (variant === "media") {
    return (
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${className}`}
        style={{
          background: "var(--vg-plate)",
          color: `var(--vg-media-${state})`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--vg-media-${state}) 45%, transparent)`,
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </span>
    );
  }

  if (variant === "text") {
    return (
      <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold ${className}`} style={{ color: `var(--vg-${state}-fg)` }}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ background: `var(--vg-${state}-bg)`, color: `var(--vg-${state}-fg)` }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
});
