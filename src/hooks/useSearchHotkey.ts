import { useEffect, type RefObject } from "react";

/**
 * ⌘K / Ctrl+K place le curseur dans la barre de recherche de la page courante,
 * Échap la vide et rend le focus.
 *
 * Deux détails qui manquaient :
 *   - la comparaison était sensible à la casse, donc le raccourci était sans
 *     effet avec Verr.Maj ou Majuscule enfoncée ;
 *   - la page Mes demandes n'avait aucun raccourci alors qu'elle a la même
 *     barre de recherche que le catalogue.
 */
export function useSearchHotkey(
  inputRef: RefObject<HTMLInputElement | null>,
  onClear?: () => void,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onClear?.();
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inputRef, onClear]);
}
