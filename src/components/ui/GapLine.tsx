/* ------------------------------------------------------------------ */
/*  Vigie — Ce qui manque, sous une affiche en partie là               */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { HalfCircleIcon } from "./icons";

/**
 * « Il manque 1 saison » — la demi-lune de l'état « En partie », le texte
 * sur la page. Même gabarit que la ligne du canal qu'elle remplace : une
 * série déjà en partie là n'a plus besoin qu'on dise par où elle est sortie,
 * mais de ce qui lui manque.
 */
export const GapLine = memo(function GapLine({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`mt-0.5 flex items-start gap-1 text-[11px] font-medium leading-4 text-tentacle-text-secondary ${className}`}>
      <HalfCircleIcon className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--vg-partial-solid)]" />
      <span className="line-clamp-2 min-w-0">{text}</span>
    </p>
  );
});
