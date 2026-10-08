/* ------------------------------------------------------------------ */
/*  Seer Plugin — Servir le calendrier global depuis le store          */
/* ------------------------------------------------------------------ */

/*
 * Le store est PARTAGÉ entre tous les comptes : tout ce qui se sert en est
 * découpé sur des COPIES. La pastille « demandé » et les instants Sonarr
 * mutent leurs items — appliqués aux objets du store, la première requête
 * marquerait le calendrier de tout le monde.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import { todayString } from "./tmdb-fetch";
import { markRequested } from "./calendar-requested";
import { getCalendarStore } from "./calendar-store";
import type { CalendarStore } from "./calendar-store-build";
import {
  type CalendarItem, type CalendarResponse,
  sortCalendarItems, capPerSeriesFuture,
} from "./calendar-types";

/** Entrées futures par série dans la vue globale — inchangé depuis toujours. */
const GLOBAL_MAX_PER_SERIES = 2;

export interface GlobalServeOpts {
  /** Compat d'un bundle client antérieur, qui filtrait par la requête. */
  providerIds: number[];
  mediaType: "movie" | "tv" | "both";
  region: string;
  from: string;
  to: string;
}

/** La tranche [from, to] du store, en copies indépendantes. */
export function sliceStore(store: CalendarStore, from: string, to: string): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const it of store.items) {
    if (it.date < from || it.date > to) continue;
    out.push({ ...it });
  }
  return out;
}

export async function buildGlobalFromStore(
  db: VigieDb,
  cfg: WorkerCfg,
  opts: GlobalServeOpts,
  warn?: (err: unknown, msg: string) => void,
): Promise<CalendarResponse> {
  const store = await getCalendarStore(db, cfg, opts.region, warn);

  /* Une navigation au-delà de l'horizon rend simplement la part couverte :
   * l'horizon dépasse déjà toute utilisation raisonnable de l'agenda. */
  const from = opts.from < store.from ? store.from : opts.from;
  const to = opts.to > store.to ? store.to : opts.to;
  let items = from <= to ? sliceStore(store, from, to) : [];

  /* Compat : le client actuel filtre tout chez lui et n'envoie plus ces
   * paramètres — mais un onglet resté ouvert sur l'ancien bundle compte
   * encore sur le serveur pour le faire. */
  if (opts.mediaType !== "both") {
    items = items.filter((i) => i.mediaType === opts.mediaType);
  }
  if (opts.providerIds.length > 0) {
    items = items.filter((i) => i.providerIds.some((id) => opts.providerIds.includes(id)));
  }

  items = capPerSeriesFuture(sortCalendarItems(items), GLOBAL_MAX_PER_SERIES, todayString());
  // Sur les copies : la pastille est par instance, jamais figée dans le store.
  await markRequested(db, items);

  return { from: opts.from, to: opts.to, items, partial: store.partial };
}
