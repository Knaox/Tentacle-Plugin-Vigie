import { useTranslation } from "react-i18next";
import { pill } from "../styles/pills";
import { CheckIcon } from "./ui/icons";
import type { Genre } from "../constants/genres";

interface GenreFilterProps {
  genres: Genre[];
  selected: number[];
  onToggle: (id: number) => void;
}

/** Les genres. Le titre et le compteur sont portés par la section qui l'entoure. */
export function GenreFilter({ genres, selected, onToggle }: GenreFilterProps) {
  const { t } = useTranslation("seer");

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g) => {
        const active = selected.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            aria-pressed={active}
            className={pill(active)}
          >
            {active && <CheckIcon className="h-3.5 w-3.5" />}
            {t(g.key)}
          </button>
        );
      })}
    </div>
  );
}
