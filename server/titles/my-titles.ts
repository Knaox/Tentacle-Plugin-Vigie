/* ------------------------------------------------------------------ */
/*  Vigie — Les titres qu'un compte attend, pour les cartes de Tentacle */
/* ------------------------------------------------------------------ */

/*
 * La route `mine` du contrat `titles` de Tentacle (plugin.json → `titles`) :
 * les titres demandés par le compte et pas encore là, un par titre, les plus
 * récents d'abord, chacun dans UN des quatre états que Tentacle sait dire :
 *
 *   pending   — demandé, rien ne bouge encore (en attente de validation, ou
 *               validé et cherché) : le « Demandé » de l'affiche du hub ;
 *   arriving  — en route, avec son avancement quand Sonarr ou Radarr le sait,
 *               et le temps qu'il lui reste quand il descend vraiment
 *               (`etaSeconds`) : Tentacle fait avancer son camembert entre
 *               deux lectures, comme le hub fait avancer sa barre ;
 *   importing — complet, Sonarr ou Radarr le range dans la bibliothèque ;
 *   blocked   — n'avance plus pour l'instant (jamais un échec).
 *
 * Seul l'état voyage : les MOTS sont ceux de Tentacle (jamais la famille de
 * « téléchargement », que les relecteurs d'Apple refusent). Le reste — un
 * titre arrivé, là en partie sans rien qui vienne, refusé, supprimé — n'est
 * plus une attente : il n'y figure pas. Mêmes verdicts que le hub
 * (`stateFromRequest` du front) : Sonarr et Radarr parlent d'abord.
 *
 * Pur : les demandes hydratées et les verdicts *arr arrivent de la route.
 */

import type { DownloadProgress, RequestStatus } from "../types";
import type { ArrVerdict } from "../arr-truth";

export type MyTitleState = "pending" | "arriving" | "importing" | "blocked";

export interface MyTitleOut {
  key: string;
  title: string;
  year: number | null;
  imageUrl: string | null;
  seasons: number[] | null;
  state: MyTitleState;
  percent: number | null;
  /** Champ ajouté après coup (contrat additif) : un client plus ancien l'ignore. */
  etaSeconds: number | null;
}

/** Ce que la route lit d'une demande hydratée (`UnifiedRequest`). */
export interface MineRequest {
  id: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  seasons: number[] | null;
  status: RequestStatus;
  download?: DownloadProgress | null;
}

/** Au plus autant de titres : au-delà, la liste ne se lit plus sur une TV. */
export const MAX_MY_TITLES = 50;

/* Ce qui attend sans bouger encore — même liste que le hub. */
const WAITING: ReadonlySet<RequestStatus> = new Set([
  "queued", "processing", "sent_to_seer", "approved", "unavailable", "retry_pending",
]);

/* Ce qui l'emporte quand deux demandes portent sur le même titre (deux saisons) : ce qui bouge. */
const RANK: Record<MyTitleState, number> = { pending: 1, blocked: 2, importing: 3, arriving: 4 };

interface Verdict {
  state: MyTitleState;
  percent: number | null;
  etaSeconds: number | null;
}

const still = (state: MyTitleState): Verdict => ({ state, percent: null, etaSeconds: null });

/* Le temps restant ne se dit que de ce qui DESCEND (la règle de la barre du
 * hub, `useInterpolatedProgress`) : en file, en pause ou retardé, une barre qui
 * avancerait seule mentirait. */
function etaOf(download: DownloadProgress): number | null {
  const eta = download.etaSeconds;
  return download.status === "downloading" && typeof eta === "number" && Number.isFinite(eta) && eta > 0 ? Math.round(eta) : null;
}

function arriving(download: DownloadProgress): Verdict {
  if (download.stalled) return still("blocked");
  if (download.validating) return still("importing");
  const percent = download.percent;
  return {
    state: "arriving",
    percent: typeof percent === "number" && Number.isFinite(percent) ? Math.round(percent * 10) / 10 : null,
    etaSeconds: etaOf(download),
  };
}

/** L'état d'UNE demande, verdict de Sonarr ou Radarr compris ; `null` : plus une attente. */
export function verdictOf(request: MineRequest, arr?: ArrVerdict): Verdict | null {
  const status = arr?.status ?? request.status;
  const download = arr ? arr.download : request.download ?? null;
  if (status === "downloading") return download ? arriving(download) : still("arriving");
  // Là en partie : seulement si le reste arrive — sinon il n'y a rien à attendre de visible.
  if (status === "partially_available") return download ? arriving(download) : null;
  return WAITING.has(status) ? still("pending") : null;
}

function yearOf(raw: string | null): number | null {
  const year = raw && /^\d{4}/.test(raw) ? Number(raw.slice(0, 4)) : NaN;
  return Number.isInteger(year) ? year : null;
}

/** Les titres attendus, un par titre, dans l'ordre des demandes (les plus récentes d'abord). */
export function myTitles(requests: readonly MineRequest[], verdicts: ReadonlyMap<string, ArrVerdict>): MyTitleOut[] {
  const byKey = new Map<string, MyTitleOut>();
  for (const request of requests) {
    if (!(request.tmdbId > 0)) continue;
    const verdict = verdictOf(request, verdicts.get(request.id));
    if (!verdict) continue;
    const key = `${request.mediaType}:${request.tmdbId}`;
    const seasons = request.mediaType === "tv" && request.seasons?.length ? request.seasons : null;
    const known = byKey.get(key);
    if (!known) {
      if (byKey.size >= MAX_MY_TITLES) continue;
      byKey.set(key, {
        key,
        title: request.title,
        year: yearOf(request.year),
        imageUrl: request.posterPath ? `https://image.tmdb.org/t/p/w185${request.posterPath}` : null,
        seasons: seasons ? [...new Set(seasons)].sort((a, b) => a - b) : null,
        ...verdict,
      });
      continue;
    }
    // Deux demandes du même titre : ses saisons s'additionnent, ce qui bouge l'emporte.
    if (known.seasons && seasons) known.seasons = [...new Set([...known.seasons, ...seasons])].sort((a, b) => a - b);
    else known.seasons = null;
    if (RANK[verdict.state] > RANK[known.state]) Object.assign(known, verdict);
  }
  return [...byKey.values()];
}
