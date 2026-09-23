/* ------------------------------------------------------------------ */
/*  Vigie — La feuille : un panneau par-dessus la page                 */
/* ------------------------------------------------------------------ */

/*
 * Au téléphone, une feuille qui monte du bas (le pouce l'atteint, et le
 * geste « descendre pour fermer » est celui qu'on attend) ; sur un grand
 * écran, une fenêtre centrée. Échap, un clic à côté, ou la croix la ferment.
 *
 * Pendant qu'elle est ouverte, le corps de la page ne défile plus et l'hôte
 * voile sa propre barre (voir `useOverlay`, qui tient la pile des panneaux).
 */

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CHROME_BOTTOM } from "../../utils/host-chrome";
import { CloseIcon } from "./icons";
import { useOverlay } from "../../hooks/useOverlay";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Largeur maximale sur grand écran. */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  /** Pied fixe (boutons d'action) — toujours visible, même quand le contenu défile. */
  footer?: ReactNode;
}

const MAX = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" } as const;

export function Sheet({ open, onClose, title, size = "md", children, footer }: SheetProps) {
  const { t } = useTranslation("seer");
  const panel = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose);

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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      {/* Voile SOMBRE dans les deux thèmes : `bg-black` est inversé en clair
          par l'hôte, et un voile blanc ne détache rien. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(var(--scrim-media-rgb, 0, 0, 0), 0.62)", animation: "fadeIn 180ms ease both" }}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-tentacle-surface-modal shadow-tentacle-modal outline-none ring-1 ring-tentacle-border-subtle sm:max-h-[86vh] sm:rounded-3xl ${MAX[size]}`}
        style={{ animation: "fadeSlideUp 240ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-tentacle-fill-strong sm:hidden" aria-hidden />
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
            <h2 className="min-w-0 truncate text-lg font-bold text-tentacle-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("seer:close")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
          // Sans pied, la fin du contenu ne doit pas finir sous la barre de l'hôte.
          style={{ paddingBottom: footer ? "1.25rem" : `calc(1.25rem + env(safe-area-inset-bottom, 0px) + ${CHROME_BOTTOM})` }}
        >
          {children}
        </div>
        {footer && (
          <div
            className="shrink-0 border-t border-tentacle-border-subtle bg-tentacle-surface-modal px-5 pt-3"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px) + ${CHROME_BOTTOM})` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
