import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backendFetch } from "../api/seer-client";
import { DEFAULT_NAV_LABEL, labelFor } from "../utils/nav-labels";

interface PublicConfig {
  isAdmin?: boolean;
  /** Les noms donnés à l'onglet par l'administrateur, par langue ; vides : « Vigie ». */
  navLabels?: { fr?: string; en?: string };
  /** Jellyseerr laisse demander la saison 0 (« autoriser les épisodes spéciaux »). */
  specialSeasons?: boolean;
  /** L'administrateur laisse demander les titres masqués. */
  maskedRequests?: boolean;
}

/**
 * `GET /config`, lu une fois par session : ce qu'un client a le droit d'en
 * savoir (drapeau administrateur, nom de l'onglet, ce qui se demande).
 * Invalidé par la page d'administration quand elle enregistre.
 */
function usePublicConfig(): PublicConfig | undefined {
  const { data } = useQuery({
    queryKey: ["seer-is-admin"],
    queryFn: () => backendFetch<PublicConfig>("/config"),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return data;
}

/**
 * L'utilisateur est-il administrateur du serveur ?
 *
 * Le plugin n'avait aucun moyen de le savoir : `GET /config` renvoyait
 * simplement moins de champs aux non-admins. Il expose désormais le drapeau,
 * ce qui permet de ne PROPOSER les vues d'administration qu'à ceux qui y ont
 * droit — la vraie barrière restant côté serveur, sur chaque route.
 *
 * Le statut ne change pas en cours de session : une seule requête suffit.
 */
export function useIsAdmin(): boolean {
  return usePublicConfig()?.isAdmin === true;
}

/**
 * Le nom de l'onglet choisi par l'administrateur dans la langue de
 * l'utilisateur, pour que le titre du hub dise la même chose que la barre de
 * Tentacle. `null` : le nom d'origine.
 */
export function usePluginLabel(): string | null {
  const { i18n } = useTranslation("seer");
  const labels = usePublicConfig()?.navLabels;
  if (!labels) return null;
  const label = labelFor({ fr: labels.fr ?? "", en: labels.en ?? "" }, i18n.language);
  return label === DEFAULT_NAV_LABEL ? null : label;
}

/**
 * Les épisodes spéciaux (la saison 0) se demandent-ils ? C'est Jellyseerr qui
 * en décide (« autoriser la demande d'épisodes spéciaux ») : éteint, il les
 * retirerait de toute demande — Vigie ne les propose donc qu'allumé.
 */
export function useSpecialSeasons(): boolean {
  return usePublicConfig()?.specialSeasons === true;
}

/**
 * Un titre masqué se demande-t-il ? L'administrateur en décide, dans Vigie :
 * permis, le blocage est levé chez Jellyseerr juste avant l'envoi.
 */
export function useMaskedRequests(): boolean {
  return usePublicConfig()?.maskedRequests === true;
}
