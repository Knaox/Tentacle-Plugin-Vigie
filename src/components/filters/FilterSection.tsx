import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "../ui/icons";

/**
 * Une section de filtre, repliée par défaut quand elle n'est pas utilisée.
 *
 * Trois règles :
 *   - une section qui porte une sélection s'ouvre d'elle-même et affiche son
 *     compte — et, repliée, ce qu'elle retient (« Comédie, Drame ») : aucun
 *     filtre actif ne reste caché ;
 *   - l'en-tête entier est la zone de clic (48 px), pas seulement le chevron ;
 *   - « Effacer » n'apparaît que là où il y a quelque chose à effacer.
 */

interface Props {
  title: string;
  /** Nombre de valeurs retenues — affiché en pastille, ouvre la section. */
  count?: number;
  /** Ce que la section retient, lu section repliée. */
  summary?: string;
  onClear?: () => void;
  /** Force l'ouverture (sections à valeur unique, comme le tri). */
  alwaysOpen?: boolean;
  children: ReactNode;
}

export function FilterSection({ title, count = 0, summary, onClear, alwaysOpen, children }: Props) {
  const { t } = useTranslation("seer");
  const [open, setOpen] = useState(count > 0);
  const expanded = alwaysOpen || open;

  return (
    <section className="border-b border-tentacle-border-subtle py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !alwaysOpen && setOpen((v) => !v)}
          aria-expanded={expanded}
          disabled={alwaysOpen}
          className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default"
        >
          <span className="shrink-0 text-sm font-bold text-tentacle-text-primary">{title}</span>
          {count > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--brand-light)]">
              {count}
            </span>
          )}
          {!expanded && summary && <span className="min-w-0 truncate text-xs text-tentacle-text-tertiary">{summary}</span>}
          {!alwaysOpen && (
            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-tentacle-text-tertiary transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {count > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[36px] shrink-0 rounded-full px-3 text-xs font-semibold text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            {t("seer:filterClearSection")}
          </button>
        )}
      </div>

      {expanded && (
        <div className="pb-3 pt-1" style={{ animation: "fadeIn 150ms ease" }}>
          {children}
        </div>
      )}
    </section>
  );
}
