import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getAvailability, currentRegion } from "../api/client-releases";
import type { AvailabilityResponse, AvailabilityVerdict } from "../api/types-releases";
import type { MediaType } from "../api/types";
import { availabilityChunks, type AvailabilityRef } from "../utils/availability-chunks";
import { useVerdict } from "./useVerdict";

interface Item { mediaType?: string; id?: number }

/**
 * Verdicts de sortie pour une grille entière, par TRANCHES STABLES.
 *
 * La version précédente mettait la liste complète dans la clé de cache. Le
 * catalogue défilant à l'infini, cette liste grandissait à chaque page : clé
 * neuve, entrée de cache vide, et le temps que la réponse revienne la table
 * était VIDE — toutes les pastilles et tous les logos disparaissaient d'un coup
 * sur l'écran entier, puis revenaient. En prime, chaque carte rétrécissait et
 * regrandissait, soit deux réagencements de toute la grille par page chargée,
 * pendant qu'on faisait défiler.
 *
 * On découpe donc en tranches de taille fixe : les titres 0 à 59, puis 60 à
 * 119… Une tranche déjà chargée garde sa clé quand la liste s'allonge, donc
 * elle ne repart jamais à zéro. Charger une page ajoute une tranche, sans
 * toucher aux précédentes.
 *
 * Effet de bord heureux : aucune requête ne dépasse la taille qu'accepte le
 * serveur, donc les titres de fin de liste — ceux vers lesquels on défile —
 * cessent d'être silencieusement écartés.
 */

/** Tant qu'il reste des fiches à récupérer, on revient les chercher. */
const PENDING_POLL_MS = 4_000;
/** Les dates de sortie ne bougent pas d'une journée : rien à redemander. */
const FRESH_MS = 24 * 60 * 60_000;
/**
 * En revanche on ne GARDE pas une tranche une journée : parcourir le catalogue
 * en produit une toutes les soixante cartes, et chacune retenait ses verdicts
 * en mémoire longtemps après être sortie de l'écran. Une demi-heure suffit à
 * couvrir un aller-retour vers une fiche détaillée.
 */
const KEEP_MS = 30 * 60_000;

export function useAvailability(items: readonly Item[]) {
  const refs = useMemo(() => {
    const seen = new Set<string>();
    const out: AvailabilityRef[] = [];
    for (const it of items) {
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      if (typeof it.id !== "number" || it.id <= 0) continue;
      const key = `${it.mediaType}:${it.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ mediaType: it.mediaType as MediaType, tmdbId: it.id });
    }
    return out;
  }, [items]);

  const chunks = useMemo(() => availabilityChunks(refs), [refs]);
  const region = currentRegion();

  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["seer-availability", region, chunk.index, chunk.key],
      queryFn: () => getAvailability(chunk.refs),
      /* Le serveur ne résout qu'une partie des fiches par appel et poursuit en
       * tâche de fond : sans cette relance, une tranche incomplète le restait
       * une journée entière. Le sondage s'éteint dès que tout est là. */
      refetchInterval: (q: { state: { data?: AvailabilityResponse } }) =>
        (q.state.data?.pending ?? 0) > 0 ? PENDING_POLL_MS : (false as const),
      staleTime: FRESH_MS,
      gcTime: KEEP_MS,
      refetchOnWindowFocus: false,
      // Filet : même si une clé changeait, l'ancienne réponse reste affichée.
      placeholderData: (prev?: AvailabilityResponse) => prev,
      retry: 1,
    })),
  });

  /* `results` est un tableau neuf à chaque rendu, et sa LONGUEUR varie : le
   * passer en dépendances casserait `useMemo`. On résume donc l'état des
   * tranches en une seule chaîne — l'horodatage change dès qu'une réponse
   * arrive, et lui seul doit reconstruire la table. Sans cette mémoïsation, une
   * Map neuve à chaque rendu invaliderait toutes les cartes. */
  const stamp = results.map((r) => r.dataUpdatedAt).join(",");
  const payloads = results.map((r) => r.data);

  return useMemo(() => {
    const map = new Map<string, AvailabilityVerdict>();
    for (const data of payloads) {
      for (const v of data?.results ?? []) map.set(`${v.mediaType}:${v.tmdbId}`, v);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
}

/** Verdict d'un seul titre — pour la fiche détail. Même cache que les cartes. */
export function useSingleAvailability(mediaType: MediaType | undefined, tmdbId: number | undefined) {
  return useVerdict(mediaType, tmdbId);
}
