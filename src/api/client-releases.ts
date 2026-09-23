/* ------------------------------------------------------------------ */
/*  Seer API — appels disponibilité / progression / calendrier         */
/* ------------------------------------------------------------------ */

import { backendFetch } from "./seer-client";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "./types";
import type {
  AvailabilityResponse, RequestsProgressResponse, QueueResponse,
  CalendarResponse, CalendarProvider, SeriesEpisodeStates,
} from "./types-releases";

/**
 * Les dates de sortie sont propres à un pays. Faute de réglage dédié, la langue
 * de l'interface est le meilleur indice : « fr » → dates françaises.
 */
export function currentRegion(): string {
  const lang = getCurrentLanguage();
  const region = lang.includes("-") ? lang.split("-")[1] : lang;
  return /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : "FR";
}

/** Un seul appel pour tout un écran de grille, plutôt qu'un par carte. */
export async function getAvailability(
  items: Array<{ mediaType: MediaType; tmdbId: number }>,
): Promise<AvailabilityResponse> {
  if (items.length === 0) return { results: [] };
  return backendFetch("/availability", {
    method: "POST",
    body: JSON.stringify({ items, region: currentRegion() }),
  });
}

export async function getRequestsProgress(): Promise<RequestsProgressResponse> {
  return backendFetch("/requests/progress");
}

export async function getPersonalCalendar(
  from?: string, to?: string, includeSettled = false, everyone = false,
): Promise<CalendarResponse> {
  // La région décide des plateformes affichées sur chaque entrée — le serveur
  // s'en sert aussi pour retrouver le même calendrier maître que la vue globale.
  const p = new URLSearchParams({ region: currentRegion() });
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  // Y compris ce qui est déjà arrivé : sans cela la page paraissait vide dès
  // que toutes les demandes avaient abouti.
  if (includeSettled) p.set("all", "1");
  // Les demandes de tout le monde, pas seulement les siennes.
  if (everyone) p.set("everyone", "1");
  return backendFetch(`/calendar/personal?${p}`);
}

/**
 * Tout ce qui sort sur la période. Plus AUCUN filtre dans la requête : le
 * serveur rend le calendrier maître entier de la fenêtre, et type, plateformes,
 * note ou langue se départagent ici — changer un filtre ne recharge plus rien.
 */
export async function getGlobalCalendar(opts: {
  from?: string;
  to?: string;
}): Promise<CalendarResponse> {
  const p = new URLSearchParams({ region: currentRegion() });
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  return backendFetch(`/calendar/global?${p}`);
}

/** La file du serveur, demandes de tout le monde comprises. Admins seulement. */
export async function getServerDownloads(): Promise<QueueResponse> {
  return backendFetch("/downloads");
}

/**
 * Heures de diffusion d'une série, indexées « S1E2 ».
 * Objet vide quand Sonarr ne suit pas la série : on n'invente pas d'heure.
 */
export async function getSeriesAirTimes(tmdbId: number): Promise<{ times: Record<string, string> }> {
  return backendFetch(`/calendar/airtimes?tmdbId=${tmdbId}`);
}

/** Catalogue fusionné films + séries : un film peut être sur une plateforme
 *  absente de la liste séries. */
export async function getCalendarProviders(): Promise<{ results: CalendarProvider[] }> {
  return backendFetch(`/calendar/providers?region=${currentRegion()}`);
}

/**
 * L'état de chaque épisode d'une série (« S4E18 » → demandé, en route, bloqué,
 * disponible), d'après Sonarr. `tracked: false` : Sonarr ne suit pas la série.
 */
export async function getEpisodeStates(tmdbId: number): Promise<SeriesEpisodeStates> {
  return backendFetch(`/episodes/states?tmdbId=${tmdbId}`);
}
