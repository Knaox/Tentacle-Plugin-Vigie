/* ------------------------------------------------------------------ */
/*  Seer Plugin — Le calendrier des demandes, dérivé du store          */
/* ------------------------------------------------------------------ */

/*
 * « Mes demandes » n'est plus une construction à part : c'est la tranche du
 * calendrier maître filtrée par les fiches demandées, avec le statut injecté
 * au passage — quasi gratuit une fois le store chaud.
 *
 * Deux exceptions, et les deux comptent :
 *
 *  1. VOIE RÉSIDUELLE — le store vit six heures ; une demande posée il y a
 *     deux minutes n'y a encore aucun item. Les fiches demandées SANS le
 *     moindre item dans la tranche repassent par la construction directe
 *     (budget de récupération, remplissage de fond, logique de fraîcheur
 *     intacts). Par construction, aucune n'a d'item dans la tranche : la
 *     fusion ne peut pas créer de doublon.
 *
 *  2. FENÊTRE HORS STORE — une navigation au-delà de l'horizon reprend la
 *     voie directe intégrale, comme avant le store.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import type { MergedRows } from "./requests-list";
import { todayString } from "./tmdb-fetch";
import { DEFAULT_REGION } from "./tmdb-resolver";
import { attachAirTimes } from "./sonarr-schedule";
import { getCalendarStore } from "./calendar-store";
import { sliceStore } from "./calendar-service";
import {
  buildPersonalCalendar, collectRequestRefs, type PersonalCalendarOpts,
} from "./calendar-personal";
import {
  type CalendarItem, type CalendarResponse,
  sortCalendarItems, capPerSeriesFuture,
} from "./calendar-types";

/** Entrées futures par série dans la vue personnelle — inchangé. */
const PERSONAL_MAX_PER_SERIES = 3;

export async function buildPersonalFromStore(
  db: VigieDb,
  cfg: WorkerCfg,
  rows: MergedRows,
  opts: PersonalCalendarOpts,
  warn?: (err: unknown, msg: string) => void,
): Promise<CalendarResponse> {
  const region = opts.region ?? DEFAULT_REGION;
  const store = await getCalendarStore(db, cfg, region, warn);

  if (opts.from < store.from || opts.to > store.to) {
    const res = await buildPersonalCalendar(db, cfg, rows, opts);
    return attachAirTimes(cfg, res);
  }

  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);

  /* Tranche du store réduite aux fiches demandées, statut injecté sur les
   * COPIES — le store lui-même ne porte l'identité de personne. */
  const slice = sliceStore(store, opts.from, opts.to).filter((it) =>
    refs.has(`${it.mediaType}:${it.tmdbId}`),
  );
  for (const it of slice) {
    const ctx = statusByKey.get(`${it.mediaType}:${it.tmdbId}`);
    if (ctx) {
      it.requestId = ctx.requestId;
      it.requestStatus = ctx.status;
    }
  }

  /* Voie résiduelle : les fiches sans aucun item dans la tranche. */
  const covered = new Set(slice.map((it) => `${it.mediaType}:${it.tmdbId}`));
  const residual = new Set([...refs.keys()].filter((k) => !covered.has(k)));

  let residualItems: CalendarItem[] = [];
  let residualPartial = false;
  if (residual.size > 0) {
    const res = await buildPersonalCalendar(db, cfg, rowsSubset(rows, residual), opts);
    const timed = await attachAirTimes(cfg, res);
    residualItems = timed.items;
    residualPartial = timed.partial;
  }

  const items = capPerSeriesFuture(
    sortCalendarItems([...slice, ...residualItems]),
    PERSONAL_MAX_PER_SERIES,
    todayString(),
  );

  return {
    from: opts.from,
    to: opts.to,
    items,
    partial: store.partial || residualPartial,
  };
}

/** Les mêmes lignes, réduites aux fiches voulues (clé « type:tmdbId »). */
function rowsSubset(rows: MergedRows, keep: Set<string>): MergedRows {
  return {
    ...rows,
    seerrRows: rows.seerrRows.filter(
      (sr) => sr.media?.tmdbId && keep.has(`${sr.media.mediaType}:${sr.media.tmdbId}`),
    ),
    localOnly: rows.localOnly.filter(
      (l) => l.tmdbId && keep.has(`${l.mediaType}:${l.tmdbId}`),
    ),
  };
}
