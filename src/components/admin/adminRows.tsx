/* ------------------------------------------------------------------ */
/*  Vigie — Réglages en liste : groupes et lignes                       */
/* ------------------------------------------------------------------ */

/*
 * Le motif des Réglages de Tentacle (et d'iOS) : des lignes groupées, une
 * icône, un intitulé, ce qu'il vaut, et le geste au bout — un interrupteur,
 * un compteur, ou un chevron qui ouvre la fenêtre d'édition. On lit l'état
 * de tout d'un coup d'œil ; on n'édite qu'une chose à la fois.
 */

import type { ReactNode } from "react";
import { ChevronRight, CompassIcon } from "../ui/icons";

export function Group({ title, caption, children }: { title: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">{title}</h2>
      <div className="divide-y divide-tentacle-border-subtle overflow-hidden rounded-2xl bg-tentacle-fill-subtle ring-1 ring-tentacle-border-subtle">
        {children}
      </div>
      {caption && <p className="mt-2 px-1 text-[13px] leading-relaxed text-tentacle-text-tertiary">{caption}</p>}
    </section>
  );
}

const ICON_TILE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--brand-rgb),0.16)] text-[var(--brand-light)]";

export function Row({ icon, title, description, trailing, onClick, ariaLabel }: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
  /** Présent : toute la ligne ouvre l'édition (chevron au bout). */
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <span aria-hidden className={ICON_TILE}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-tentacle-text-primary">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-tentacle-text-tertiary">{description}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-tentacle-text-quaternary" />}
    </>
  );
  const layout = "flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left";
  if (!onClick) return <div className={layout}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${layout} transition-colors hover:bg-tentacle-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-rgb),0.6)]`}
    >
      {body}
    </button>
  );
}

/** L'onglet tel que la barre de Tentacle le dessine : une pilule, la boussole, le nom. */
export function NavLabelPill({ label, size = "md" }: { label: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-tentacle-surface-2 font-semibold text-tentacle-text-primary ring-1 ring-tentacle-border-strong ${
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm"
      }`}
    >
      <CompassIcon className="h-4 w-4 shrink-0 text-[var(--brand-light)]" />
      <span className="truncate">{label}</span>
    </span>
  );
}
