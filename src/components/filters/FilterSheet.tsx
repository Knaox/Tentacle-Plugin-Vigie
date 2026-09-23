import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CTA_PRIMARY } from "../../styles/cta";
import { ICON_BUTTON } from "../../styles/pills";
import { CHROME_BOTTOM } from "../../utils/host-chrome";
import { useOverlay } from "../../hooks/useOverlay";

/**
 * La coquille d'un panneau de filtres : voile, tiroir, en-tête, pied.
 *
 * Extraite du panneau du catalogue pour que l'agenda des sorties hérite du même
 * comportement — verrouillage de la surcouche de l'hôte, fermeture à
 * l'échappement, bouton de sortie sous le pouce — plutôt que d'en réécrire une
 * variante qui divergerait au premier correctif.
 *
 * Le contenu, lui, reste propre à chaque page : les familles de filtres du
 * catalogue n'ont rien à voir avec celles de l'agenda.
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

  useOverlay(open, onClose);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "fadeIn 300ms ease forwards",
          }}
        />
      )}

      <div
        className={`fixed right-0 top-0 flex h-full w-full max-w-sm flex-col bg-tentacle-surface-modal transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          zIndex: 101,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5), -2px 0 8px rgba(0,0,0,0.3)",
          borderLeft: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between border-b border-tentacle-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-tentacle-text-primary">{title}</h3>
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tentacle-brand text-[10px] font-bold text-tentacle-cta-brand-fg">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <button onClick={onReset} className="text-xs text-tentacle-brand hover:text-tentacle-brand-light">
                {t("resetFilters")}
              </button>
            )}
            {/* ICON_BUTTON plutôt qu'un carré de 28 px : c'est la cible que le
                plugin s'impose partout ailleurs, et elle se vise vraiment. */}
            <button onClick={onClose} aria-label={t("seer:cancel")} className={ICON_BUTTON}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--brand) transparent" }}
        >
          {children}
        </div>

        {/* Pied collant — le bouton de sortie reste sous le pouce, quelle que
            soit la longueur du panneau.

            La réserve basse n'est pas cosmétique : sur l'application mobile, la
            barre d'onglets flotte au-dessus du cadre du plugin et recouvrait
            ce bouton entièrement. Le fond du panneau, lui, continue de courir
            derrière le verre — seul le contenu remonte. */}
        <div
          className="border-t border-tentacle-border-subtle px-5 pt-3"
          style={{ paddingBottom: `calc(0.75rem + ${CHROME_BOTTOM})` }}
        >
          <button onClick={onClose} className={`${CTA_PRIMARY} h-11 w-full`}>
            {footerLabel ?? t("filterApply")}
          </button>
        </div>
      </div>
    </>
  );
}
