/* ------------------------------------------------------------------ */
/*  Vigie — Où le hub s'ouvre                                          */
/* ------------------------------------------------------------------ */

/*
 * L'hôte transmet la requête de SA route (`__tentacle_env.query`, hôtes
 * récents — champ facultatif) : c'est par là qu'une recommandation ouvre une
 * fiche (`?media=movie:603`), que la barre de recherche de Tentacle passe la
 * main à Vigie (`?q=dune`), qu'une filmographie de Tentacle ouvre la sienne
 * (`?person=6384`), et qu'un lien mène à un onglet (`?tab=requests`).
 * Le chemin de la route compte aussi : les anciens liens `/requests` et
 * `/releases` ouvrent l'onglet correspondant.
 */

import type { HubTab } from "./HubContext";

export interface HubEntry {
  tab: HubTab;
  media: { mediaType: "movie" | "tv"; id: number } | null;
  /** Une personne TMDB dont la filmographie s'ouvre à l'arrivée. */
  person: number | null;
  query: string;
}

const TABS: Record<string, HubTab> = {
  discover: "discover",
  requests: "requests",
  calendar: "calendar",
  releases: "calendar",
};

export function readHubEntry(routePath: string, hostQuery: string | undefined): HubEntry {
  const params = new URLSearchParams(hostQuery ?? "");
  const media = params.get("media")?.match(/^(movie|tv):(\d+)$/);
  const id = media ? Number(media[2]) : NaN;
  const fromPath = routePath.endsWith("/requests") ? "requests" : routePath.endsWith("/releases") ? "calendar" : "discover";
  const person = Number(params.get("person"));
  return {
    tab: TABS[params.get("tab") ?? ""] ?? fromPath,
    media: media && Number.isFinite(id) && id > 0 ? { mediaType: media[1] as "movie" | "tv", id } : null,
    person: Number.isInteger(person) && person > 0 ? person : null,
    query: (params.get("q") ?? "").slice(0, 120),
  };
}

/** La requête de la route hôte — absente chez les hôtes d'avant ce champ. */
export function hostQuery(): string | undefined {
  return (window as { __tentacle_env?: { query?: string } }).__tentacle_env?.query;
}
