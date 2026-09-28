import { useEffect, useState } from "react";

/**
 * « Monté tant que `active`, plus le temps de son fondu de sortie. » Le
 * jumeau du crochet des cartes de Tentacle : un calque révélé au survol se
 * MONTE à la demande, il ne se masque pas à opacité nulle — il porterait
 * sinon ses abonnements (notes, Ma liste) sur des centaines d'affiches.
 */
export function useMountWhile(active: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(active);
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const id = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(id);
  }, [active, exitMs]);
  return mounted || active;
}
