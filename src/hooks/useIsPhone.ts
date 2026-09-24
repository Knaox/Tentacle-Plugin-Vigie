import { useEffect, useState } from "react";

/** Le point de bascule du plugin : sous 640 px (`sm`), c'est un téléphone. */
const PHONE = "(max-width: 639px)";

function matches(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(PHONE).matches === true;
}

/**
 * Vrai sous 640 px, et suivi quand la largeur change (rotation d'une tablette,
 * fenêtre redimensionnée). Pour les rares vues dont la STRUCTURE change au
 * téléphone ; une simple mise en page passe par les préfixes Tailwind.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE);
    if (!query) return;
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
