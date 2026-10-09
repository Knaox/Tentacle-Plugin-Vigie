/* ------------------------------------------------------------------ */
/*  Vigie — Le hub suit, en direct, ce que Jellyfin et Jellyseerr font   */
/* ------------------------------------------------------------------ */

/*
 * Un titre supprimé de Jellyfin, une demande supprimée dans Jellyseerr : le
 * serveur de Vigie le sait en quelques secondes (live/live-sync.ts) et
 * l'annonce par un simple compteur (`GET /sync/state`). Le hub le relit toutes
 * les dix secondes tant qu'il est affiché ; quand il bouge, ce qui dit l'état
 * d'un titre se relit — affiches, fiche, recherche, demandes, agenda. Rien
 * d'autre ne circule tant que rien ne bouge, et rien du tout quand le hub est
 * caché.
 */

import { useEffect, useRef } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";

const POLL_MS = 10_000;

/** Les requêtes qui portent l'état d'un titre (première clé). */
const STATEFUL = new Set([
  "seer-my-requests", "seer-requests-progress", "seer-queue-status", "seer-stats-overview",
  "seer-media-detail", "seer-media-collection", "seer-media-similar", "seer-local-seasons",
  "seer-discover", "seer-search", "seer-trending",
  "seer-calendar-personal", "seer-calendar-global",
  "vigie-rail", "vigie-search", "vigie-series-gaps", "vigie-person-credits", "vigie-browse",
  "vigie-marks", "vigie-episode-states",
]);

export function carriesTitleState(query: Pick<Query, "queryKey">): boolean {
  const root = query.queryKey[0];
  return typeof root === "string" && STATEFUL.has(root);
}

export function useLiveSync(): void {
  const qc = useQueryClient();
  const last = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

    const tick = async () => {
      timer = null;
      if (stopped) return;
      if (visible()) {
        try {
          const res = await backendFetch<{ generation?: unknown }>("/sync/state");
          const gen = typeof res?.generation === "number" ? res.generation : null;
          if (gen !== null) {
            if (last.current !== null && gen !== last.current) {
              void qc.invalidateQueries({ predicate: carriesTitleState });
            }
            last.current = gen;
          }
        } catch {
          /* Hors ligne, serveur qui redémarre : la passe suivante réessaie. */
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
    };

    // Revenu au premier plan : on relit tout de suite plutôt qu'au prochain tour.
    const onVisibility = () => {
      if (!visible() || stopped) return;
      if (timer) clearTimeout(timer);
      void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qc]);
}
