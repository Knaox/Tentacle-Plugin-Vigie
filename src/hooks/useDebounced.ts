import { useEffect, useState } from "react";

/**
 * La valeur, une fois qu'elle a cessé de bouger pendant `ms`. Vider est
 * immédiat : effacer une recherche n'a rien à attendre.
 */
export function useDebounced<T>(value: T, ms: number, immediate?: (value: T) => boolean): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (immediate?.(value)) {
      setDebounced(value);
      return;
    }
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms, immediate]);
  return debounced;
}
