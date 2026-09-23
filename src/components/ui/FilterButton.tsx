/* ------------------------------------------------------------------ */
/*  Vigie — Le bouton « Filtres avancés »                               */
/* ------------------------------------------------------------------ */

import { useTranslation } from "react-i18next";
import { FilterIcon } from "./icons";

/**
 * Il dit combien de filtres sont actifs, et se teinte de la marque quand il y
 * en a : un filtre oublié ne se cache plus derrière un bouton gris. Sous
 * 400 px, l'icône seule — son libellé reste lu par un lecteur d'écran.
 */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useTranslation("seer");
  const active = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? t("seer:filtersActive", { count }) : t("seer:filtersAdvanced")}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand-light)] ring-[rgba(var(--brand-rgb),0.45)]"
          : "bg-tentacle-fill-subtle text-tentacle-text-secondary ring-tentacle-border-subtle hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary"
      }`}
    >
      <FilterIcon className="h-4 w-4" />
      <span className="hidden min-[400px]:inline">{t("seer:filtersAdvanced")}</span>
      {active && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold tabular-nums text-white">
          {count}
        </span>
      )}
    </button>
  );
}
