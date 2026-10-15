/* ------------------------------------------------------------------ */
/*  Vigie — La demande qu'une notification désigne                     */
/* ------------------------------------------------------------------ */

/*
 * Une notification de Tentacle ouvre « Mes demandes » sur SA demande
 * (`hub/deepLink.ts` → `requestFocus`) : la recherche part du titre, la ligne
 * est mise en évidence et amenée au centre de l'écran dès qu'elle est
 * rendue — une fois ; ensuite, on défile librement. Une demande archivée
 * déplie les archives. La mise en évidence reste tant qu'on ne change pas la
 * recherche : on retrouve d'un coup d'œil ce qu'on est venu voir.
 */

import { useEffect, useRef } from "react";
import type { RequestFocus } from "../hub/deepLink";

export interface FocusedRequest {
  /** L'identifiant à mettre en évidence, ou null. */
  highlightId: string | null;
}

export function useRequestFocus(
  focus: RequestFocus | null | undefined,
  rendered: { ids: ReadonlySet<string>; archived: ReadonlySet<string> },
  query: string,
  revealArchived: () => void,
): FocusedRequest {
  const id = focus?.id ?? null;
  const scrolled = useRef(false);
  // Une recherche changée à la main : on est passé à autre chose.
  const stillFocused = id !== null && query.trim() === (focus?.find ?? "").trim();

  useEffect(() => {
    if (!id || !stillFocused || !rendered.archived.has(id)) return;
    revealArchived();
  }, [id, stillFocused, rendered.archived, revealArchived]);

  useEffect(() => {
    if (!id || scrolled.current || !rendered.ids.has(id)) return;
    // Après la peinture : la ligne existe, et la page a sa hauteur.
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector(`[data-request-id="${CSS.escape(id)}"]`);
      if (!row) return;
      scrolled.current = true;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [id, rendered.ids]);

  return { highlightId: stillFocused ? id : null };
}
