import { useTranslation } from "react-i18next";

interface YearRangeFilterProps {
  yearFrom: number | null;
  yearTo: number | null;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
}

const FIELD =
  "h-11 w-full rounded-xl bg-tentacle-fill-subtle px-3 text-sm font-semibold tabular-nums text-tentacle-text-primary " +
  "outline-none ring-1 ring-tentacle-border-subtle transition-shadow placeholder:font-normal placeholder:text-tentacle-text-quaternary " +
  "focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.6)]";

/** Une période, bornes facultatives. Clavier numérique au téléphone. */
export function YearRangeFilter({ yearFrom, yearTo, onYearFromChange, onYearToChange }: YearRangeFilterProps) {
  const { t } = useTranslation("seer");
  const max = new Date().getFullYear() + 5;

  const parseYear = (val: string): number | null => {
    if (!val) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-tentacle-text-tertiary">{t("filterYearFrom")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1900}
          max={max}
          placeholder="1990"
          value={yearFrom ?? ""}
          onChange={(e) => onYearFromChange(parseYear(e.target.value))}
          className={FIELD}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-tentacle-text-tertiary">{t("filterYearTo")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1900}
          max={max}
          placeholder={String(max - 5)}
          value={yearTo ?? ""}
          onChange={(e) => onYearToChange(parseYear(e.target.value))}
          className={FIELD}
        />
      </label>
    </div>
  );
}
