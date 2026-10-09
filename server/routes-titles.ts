/* ------------------------------------------------------------------ */
/*  Vigie — Les routes du contrat `titles` de Tentacle                 */
/* ------------------------------------------------------------------ */

/*
 *   GET  /titles/state?keys=movie:603,tv:1399&lang=fr
 *        — la pastille et le geste de chaque titre, pour les cartes hors
 *          bibliothèque de Tentacle (recherche, recommandations,
 *          filmographies, sagas), et sa fiche dans le hub (`page`). Répond depuis la mémoire : la table des
 *          statuts et la file locale, plus les réglages du compte.
 *   POST /titles/request { mediaType, tmdbId, lang, seasons?, origin?, platform? }
 *        — le geste lui-même. Un film se demande sur place, par la même porte
 *          que le hub (request-submit.ts) ; une série aussi quand le client a
 *          choisi ses saisons (`seasons`, routes-titles-seasons.ts), sinon
 *          elle renvoie le lien du hub qui ouvre ses saisons libres. Un refus (quota, droits, déjà
 *          demandé) répond 200 avec `ok: false` et une phrase à afficher :
 *          c'est un résultat, pas une panne. `origin` et `platform` (« tv »,
 *          « appletv ») : d'où part la demande, gardé avec elle
 *          (titles/request-origin.ts) ; un client qui ne les dit pas n'en a pas.
 *   GET  /titles/access
 *        — le compte peut-il demander quoi que ce soit : `{ request }`, faux
 *          pour un compte bloqué ou sans aucun type permis. Tentacle s'en sert
 *          pour n'offrir AUCUNE de nos fonctions à un tel compte.
 *   GET  /titles/mine?lang=fr&origin=tv
 *        — les titres que le compte attend, un par titre, les plus récents
 *          d'abord, dans un des quatre états de Tentacle (titles/my-titles.ts).
 *          Mêmes verdicts que le hub (Sonarr et Radarr d'abord), sur la même
 *          liste en cache ; sa propre clé, sous celle du compte : une demande
 *          faite l'invalide avec le reste (`invalidateRequestCaches`).
 *          `origin` (facultatif) : seules les demandes parties de là (« tv » :
 *          « Mes demandes » d'un téléviseur), saisons comprises ; sans lui,
 *          toutes, comme avant (titles/request-origin.ts).
 *
 * Déclarées dans `plugin.json` → `titles`.
 */

import type { FastifyInstance } from "fastify";
import type { VigieDb } from "./storage/vigie-db";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { fetchMediaDetail } from "./anime";
import { refreshStatusMap, noteStatus, MEDIA_STATUS } from "./search/status-map";
import { refreshLocalPending } from "./search/pending";
import { statusFor } from "./search/respond";
import { submitRequest } from "./request-submit";
import { parseTitleKeys, seasonsHref, titlePage, titleStateFor, type TitleStateOut } from "./titles/title-state";
import { readLang, rightsOf } from "./titles/title-rights";
import { parseRequestedSeasons } from "./titles/title-seasons";
import { ofOrigin, readOriginFilter, readRequestOrigin } from "./titles/request-origin";
import { requestSeasons } from "./routes-titles-seasons";
import { refusalMessage, requestedMessage, unreachableMessage } from "./titles/title-messages";
import { myTitles } from "./titles/my-titles";
import { cached } from "./cache";
import { loadMergedRows } from "./routes-requests-read";
import { collectTmdbRefs, hydrateRows } from "./requests-list";
import { resolveTmdbMeta } from "./tmdb-resolver";
import { tmdbKey } from "./tmdb-cache";
import { arrVerdicts, type ArrVerdict } from "./arr-truth";
import { correctMediaInfo } from "./live/media-info";

/** Les titres attendus se relisent souvent (une TV les suit) : la liste et la file *arr ont leur cache. */
const MINE_TTL_MS = 10_000;
/** Fiches manquantes d'un titre ATTENDU, récupérées en direct : il y en a peu. */
const MINE_META_BUDGET = 10;

/** Ce que Jellyseerr joint à la fiche d'un film — les champs d'une demande. */
interface MovieDetail {
  title?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  releaseDate?: string | null;
  mediaInfo?: { status?: number };
}

export function registerTitleRoutes(
  app: FastifyInstance,
  db: VigieDb,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  app.get("/titles/state", async (request) => {
    const query = request.query as { keys?: string; lang?: string };
    const keys = parseTitleKeys(query.keys);
    const cfg = await getWorkerConfig();
    if (!cfg || keys.length === 0) return { items: {} };
    // Ni l'un ni l'autre n'est attendu : la réponse part avec ce qu'on sait déjà.
    refreshStatusMap(cfg);
    refreshLocalPending(db);
    const lang = readLang(query.lang);
    const rights = await rightsOf(db, getUser(request).userId, cfg);
    const items: Record<string, TitleStateOut> = {};
    for (const k of keys) {
      const status = statusFor({ key: k.key, mediaType: k.mediaType, tmdbId: k.tmdbId, remoteStatus: undefined });
      const state = titleStateFor(k.mediaType, k.tmdbId, status, rights, lang);
      const page = titlePage(k.mediaType, k.tmdbId, rights, lang);
      items[k.key] = page ? { ...state, page } : state;
    }
    return { items };
  });

  app.post("/titles/request", async (request, reply) => {
    const body = (request.body ?? {}) as { mediaType?: unknown; tmdbId?: unknown; lang?: unknown; seasons?: unknown };
    const mediaType = body.mediaType === "movie" || body.mediaType === "tv" ? body.mediaType : null;
    const tmdbId = Number(body.tmdbId);
    if (!mediaType || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return reply.status(400).send({ ok: false, message: "mediaType and tmdbId are required" });
    }
    const lang = readLang(body.lang);
    const origin = readRequestOrigin(body);
    if (mediaType === "tv") {
      // Une série : ce sont ses saisons qu'on demande. Choisies par le client
      // (`titles.seasons`), elles partent ; sinon, elles se choisissent dans le hub.
      const seasons = parseRequestedSeasons(body.seasons);
      if (!seasons) return { href: seasonsHref(tmdbId) };
      return requestSeasons(db, getWorkerConfig, getUser(request), tmdbId, seasons, lang, origin);
    }

    const cfg = await getWorkerConfig();
    if (!cfg) return { ok: false, message: unreachableMessage(lang) };
    const user = getUser(request);
    const rights = await rightsOf(db, user.userId, cfg);
    const detail = (await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "movie", tmdbId)) as MovieDetail | null;
    if (!detail?.title) return { ok: false, message: unreachableMessage(lang) };

    // Déjà demandé, en route ou là — par quelqu'un d'autre peut-être : la carte se met à jour.
    // Masqué aussi, sauf si l'administrateur laisse demander les titres masqués. Un film
    // supprimé de Jellyfin dont la demande est partie se redemande (live/title-truth.ts).
    const known = correctMediaInfo("movie", tmdbId, detail.mediaInfo)?.status;
    const liftable = known === MEDIA_STATUS.BLOCKLISTED && cfg.allowMaskedRequests === true;
    if (known !== undefined && known >= MEDIA_STATUS.PENDING && known <= MEDIA_STATUS.BLOCKLISTED && !liftable) {
      noteStatus("movie", tmdbId, known);
      return { ok: false, message: refusalMessage(409, {}, lang), state: titleStateFor("movie", tmdbId, known, rights, lang) };
    }

    const result = await submitRequest(db, getWorkerConfig, user, {
      mediaType: "movie",
      tmdbId,
      title: detail.title,
      posterPath: detail.posterPath ?? null,
      backdropPath: detail.backdropPath ?? null,
      overview: detail.overview ?? null,
      year: detail.releaseDate ? detail.releaseDate.slice(0, 4) : null,
    }, origin);
    if (result.status === 201) {
      return {
        ok: true,
        message: requestedMessage(detail.title, lang),
        state: titleStateFor("movie", tmdbId, MEDIA_STATUS.PENDING, rights, lang),
      };
    }
    return { ok: false, message: refusalMessage(result.status, result.body, lang) };
  });

  app.get("/titles/access", async (request) => {
    const cfg = await getWorkerConfig();
    if (!cfg) return { request: false };
    const rights = await rightsOf(db, getUser(request).userId, cfg);
    return { request: rights.movies || rights.tv };
  });

  // `lang` fait partie du contrat ; les titres sont ceux des fiches que Vigie garde déjà.
  app.get("/titles/mine", async (request) => {
    const user = getUser(request);
    const origin = readOriginFilter((request.query as { origin?: unknown }).origin);
    const cfg = await getWorkerConfig();
    if (!cfg) return { items: [] };
    // Une clé par filtre, toutes sous celle du compte : une demande faite les invalide ensemble.
    const key = `seer-cache:${user.userId}:mine${origin === undefined ? "" : `:origin=${origin}`}`;
    return cached(key, MINE_TTL_MS, async () => {
      const rows = await loadMergedRows(db, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));
      const { meta, missing } = await resolveTmdbMeta(db, cfg, collectTmdbRefs(rows), { maxFetch: 0 });
      // Les demandes AVANT les titres : un titre demandé de deux endroits ne garde que les saisons de la sienne.
      const requests = ofOrigin(hydrateRows(rows, meta, user), origin);
      const verdicts = await arrVerdicts(cfg, requests).catch(() => new Map<string, ArrVerdict>());
      let items = myTitles(requests, verdicts);
      // Seules les fiches des titres ATTENDUS sont cherchées en direct : quelques-unes au plus.
      const waiting = new Set(items.map((i) => i.key));
      const absent = missing.filter((ref) => waiting.has(tmdbKey(ref)));
      if (absent.length > 0) {
        const filled = await resolveTmdbMeta(db, cfg, absent, { maxFetch: MINE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = myTitles(ofOrigin(hydrateRows(rows, meta, user), origin), verdicts);
      }
      return { items };
    });
  });
}
