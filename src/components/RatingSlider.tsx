import { useTranslation } from "react-i18next";
import { StarIcon } from "./ui/icons";

interface RatingSliderProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

/** Une note minimale, au demi-point : la valeur choisie se lit en grand au-dessus. */
export function RatingSlider({ value, onChange }: RatingSliderProps) {
  const { t } = useTranslation("seer");
  const current = value ?? 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <StarIcon className="h-4 w-4 text-[var(--seer-st-rating-solid)]" />
        <span className="text-sm font-bold tabular-nums text-tentacle-text-primary">
          {current > 0 ? `${current.toFixed(1)}+` : t("filterRatingAny")}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={current}
        aria-label={t("filterRating")}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(v > 0 ? v : null);
        }}
        className="h-6 w-full cursor-pointer accent-[var(--brand)]"
      />
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-tentacle-text-quaternary">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
