import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CTA_PRIMARY } from "../../styles/cta";
import { ICON_BUTTON } from "../../styles/pills";
import { CHROME_BOTTOM } from "../../utils/host-chrome";
import { useOverlay } from "../../hooks/useOverlay";
import { useSheetSwipe } from "../../hooks/useSheetSwipe";
import { CloseIcon } from "../ui/icons";

/**
 * La coquille d'un panneau de filtres : voile, panneau, en-tête, pied.
 *
 * Au téléphone, une feuille qui MONTE du bas — le pouce l'atteint, et son pied
 * se pose au-dessus de la barre d'onglets de l'application (la barre flotte
 * sur le cadre du plugin : sans cette réserve, « Voir les résultats » passait
 * dessous). Sur grand écran, un tiroir à droite : la grille reste visible à
 * côté des filtres qu'on règle.
 *
 * Aucun flou : le panneau est opaque à 96 %, flouter ce qu'il couvre ne se
 * verrait pas et coûterait une passe de composition (règle GPU du projet).
 *
 * Extraite pour que l'agenda des sorties hérite du même comportement —
 * verrouillage de la surcouche de l'hôte, fermeture à l'échappement, et au
 * téléphone la feuille qu'on tire vers le bas pour la fermer. Pendant qu'elle
 * est ouverte, la page dessous ne défile plus (elle défilait sous le doigt).
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Nombre de familles de filtres actives — pastille d'en-tête. */
  activeCount: number;
  onReset: () => void;
  /** Libellé du bouton de sortie ; à défaut, « Appliquer ». */
  footerLabel?: string;
  children: ReactNode;
}

export function FilterSheet({
  open, onClose, title, activeCount, onReset, footerLabel, children,
}: Props) {
  const { t } = useTranslation("seer");
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);

  useOverlay(open, onClose);
  useSheetSwipe({ panel, scroller: body, scrim, onDismiss: onClose, enabled: open });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-stretch sm:justify-end" role="presentation">
      {/* Voile SOMBRE dans les deux thèmes : `bg-black` est inversé en clair par l'hôte. */}
      <div
        ref={scrim}
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(var(--scrim-media-rgb, 0, 0, 0), 0.6)", animation: "fadeIn 200ms ease both" }}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-tentacle-surface-modal shadow-tentacle-modal outline-none ring-1 ring-tentacle-border-subtle sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl max-sm:[background:linear-gradient(var(--surface-modal),var(--surface-modal)),var(--surface-0)]"
        style={{ animation: "vigieSheetIn 280ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div data-sheet-grip className="flex h-5 shrink-0 items-end justify-center sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-tentacle-fill-strong" />
        </div>
        <div data-sheet-grip className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-lg font-bold text-tentacle-text-primary">{title}</h3>
            {activeCount > 0 && (
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-xs font-bold tabular-nums text-white">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="min-h-[36px] rounded-full px-3 text-[13px] font-semibold text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
              >
                {t("resetFilters")}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t("seer:close")} className={ICON_BUTTON}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-tentacle-border-subtle px-5">
          {children}
        </div>

        {/* Pied collant, au-dessus de la barre de l'application (CHROME_BOTTOM). */}
        <div
          className="shrink-0 border-t border-tentacle-border-subtle px-5 pt-3"
          style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px) + ${CHROME_BOTTOM})` }}
        >
          <button type="button" onClick={onClose} className={`${CTA_PRIMARY} h-12 w-full`}>
            {footerLabel ?? t("filterApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
