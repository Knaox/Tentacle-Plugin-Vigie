/* ------------------------------------------------------------------ */
/*  Vigie — Les briques de la page d'administration                     */
/* ------------------------------------------------------------------ */

/*
 * La page mélangeait trois dessins de carte, deux d'interrupteur et des cases
 * à cocher : chaque section avait été écrite à part. Un seul jeu ici, calé sur
 * l'administration de Tentacle qui l'entoure (cartes à bord fin, interrupteur
 * à 44 px de cible, puces d'état tokenisées).
 *
 * Contrainte de l'iframe : aucune couleur `tentacle-*` n'accepte de
 * modificateur d'opacité (`/NN`) — les teintes passent par `rgba(var(--…))`.
 */

import type { ReactNode } from "react";
import { MinusIcon, PlusIcon } from "../ui/icons";

export function Card({ title, description, action, children, id }: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl bg-tentacle-fill-subtle p-5 ring-1 ring-tentacle-border-subtle sm:p-6">
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-tentacle-text-primary">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-relaxed text-tentacle-text-tertiary">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Interrupteur accessible (`role="switch"`), cible de 44 px. */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
          checked ? "bg-[var(--brand)]" : "bg-tentacle-fill-strong"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-tentacle-on-media-primary shadow-[var(--elev-1)] transition-transform duration-150 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/** Une ligne réglable : libellé, explication, et l'interrupteur au bout. */
export function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-tentacle-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-tentacle-text-tertiary">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

export function FieldLabel({ htmlFor, children, trailing }: { htmlFor?: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-tentacle-text-secondary">{children}</label>
      {trailing}
    </div>
  );
}

export function Hint({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" | "success" | "warning" }) {
  const color = {
    muted: "text-tentacle-text-tertiary",
    error: "text-tentacle-status-error-fg",
    success: "text-tentacle-status-success-fg",
    warning: "text-tentacle-status-warning-fg",
  }[tone];
  return <p className={`mt-1.5 text-[13px] leading-relaxed ${color}`}>{children}</p>;
}

export type ChipTone = "neutral" | "brand" | "success" | "warning" | "error" | "info";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-tentacle-fill-soft text-tentacle-text-secondary",
  brand: "bg-[rgba(var(--brand-rgb),0.16)] text-[var(--brand-light)]",
  success: "bg-tentacle-status-success-bg text-tentacle-status-success-fg",
  warning: "bg-tentacle-status-warning-bg text-tentacle-status-warning-fg",
  error: "bg-tentacle-status-error-bg text-tentacle-status-error-fg",
  info: "bg-tentacle-status-info-bg text-tentacle-status-info-fg",
};

/** Puce d'état. Le point la rend lisible sans la couleur. */
export function Chip({ tone = "neutral", dot, children }: { tone?: ChipTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold ${CHIP_TONE[tone]}`}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Un chiffre et ce qu'il compte. `tone` le signale quand il réclame un geste. */
export function Stat({ value, label, tone = "neutral" }: { value: number | string; label: string; tone?: "neutral" | "warning" }) {
  return (
    <div className="rounded-xl bg-tentacle-fill-faint px-4 py-3 ring-1 ring-tentacle-border-subtle">
      <p className={`text-2xl font-bold tabular-nums ${tone === "warning" && value !== 0 ? "text-tentacle-status-warning-fg" : "text-tentacle-text-primary"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-tentacle-text-tertiary">{label}</p>
    </div>
  );
}

/** Saisie d'un entier avec − et + : au pouce comme au clavier. */
export function Stepper({ value, onChange, min = 0, max = 999, id, decreaseLabel, increaseLabel }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.floor(n) : min));
  const button = "flex h-11 w-11 items-center justify-center text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary disabled:opacity-30";
  return (
    <div className="inline-flex h-11 items-stretch overflow-hidden rounded-full bg-tentacle-fill-soft ring-1 ring-tentacle-border-subtle focus-within:ring-2 focus-within:ring-[rgba(var(--brand-rgb),0.5)]">
      <button type="button" className={button} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={decreaseLabel}>
        <MinusIcon className="h-4 w-4" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-14 bg-transparent text-center text-sm font-semibold tabular-nums text-tentacle-text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={button} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={increaseLabel}>
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
