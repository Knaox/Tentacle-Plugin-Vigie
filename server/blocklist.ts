/* ------------------------------------------------------------------ */
/*  Seer Plugin — Blocage par tags Jellyseerr                          */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr stocke les keywords TMDB bloqués dans `settings.main.blocklistedTags`
 * (IDs séparés par des virgules). On applique ce blocage sur 3 surfaces :
 *   1. Discover (movies/tv/anime) : on passe les tags en `excludeKeywords`
 *      → TMDB `without_keywords`, exclusion native à la source (pagination propre).
 *   2. Search / trending : TMDB multi-search n'accepte PAS `without_keywords`, et
 *      le job `process-blocklisted-tags` de Jellyseerr ne couvre qu'une fraction du
 *      catalogue. On filtre donc en lisant les keywords de chaque résultat
 *      (`/api/v1/{movie|tv}/{id}` → champ `keywords`), avec cache 7 j.
 *   3. Toutes surfaces : on retire aussi les médias déjà au statut BLOCKLISTED (6).
 *
 * Le filtrage est désactivable par requête via `?_showBlocked=1` (bouton
 * « Afficher quand même »). On renvoie alors `blockedCount`/`blockedActive` pour
 * que l'UI sache combien d'éléments sont masqués.
 *
 * `settings.main` et le détail ne sont lisibles qu'avec la clé d'API admin
 * (déjà détenue côté plugin).
 */

import { cached } from "./cache";
import { mapLimit } from "./concurrency";
import { getSeerrMainSettings } from "./seerr-settings";

export const MEDIA_STATUS_BLOCKLISTED = 6;
const KEYWORD_FETCH_CONCURRENCY = 8;

export interface ResultItem {
  id?: number;
  mediaType?: string;
  mediaInfo?: { status?: number };
}

export async function getBlocklistedTags(seerrUrl: string, apiKey: string): Promise<string> {
  return ((await getSeerrMainSettings(seerrUrl, apiKey)).blocklistedTags ?? "").trim();
}

/** Convertit la CSV `blocklistedTags` en Set d'IDs numériques. */
export function parseTagSet(csv: string): Set<number> {
  const set = new Set<number>();
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}

/** IDs de keywords TMDB d'un média (cache 7 j — les keywords bougent très peu). */
export async function getItemKeywordIds(
  seerrUrl: string,
  apiKey: string,
  mediaType: "movie" | "tv",
  id: number,
): Promise<number[]> {
  return cached(`seerr:kw:${mediaType}:${id}`, 7 * 86_400_000, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${id}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { keywords?: Array<{ id?: number }> };
      return Array.isArray(data.keywords)
        ? data.keywords.map((k) => k?.id).filter((x): x is number => typeof x === "number")
        : [];
    } catch {
      return [];
    }
  });
}

/**
 * Filtre une page de résultats (search/trending) en récupérant les keywords de
 * chaque film/série et en retirant ceux qui intersectent les tags bloqués.
 * Les `person` sont conservées (pas de keywords). Retourne la liste filtrée et
 * le nombre d'éléments masqués.
 */
export async function filterResultsByTags(
  seerrUrl: string,
  apiKey: string,
  results: ResultItem[],
  blockedSet: Set<number>,
): Promise<{ kept: ResultItem[]; blockedCount: number }> {
  // 1) Retrait immédiat des éléments déjà marqués BLOCKLISTED par Jellyseerr.
  const afterStatus = results.filter((r) => r?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED);
  let blockedCount = results.length - afterStatus.length;

  // 2) Vérification par keywords (films/séries uniquement), bornée en concurrence.
  const blockedFlags = new Array<boolean>(afterStatus.length).fill(false);
  const checkable = afterStatus
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.mediaType === "movie" || item.mediaType === "tv") && typeof item.id === "number");

  await mapLimit(checkable, KEYWORD_FETCH_CONCURRENCY, async ({ item, idx }) => {
    const kwIds = await getItemKeywordIds(
      seerrUrl,
      apiKey,
      item.mediaType as "movie" | "tv",
      item.id as number,
    );
    if (kwIds.some((id) => blockedSet.has(id))) blockedFlags[idx] = true;
  });

  const kept = afterStatus.filter((_, idx) => !blockedFlags[idx]);
  blockedCount += afterStatus.length - kept.length;
  return { kept, blockedCount };
}

