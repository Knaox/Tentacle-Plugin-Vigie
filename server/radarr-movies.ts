/* ------------------------------------------------------------------ */
/*  Vigie — Ce que Radarr sait d'un film : son fichier est-il là ?     */
/* ------------------------------------------------------------------ */

/*
 * La file dit ce qui arrive ; le fichier, ce qui est arrivé. Jellyseerr ne le
 * constate qu'à son prochain passage — Radarr, lui, le sait dès l'import. Une
 * lecture par film, pour les seuls films encore attendus, gardée trente
 * secondes : la file l'oublie dès que le film en sort (cf. arr-queue.ts).
 */

import type { WorkerCfg } from "./seerr-unified";
import { getArrServerConfig } from "./arr-service";
import { arrGet } from "./sonarr-schedule";
import { cached } from "./cache";

const MOVIE_TTL_MS = 30_000;

/** La clé de cache du fichier d'un film — la file l'oublie quand le film en sort. */
export const movieFactsKey = (tmdbId: number) => `seer:radarr:movie:${tmdbId}`;

/** Le fichier du film est-il là ? `null` : Radarr absent ou muet — on n'en sait rien. */
export async function radarrHasFile(cfg: WorkerCfg, tmdbId: number): Promise<boolean | null> {
  const server = await getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr");
  if (!server) return null;
  return cached(movieFactsKey(tmdbId), MOVIE_TTL_MS, async () => {
    const movies = await arrGet<Array<{ hasFile?: boolean }>>(server, `/api/v3/movie?tmdbId=${tmdbId}`);
    // Muet n'est pas « pas de fichier » : lever, ne rien graver.
    if (movies === null) throw new Error("Radarr injoignable (fichier d'un film)");
    return movies.some((m) => m.hasFile === true);
  }).catch(() => null);
}
