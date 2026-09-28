/* ------------------------------------------------------------------ */
/*  Vigie — Faire une demande (les règles du compte, puis la file)      */
/* ------------------------------------------------------------------ */

/*
 * UNE porte pour toute demande, d'où qu'elle vienne : le hub (`POST
 * /requests`) comme les cartes de Tentacle (`POST /titles/request`). Elle
 * applique les règles du compte dans l'ordre — blocage, type permis (animé
 * compris), quota du jour, fusion des saisons d'une série déjà demandée,
 * doublon — puis met la demande dans la file du worker. Deux portes auraient
 * fini par ne plus appliquer les mêmes règles.
 */

import type { PrismaClient } from "@prisma/client";
import {
  createRequest, getRequestById,
  findDuplicate,
  findExistingTvRequest, addSeasonsToRequest,
  getOrCreateUserSettings, countRequestsToday,
} from "./db";
import type { CreateRequestBody } from "./types";
import { fetchMediaDetail, isAnimeFromKeywords } from "./anime";
import { invalidateRequestCaches } from "./cache";
import { kickWorkerNow } from "./worker";
import type { JellyfinUser, WorkerCfg } from "./seerr-unified";
import { markLocallyPending } from "./search/pending";
import { effectiveDailyLimit } from "./plugin-config";

/** Ce que la route renvoie : un code HTTP et son corps, tels quels. */
export interface SubmitResult {
  status: number;
  body: Record<string, unknown>;
}

export async function submitRequest(
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
  user: JellyfinUser,
  body: CreateRequestBody,
): Promise<SubmitResult> {
  if (!body.mediaType || !body.tmdbId || !body.title) {
    return { status: 400, body: { message: "mediaType, tmdbId, and title are required" } };
  }

  // 1) Charge ou crée les settings du user
  const settings = await getOrCreateUserSettings(prisma, user.userId, user.username);

  // 2) Blocage
  if (settings.blocked) {
    return { status: 403, body: { errorKey: "seer:errUserBlocked", message: "User is blocked" } };
  }

  // 3) Détection du type réel (anime ?)
  let isAnime = false;
  const config = await getWorkerConfig();
  if (body.mediaType === "tv" && config) {
    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", body.tmdbId);
    if (detail && isAnimeFromKeywords(detail)) isAnime = true;
  }

  // 4) Permission par type
  if (body.mediaType === "movie" && !settings.allowMovies) {
    return { status: 403, body: { errorKey: "seer:errMoviesDenied", message: "Movies denied" } };
  }
  if (body.mediaType === "tv" && isAnime && !settings.allowAnime) {
    return { status: 403, body: { errorKey: "seer:errAnimeDenied", message: "Anime denied" } };
  }
  if (body.mediaType === "tv" && !isAnime && !settings.allowTv) {
    return { status: 403, body: { errorKey: "seer:errTvDenied", message: "TV denied" } };
  }

  // 5) Quota quotidien — le plafond du compte, sinon celui par défaut (qui
  //    était enregistré par la page d'administration mais jamais appliqué).
  const limit = effectiveDailyLimit(settings.dailyLimit, config?.defaultDailyLimit ?? null);
  if (limit !== null) {
    const todayCount = await countRequestsToday(prisma, user.userId);
    if (todayCount >= limit) {
      return {
        status: 429,
        body: { errorKey: "seer:errQuotaReached", limit, message: `Daily quota reached (${limit})` },
      };
    }
  }

  // 6) TV : fusion saisons (existant)
  if (body.mediaType === "tv" && body.seasons?.length) {
    const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
    if (existing) {
      const existingSeasons = new Set(existing.seasons ?? []);
      const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
      if (newSeasons.length === 0) {
        return { status: 409, body: { message: "All seasons already requested", existing } };
      }

      const merged = [...(existing.seasons ?? []), ...newSeasons].sort((a, b) => a - b);
      await addSeasonsToRequest(prisma, existing.id, merged);

      await createRequest(prisma, {
        jellyfinUserId: user.userId, username: user.username,
        mediaType: body.mediaType, tmdbId: body.tmdbId, title: body.title,
        posterPath: body.posterPath, backdropPath: body.backdropPath,
        overview: body.overview, year: body.year,
        seasons: newSeasons,
        profileId: body.profileId ?? existing.profileId,
        isAnime,
      });

      const updated = await getRequestById(prisma, existing.id);
      invalidateRequestCaches(user.userId);
      markLocallyPending(body.mediaType, body.tmdbId);
      kickWorkerNow();
      return { status: 201, body: updated as unknown as Record<string, unknown> };
    }
  }

  // 7) Doublon film / 1ère TV
  const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType, body.seasons);
  if (dup) {
    return { status: 409, body: { message: "A request for this media is already active", existing: dup } };
  }

  const req = await createRequest(prisma, {
    jellyfinUserId: user.userId, username: user.username,
    mediaType: body.mediaType, tmdbId: body.tmdbId, title: body.title,
    posterPath: body.posterPath, backdropPath: body.backdropPath,
    overview: body.overview, year: body.year, seasons: body.seasons,
    profileId: body.profileId,
    isAnime,
  });

  invalidateRequestCaches(user.userId);
  // La recherche dit « Demandé » tout de suite, sans attendre le worker.
  markLocallyPending(body.mediaType, body.tmdbId);
  kickWorkerNow();
  return { status: 201, body: req as unknown as Record<string, unknown> };
}
