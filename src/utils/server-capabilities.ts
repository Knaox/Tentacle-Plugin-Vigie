/* ------------------------------------------------------------------ */
/*  Vigie — ce que le SERVEUR Tentacle sait faire                       */
/* ------------------------------------------------------------------ */

/*
 * La liste FERMÉE des capacités du cœur, lue une fois sur `/api/config` →
 * `capabilities` (par le pont sur le web et le bureau, en URL complète dans
 * la WebView du mobile). Un serveur qui ne déclare rien n'a aucune des
 * nouveautés : liste vide, sans erreur. `null` tant que ce n'est pas lu —
 * rien ne doit encore choisir entre l'ancien et le nouveau chemin.
 */

import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "./tentacle-fetch";

export function useServerCapabilities(enabled = true): ReadonlySet<string> | null {
  const { data, isFetched } = useQuery({
    queryKey: ["vigie", "tentacle-capabilities"],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const body = await tentacleApiFetch<{ capabilities?: unknown }>("/api/config");
      const list = Array.isArray(body?.capabilities) ? body.capabilities : [];
      return list.filter((c): c is string => typeof c === "string");
    },
  });
  if (!enabled || !isFetched) return null;
  return new Set(data ?? []);
}
