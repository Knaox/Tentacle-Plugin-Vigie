import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRequestsProgress } from "../api/client-releases";
import type { DownloadProgress, ProgressItem } from "../api/types-releases";

/**
 * Suivi en direct, lu dans Sonarr et Radarr — mais uniquement quand il y a
 * quelque chose à suivre.
 *
 * `active` vaut vrai dès qu'une demande attend encore Sonarr ou Radarr
 * (validée, en route, en partie là) : c'est ici qu'on apprend qu'elle
 * descend, qu'elle s'importe, puis qu'elle est arrivée — sans attendre
 * Jellyseerr. S'y ajoute la visibilité de l'onglet : page en arrière-plan,
 * plus une seule requête n'est émise. Rien qui attende : aucun appel.
 */
export function useRequestsProgress(active: boolean) {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const query = useQuery({
    queryKey: ["seer-requests-progress"],
    queryFn: getRequestsProgress,
    enabled: active && visible,
    staleTime: 8_000,
    gcTime: 60_000,
    refetchIntervalInBackground: false,
    /* Au rythme de la file (relue toutes les huit secondes côté serveur) tant
     * que quelque chose descend ou s'importe ; sinon, on guette le départ
     * d'un téléchargement ou une arrivée sans marteler. */
    refetchInterval: (q) =>
      active && visible ? ((q.state.data?.items ?? []).some((i) => i.download) ? 10_000 : 30_000) : false,
    retry: 1,
  });

  return useMemo(() => {
    const map = new Map<string, ProgressItem>();
    for (const it of query.data?.items ?? []) map.set(it.id, it);
    return { byId: map, updatedAt: query.data?.updatedAt ?? null };
  }, [query.data]);
}

/**
 * Barre fluide sans requête supplémentaire.
 *
 * Entre deux rafraîchissements, on avance la barre à partir du temps restant
 * annoncé. Trois garde-fous :
 *   - plafond à 99,5 % : seule une vraie mesure peut afficher 100 % ;
 *   - jamais de recul, sauf chute réelle de plus de 5 points (redémarrage) —
 *     une barre qui recule à chaque rafraîchissement est ce qu'il y a de plus
 *     désagréable à regarder ;
 *   - aucune interpolation sans temps restant : mieux vaut une barre immobile
 *     qu'une barre qui avance pendant qu'un téléchargement est bloqué.
 */
export function useInterpolatedProgress(
  download: DownloadProgress | null | undefined,
  receivedAt: string | null,
): { percent: number | null; etaSeconds: number | null } {
  const [tick, setTick] = useState(0);
  const shown = useRef<number | null>(null);

  const base = download?.percent ?? null;
  const eta = download?.etaSeconds ?? null;
  const canInterpolate = base != null && eta != null && eta > 0 && download?.status === "downloading";

  useEffect(() => {
    if (!canInterpolate) return;
    // 1 s suffit : à 60 images par seconde on brûlerait la batterie pour une
    // barre qui bouge d'un dixième de point.
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [canInterpolate]);

  return useMemo(() => {
    void tick;
    if (base == null) {
      shown.current = null;
      return { percent: null, etaSeconds: eta };
    }

    let next = base;
    let remaining = eta;

    if (canInterpolate && receivedAt) {
      const elapsed = (Date.now() - new Date(receivedAt).getTime()) / 1000;
      if (elapsed > 0) {
        const ratio = Math.min(1, elapsed / (eta as number));
        next = Math.min(99.5, base + (100 - base) * ratio);
        remaining = Math.max(0, Math.round((eta as number) - elapsed));
      }
    }

    const prev = shown.current;
    if (prev != null && next < prev && base >= prev - 5) next = prev;
    shown.current = next;

    return { percent: next, etaSeconds: remaining };
  }, [base, eta, canInterpolate, receivedAt, tick]);
}
