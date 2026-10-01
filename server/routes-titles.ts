/* ------------------------------------------------------------------ */
/*  Vigie — Les routes du contrat `titles` de Tentacle                 */
/* ------------------------------------------------------------------ */

/*
 *   GET  /titles/state?keys=movie:603,tv:1399&lang=fr
 *        — la pastille et le geste de chaque titre, pour les cartes hors
 *          bibliothèque de Tentacle (recherche, recommandations,
 *          filmographies, sagas). Répond depuis la mémoire : la table des
 *          statuts et la file locale, plus les réglages du compte.
 *   POST /titles/request { mediaType, tmdbId, lang }
 *        — le geste lui-même. Un film se demande sur place, par la même porte
 *          que le hub (request-submit.ts) ; une série renvoie le lien du hub
 *          qui ouvre ses saisons libres. Un refus (quota, droits, déjà
 *          demandé) répond 200 avec `ok: false` et une phrase à afficher :
 *          c'est un résultat, pas une panne.
 *   GET  /titles/access
 *        — le compte peut-il demander quoi que ce soit : `{ request }`, faux
 *          pour un compte bloqué ou sans aucun type permis. Tentacle s'en sert
 *          pour n'offrir AUCUNE de nos fonctions à un tel compte.
 *   GET  /titles/mine?lang=fr
 *        — les titres que le compte attend, un par titre, les plus récents
 *          d'abord, dans un des quatre états de Tentacle (titles/my-titles.ts).
 *          Mêmes verdicts que le hub (Sonarr et Radarr d'abord), sur la même
 *          liste en cache ; sa propre clé, sous celle du compte : une demande
 *          faite l'invalide avec le reste (`invalidateRequestCaches`).
 *
 * Déclarées dans `plugin.json` → `titles`.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { getUserSettings } from "./db";
import { fetchMediaDetail } from "./anime";
import { refreshStatusMap, noteStatus, MEDIA_STATUS } from "./search/status-map";
import { refreshLocalPending } from "./search/pending";
import { statusFor } from "./search/respond";
import { submitRequest } from "./request-submit";
import { parseTitleKeys, seasonsHref, titleStateFor, type RequestRights, type TitleStateOut } from "./titles/title-state";
import { refusalMessage, requestedMessage, unreachableMessage } from "./titles/title-messages";
import { myTitles } from "./titles/my-titles";
import { cached } from "./cache";
import { loadMergedRows } from "./routes-requests-read";
import { collectTmdbRefs, hydrateRows } from "./requests-list";
import { resolveTmdbMeta } from "./tmdb-resolver";
import { tmdbKey } from "./tmdb-cache";
import { arrVerdicts, type ArrVerdict } from "./arr-truth";

/** Les titres attendus se relisent souvent (une TV les suit) : la liste et la file *arr ont leur cache. */
const MINE_TTL_MS = 10_000;
/** Fiches manquantes d'un titre ATTENDU, récupérées en direct : il y en a peu. */
const MINE_META_BUDGET = 10;

function readLang(raw: unknown): string {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}

/** Ce que le compte peut demander ; sans réglages encore, tout (les défauts de Vigie). */
async function rightsOf(prisma: PrismaClient, userId: string, cfg: WorkerCfg | null): Promise<RequestRights> {
  const masked = cfg?.allowMaskedRequests === true;
  const settings = await getUserSettings(prisma, userId).catch(() => null);
  if (!settings) return { movies: true, tv: true, masked };
  if (settings.blocked) return { movies: false, tv: false };
  return { movies: settings.allowMovies, tv: settings.allowTv || settings.allowAnime, masked };
}

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
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  app.get("/titles/state", async (request) => {
    const query = request.query as { keys?: string; lang?: string };
    const keys = parseTitleKeys(query.keys);
    const cfg = await getWorkerConfig();
    if (!cfg || keys.length === 0) return { items: {} };
    // Ni l'un ni l'autre n'est attendu : la réponse part avec ce qu'on sait déjà.
    refreshStatusMap(cfg);
    refreshLocalPending(prisma);
    const lang = readLang(query.lang);
    const rights = await rightsOf(prisma, getUser(request).userId, cfg);
    const items: Record<string, TitleStateOut> = {};
    for (const k of keys) {
      const status = statusFor({ key: k.key, mediaType: k.mediaType, tmdbId: k.tmdbId, remoteStatus: undefined });
      items[k.key] = titleStateFor(k.mediaType, k.tmdbId, status, rights, lang);
    }
    return { items };
  });

  app.post("/titles/request", async (request, reply) => {
    const body = (request.body ?? {}) as { mediaType?: unknown; tmdbId?: unknown; lang?: unknown };
    const mediaType = body.mediaType === "movie" || body.mediaType === "tv" ? body.mediaType : null;
    const tmdbId = Number(body.tmdbId);
    if (!mediaType || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return reply.status(400).send({ ok: false, message: "mediaType and tmdbId are required" });
    }
    const lang = readLang(body.lang);
    // Une série : ce sont ses saisons qu'on demande, et elles se choisissent dans le hub.
    if (mediaType === "tv") return { href: seasonsHref(tmdbId) };

    const cfg = await getWorkerConfig();
    if (!cfg) return { ok: false, message: unreachableMessage(lang) };
    const user = getUser(request);
    const rights = await rightsOf(prisma, user.userId, cfg);
    const detail = (await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "movie", tmdbId)) as MovieDetail | null;
    if (!detail?.title) return { ok: false, message: unreachableMessage(lang) };

    // Déjà demandé, en route ou là — par quelqu'un d'autre peut-être : la carte se met à jour.
    // Masqué aussi, sauf si l'administrateur laisse demander les titres masqués.
    const known = detail.mediaInfo?.status;
    const liftable = known === MEDIA_STATUS.BLOCKLISTED && cfg.allowMaskedRequests === true;
    if (known !== undefined && known >= MEDIA_STATUS.PENDING && known <= MEDIA_STATUS.BLOCKLISTED && !liftable) {
      noteStatus("movie", tmdbId, known);
      return { ok: false, message: refusalMessage(409, {}, lang), state: titleStateFor("movie", tmdbId, known, rights, lang) };
    }

    const result = await submitRequest(prisma, getWorkerConfig, user, {
      mediaType: "movie",
      tmdbId,
      title: detail.title,
      posterPath: detail.posterPath ?? null,
      backdropPath: detail.backdropPath ?? null,
      overview: detail.overview ?? null,
      year: detail.releaseDate ? detail.releaseDate.slice(0, 4) : null,
    });
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
    const rights = await rightsOf(prisma, getUser(request).userId, cfg);
    return { request: rights.movies || rights.tv };
  });

  // `lang` fait partie du contrat ; les titres sont ceux des fiches que Vigie garde déjà.
  app.get("/titles/mine", async (request) => {
    const user = getUser(request);
    const cfg = await getWorkerConfig();
    if (!cfg) return { items: [] };
    return cached(`seer-cache:${user.userId}:mine`, MINE_TTL_MS, async () => {
      const rows = await loadMergedRows(prisma, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));
      const { meta, missing } = await resolveTmdbMeta(prisma, cfg, collectTmdbRefs(rows), { maxFetch: 0 });
      const requests = hydrateRows(rows, meta, user);
      const verdicts = await arrVerdicts(cfg, requests).catch(() => new Map<string, ArrVerdict>());
      let items = myTitles(requests, verdicts);
      // Seules les fiches des titres ATTENDUS sont cherchées en direct : quelques-unes au plus.
      const waiting = new Set(items.map((i) => i.key));
      const absent = missing.filter((ref) => waiting.has(tmdbKey(ref)));
      if (absent.length > 0) {
        const filled = await resolveTmdbMeta(prisma, cfg, absent, { maxFetch: MINE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = myTitles(hydrateRows(rows, meta, user), verdicts);
      }
      return { items };
    });
  });
}
