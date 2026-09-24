/* ------------------------------------------------------------------ */
/*  Vigie — Le bouton « Filtres avancés »                               */
/* ------------------------------------------------------------------ */

import { useTranslation } from "react-i18next";
import { FilterIcon } from "./icons";

/**
 * Il dit combien de filtres sont actifs, et se teinte de la marque quand il y
 * en a : un filtre oublié ne se cache plus derrière un bouton gris. Sous
 * 400 px, l'icône seule — son libellé reste lu par un lecteur d'écran.
 *
 * `compact` : l'icône seule sur TOUT le téléphone, en cible de 44 px, pour
 * tenir sur la même rangée qu'un segmenté ; la pastille de compte passe en
 * exposant.
 */
export function FilterButton({ count, onClick, compact = false }: { count: number; onClick: () => void; compact?: boolean }) {
  const { t } = useTranslation("seer");
  const active = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? t("seer:filtersActive", { count }) : t("seer:filtersAdvanced")}
      className={`relative inline-flex shrink-0 items-center gap-2 rounded-full text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
        compact ? "h-11 w-11 justify-center sm:h-10 sm:w-auto sm:px-4" : "h-10 px-4"
      } ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand-light)] ring-[rgba(var(--brand-rgb),0.45)]"
          : "bg-tentacle-fill-subtle text-tentacle-text-secondary ring-tentacle-border-subtle hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary"
      }`}
    >
      <FilterIcon className={compact ? "h-5 w-5 sm:h-4 sm:w-4" : "h-4 w-4"} />
      <span className={compact ? "hidden sm:inline" : "hidden min-[400px]:inline"}>{t("seer:filtersAdvanced")}</span>
      {active && (
        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold tabular-nums text-white ${
          compact ? "absolute -right-1 -top-1 sm:static" : ""
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
