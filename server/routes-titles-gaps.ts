/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons qui manquent aux séries de Tentacle             */
/* ------------------------------------------------------------------ */

/*
 *   GET /titles/gaps?keys=tv:1399,tv:1396&lang=fr
 *       — pour des séries que la bibliothèque de Tentacle a DÉJÀ (sa
 *         recherche, la fiche d'une série) : les saisons qui leur manquent,
 *         chacune dans la forme de `titles/seasons` (titles/title-gaps.ts).
 *         Une seule question pour toute une page de résultats.
 *       → { items: { "tv:1399": { seasons: [{ number, name, episodeCount, badge, requestable }] } } }
 *
 * Seule une série que Jellyseerr dit EN PARTIE là y figure, et seulement si
 * quelque chose lui manque : l'état vient de la table des statuts, en
 * mémoire — une série entière ne coûte aucun appel. Pour les autres, la fiche
 * Jellyseerr (gardée une minute) et la file du compte, lue à chaque fois : une
 * saison qu'on vient de demander s'y verrouille aussitôt.
 *
 * Déclarée dans `plugin.json` → `titles.gaps` ; un Tentacle d'avant l'ignore.
 */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { fetchMediaDetail } from "./anime";
import { cached } from "./cache";
import { mapLimit } from "./concurrency";
import { specialSeasonsQuick } from "./seerr-settings";
import { refreshStatusMap } from "./search/status-map";
import { refreshLocalPending } from "./search/pending";
import { statusFor } from "./search/respond";
import type { SeerrTvDetail } from "../src/api/types";
import { localRequestedSeasons } from "./titles/local-seasons";
import { readLang, rightsOf } from "./titles/title-rights";
import { parseTitleKeys } from "./titles/title-state";
import { hasGapsToTell, MAX_GAP_KEYS, MAX_GAP_LOOKUPS, seriesGaps } from "./titles/title-gaps";
import type { SeasonOut } from "./titles/title-seasons";
import { withCorrectedInfo } from "./live/media-info";

/** La fiche d'une série bouge peu : une page de résultats retapée ne la relit pas. */
const DETAIL_TTL_MS = 60_000;
/** Jellyseerr relaie vers TMDB : peu de fiches à la fois (cf. concurrency.ts). */
const LOOKUP_CONCURRENCY = 4;

/** La fiche Jellyseerr d'une série, gardée une minute ; un échec n'est pas gardé. */
function tvDetail(cfg: WorkerCfg, tmdbId: number): Promise<SeerrTvDetail> {
  return cached(`seer:gaps:tv:${tmdbId}`, DETAIL_TTL_MS, async () => {
    const detail = (await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "tv", tmdbId)) as SeerrTvDetail | null;
    if (!detail?.name) throw new Error(`Jellyseerr GET /tv/${tmdbId} : rien`);
    return detail;
  });
}

export function registerTitleGapRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  app.get("/titles/gaps", async (request) => {
    const query = request.query as { keys?: string; lang?: string };
    const keys = parseTitleKeys(query.keys).filter((k) => k.mediaType === "tv").slice(0, MAX_GAP_KEYS);
    const cfg = await getWorkerConfig();
    if (!cfg || keys.length === 0) return { items: {} };
    // Ni l'un ni l'autre n'est attendu : la réponse part avec ce qu'on sait déjà.
    refreshStatusMap(cfg);
    refreshLocalPending(db);
    const partial = keys
      .filter((k) => hasGapsToTell(statusFor({ key: k.key, mediaType: k.mediaType, tmdbId: k.tmdbId, remoteStatus: undefined })))
      .slice(0, MAX_GAP_LOOKUPS);
    if (partial.length === 0) return { items: {} };

    const lang = readLang(query.lang);
    const user = getUser(request);
    const [rights, specials] = await Promise.all([
      rightsOf(db, user.userId, cfg),
      specialSeasonsQuick(cfg.seerrUrl, cfg.seerrApiKey),
    ]);
    const items: Record<string, { seasons: SeasonOut[] }> = {};
    // Une fiche qui ne vient pas : cette série ne dit rien, les autres répondent.
    await mapLimit(partial, LOOKUP_CONCURRENCY, async (k) => {
      const [detail, local] = await Promise.all([
        tvDetail(cfg, k.tmdbId),
        localRequestedSeasons(db, user.userId, k.tmdbId).catch(() => [] as number[]),
      ]);
      // La fiche gardée une minute est celle de Jellyseerr ; ce que Jellyfin a perdu se corrige ici.
      const seasons = seriesGaps(withCorrectedInfo("tv", k.tmdbId, detail), local, rights, { specials, lang });
      if (seasons.length > 0) items[k.key] = { seasons };
    });
    return { items };
  });
}
