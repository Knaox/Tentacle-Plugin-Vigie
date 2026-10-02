/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons d'une série, choisies par Tentacle              */
/* ------------------------------------------------------------------ */

/*
 *   GET  /titles/seasons?key=tv:1399&lang=fr
 *        — les saisons d'une série, chacune son état et si elle se demande
 *          encore (titles/title-seasons.ts) : la feuille d'un client qui ne
 *          montre pas nos pages (le téléviseur).
 *   POST /titles/request { mediaType: "tv", tmdbId, lang, seasons: [1, 2], origin? }
 *        — la demande de ces saisons (`requestSeasons`, appelée par
 *          routes-titles.ts) : même porte que le hub (request-submit.ts),
 *          fusion et doublons compris, avec l'origine qu'a lue la route. Sans
 *          `seasons`, une série renvoie toujours le lien du hub : web et
 *          mobile ne changent pas.
 *
 * Déclarée dans `plugin.json` → `titles.seasons` ; un Tentacle d'avant
 * l'ignore.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getUser, type JellyfinUser, type WorkerCfg } from "./seerr-unified";
import { fetchMediaDetail } from "./anime";
import { specialSeasonsQuick } from "./seerr-settings";
import { MEDIA_STATUS } from "./search/status-map";
import { submitRequest } from "./request-submit";
import type { SeerrTvDetail } from "../src/api/types";
import { localRequestedSeasons } from "./titles/local-seasons";
import { readLang, rightsOf } from "./titles/title-rights";
import { freeSeasons, titleSeasons, type SeasonOut } from "./titles/title-seasons";
import { titleStateFor } from "./titles/title-state";
import { refusalMessage, requestedMessage, unreachableMessage } from "./titles/title-messages";
import type { RequestOrigin } from "./titles/request-origin";

const TV_KEY = /^tv:([1-9]\d{0,9})$/;

interface SeasonsRead {
  detail: SeerrTvDetail;
  seasons: SeasonOut[];
}

/** La fiche Jellyseerr d'une série et ses saisons vues par CE compte ; `null` si Jellyseerr se tait. */
async function readSeasons(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  user: JellyfinUser,
  tmdbId: number,
  lang: string,
): Promise<SeasonsRead | null> {
  const detail = (await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "tv", tmdbId)) as SeerrTvDetail | null;
  if (!detail?.name) return null;
  const [local, rights, specials] = await Promise.all([
    localRequestedSeasons(prisma, user.userId, tmdbId).catch(() => [] as number[]),
    rightsOf(prisma, user.userId, cfg),
    specialSeasonsQuick(cfg.seerrUrl, cfg.seerrApiKey),
  ]);
  return { detail, seasons: titleSeasons(detail, local, rights, { specials, lang }) };
}

export function registerTitleSeasonRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  app.get("/titles/seasons", async (request) => {
    const query = request.query as { key?: string; lang?: string };
    const match = typeof query.key === "string" ? TV_KEY.exec(query.key) : null;
    const lang = readLang(query.lang);
    if (!match) return { seasons: [] };
    const cfg = await getWorkerConfig();
    const read = cfg ? await readSeasons(prisma, cfg, getUser(request), Number(match[1]), lang) : null;
    if (!read) return { ok: false, message: unreachableMessage(lang), seasons: [] };
    return { seasons: read.seasons };
  });
}

/**
 * La demande de saisons choisies. Ne part que ce qui se demande encore :
 * rien de libre parmi elles (déjà là, déjà demandées — par quelqu'un d'autre
 * peut-être) → le refus « déjà demandé », et l'état du titre pour sa carte.
 */
export async function requestSeasons(
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  user: JellyfinUser,
  tmdbId: number,
  chosen: readonly number[],
  lang: string,
  origin: RequestOrigin | null = null,
): Promise<Record<string, unknown>> {
  const cfg = await getWorkerConfig();
  if (!cfg) return { ok: false, message: unreachableMessage(lang) };
  const read = await readSeasons(prisma, cfg, user, tmdbId, lang);
  if (!read) return { ok: false, message: unreachableMessage(lang) };
  const rights = await rightsOf(prisma, user.userId, cfg);
  const known = read.detail.mediaInfo?.status;
  const seasons = freeSeasons(chosen, read.seasons);
  if (seasons.length === 0) {
    return { ok: false, message: refusalMessage(409, {}, lang), state: titleStateFor("tv", tmdbId, known, rights, lang) };
  }

  const { detail } = read;
  const result = await submitRequest(prisma, getWorkerConfig, user, {
    mediaType: "tv",
    tmdbId,
    title: detail.name,
    posterPath: detail.posterPath ?? null,
    backdropPath: detail.backdropPath ?? null,
    overview: detail.overview ?? null,
    year: detail.firstAirDate ? detail.firstAirDate.slice(0, 4) : null,
    seasons,
  }, origin);
  if (result.status !== 201) return { ok: false, message: refusalMessage(result.status, result.body, lang) };
  // Une série en partie là le reste ; sinon elle est désormais demandée.
  const after = known === MEDIA_STATUS.PARTIALLY_AVAILABLE ? known : MEDIA_STATUS.PENDING;
  return { ok: true, message: requestedMessage(detail.name, lang), state: titleStateFor("tv", tmdbId, after, rights, lang) };
}
