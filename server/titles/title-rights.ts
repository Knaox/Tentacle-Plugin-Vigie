/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le compte peut demander, et dans quelle langue       */
/* ------------------------------------------------------------------ */

/*
 * Commun aux routes du contrat `titles` (routes-titles.ts,
 * routes-titles-seasons.ts) : les droits du compte selon ses réglages Vigie,
 * et la langue des mots qu'on renvoie à Tentacle.
 */

import type { PrismaClient } from "@prisma/client";
import { getUserSettings } from "../db";
import type { WorkerCfg } from "../seerr-unified";
import type { RequestRights } from "./title-state";

export function readLang(raw: unknown): string {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}

/** Ce que le compte peut demander ; sans réglages encore, tout (les défauts de Vigie). */
export async function rightsOf(prisma: PrismaClient, userId: string, cfg: WorkerCfg | null): Promise<RequestRights> {
  const masked = cfg?.allowMaskedRequests === true;
  const settings = await getUserSettings(prisma, userId).catch(() => null);
  if (!settings) return { movies: true, tv: true, masked };
  if (settings.blocked) return { movies: false, tv: false };
  return { movies: settings.allowMovies, tv: settings.allowTv || settings.allowAnime, masked };
}
