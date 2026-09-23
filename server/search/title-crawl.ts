/* ------------------------------------------------------------------ */
/*  Vigie — Construire l'index des titres                              */
/* ------------------------------------------------------------------ */

/*
 * D'où viennent les titres que l'index connaît avant qu'on les cherche : les
 * pages « découvrir » de Jellyseerr, triées par popularité (ce qu'on regarde
 * en ce moment), par nombre de votes (les classiques de toujours), les animés,
 * et ce qui sort bientôt. Environ six mille titres par langue — de quoi
 * répondre instantanément à l'immense majorité des recherches.
 *
 * Toujours en tâche de fond, deux requêtes à la fois : Jellyseerr sert aussi
 * les autres pages pendant ce temps. Une construction complète tous les trois
 * jours, une mise à jour légère (nouveautés, sorties à venir) chaque jour ; le
 * reste s'apprend en cherchant.
 *
 * Le blocage par tags est appliqué À LA SOURCE (`excludeKeywords`) : rien de
 * ce qui est bloqué n'entre dans l'index. Si la liste change, on repart de zéro.
 */

import type { PrismaClient } from "@prisma/client";
import { mapLimit } from "../concurrency";
import { getBlocklistedTags } from "../blocklist";
import type { WorkerCfg } from "../seerr-unified";
import { toRemoteMedia } from "./remote";
import type { TitleIndex, TitleRecord } from "./title-index";
import { clearTitles, flushTitles, loadTitles, queueTitles, readMeta, writeMeta } from "./title-store";

interface Source {
  endpoint: "movies" | "tv";
  query: string;
  pages: number;
  /** Aussi dans la mise à jour quotidienne (ce qui bouge vite). */
  light?: number;
}

const ANIME_KEYWORD = "210024";

function sources(today: string): Source[] {
  return [
    { endpoint: "movies", query: "sortBy=popularity.desc", pages: 60, light: 10 },
    { endpoint: "movies", query: "sortBy=vote_count.desc", pages: 100 },
    { endpoint: "tv", query: "sortBy=popularity.desc", pages: 40, light: 10 },
    { endpoint: "tv", query: "sortBy=vote_count.desc", pages: 60 },
    { endpoint: "tv", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 20, light: 3 },
    { endpoint: "movies", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 8 },
    { endpoint: "movies", query: `primaryReleaseDateGte=${today}&sortBy=popularity.desc`, pages: 10, light: 10 },
    { endpoint: "tv", query: `firstAirDateGte=${today}&sortBy=popularity.desc`, pages: 5, light: 5 },
  ];
}

/** Les langues des titres : celles de l'interface de Tentacle. */
export const CRAWL_LANGS = ["fr", "en"];

const FULL_EVERY_MS = 3 * 86_400_000;
const LIGHT_EVERY_MS = 86_400_000;
const CHECK_EVERY_MS = 3_600_000;
const CONCURRENCY = 2;
/* Un index plus petit que ça n'a pas été construit : on le construit. */
const MIN_BUILT = 1_000;

let state: "idle" | "booting" | "ready" = "idle";
let crawling = false;
let nextCheck = 0;
let fullAt = 0;
let lightAt = 0;
let crawlTags: string | null = null;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toRecord(raw: Record<string, unknown>, lang: string, fallbackType: "movie" | "tv"): TitleRecord | null {
  const media = toRemoteMedia({ ...raw, mediaType: raw.mediaType ?? fallbackType });
  if (!media || !media.title) return null;
  return {
    mediaType: media.mediaType, tmdbId: media.id, lang,
    title: media.title, originalTitle: media.originalTitle, releaseDate: media.releaseDate,
    popularity: media.popularity, voteCount: media.voteCount, voteAverage: media.voteAverage,
    posterPath: media.posterPath, backdropPath: media.backdropPath,
    originalLanguage: media.originalLanguage, genreIds: media.genreIds,
  };
}

async function fetchDiscover(cfg: WorkerCfg, source: Source, page: number, lang: string, tags: string): Promise<TitleRecord[]> {
  const exclude = tags ? `&excludeKeywords=${encodeURIComponent(tags)}` : "";
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/discover/${source.endpoint}?page=${page}&${source.query}${exclude}`,
    { headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  const type = source.endpoint === "movies" ? "movie" : "tv";
  return (data.results ?? []).map((r) => toRecord(r, lang, type)).filter((r): r is TitleRecord => r !== null);
}

async function crawl(prisma: PrismaClient, cfg: WorkerCfg, index: TitleIndex, mode: "full" | "light", tags: string): Promise<void> {
  const jobs: Array<{ source: Source; page: number; lang: string }> = [];
  for (const lang of CRAWL_LANGS) {
    for (const source of sources(todayIso())) {
      const pages = mode === "full" ? source.pages : source.light ?? 0;
      for (let page = 1; page <= pages; page++) jobs.push({ source, page, lang });
    }
  }
  const started = Date.now();
  let learned = 0;
  await mapLimit(jobs, CONCURRENCY, async ({ source, page, lang }) => {
    const records = await fetchDiscover(cfg, source, page, lang, tags);
    for (const r of records) index.upsert(r);
    queueTitles(prisma, records);
    learned += records.length;
  });
  await flushTitles(prisma);
  const now = Date.now();
  if (mode === "full") { fullAt = now; await writeMeta(prisma, "crawl_full_at", String(now)); }
  lightAt = now;
  await writeMeta(prisma, "crawl_light_at", String(now));
  await writeMeta(prisma, "crawl_tags", tags);
  crawlTags = tags;
  console.log(`[Vigie] Index de recherche : ${learned} fiches lues (${mode}) en ${Math.round((now - started) / 1000)} s — ${index.size()} titres`);
}

function launch(prisma: PrismaClient, cfg: WorkerCfg, index: TitleIndex, mode: "full" | "light", tags: string): void {
  if (crawling) return;
  crawling = true;
  void crawl(prisma, cfg, index, mode, tags)
    .catch((err) => console.warn(`[Vigie] Construction de l'index interrompue : ${err instanceof Error ? err.message : err}`))
    .finally(() => { crawling = false; });
}

async function boot(prisma: PrismaClient, cfg: WorkerCfg, index: TitleIndex): Promise<void> {
  const [count, full, light, tags] = await Promise.all([
    loadTitles(prisma, index),
    readMeta(prisma, "crawl_full_at"),
    readMeta(prisma, "crawl_light_at"),
    readMeta(prisma, "crawl_tags"),
  ]);
  fullAt = Number(full) || 0;
  lightAt = Number(light) || 0;
  crawlTags = tags;
  if (count < MIN_BUILT) fullAt = 0;
}

async function check(prisma: PrismaClient, cfg: WorkerCfg, index: TitleIndex): Promise<void> {
  const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
  if (crawlTags !== null && tags !== crawlTags) {
    // Des titres désormais bloqués sont peut-être dans l'index : on le vide.
    index.clear();
    await clearTitles(prisma);
    fullAt = 0;
  }
  const now = Date.now();
  if (now - fullAt > FULL_EVERY_MS) launch(prisma, cfg, index, "full", tags);
  else if (now - lightAt > LIGHT_EVERY_MS) launch(prisma, cfg, index, "light", tags);
}

/**
 * Appelé à chaque recherche, ne fait JAMAIS attendre : relit la base au premier
 * appel, puis vérifie au plus une fois par heure s'il faut reconstruire.
 */
export function ensureTitleIndex(prisma: PrismaClient, cfg: WorkerCfg, index: TitleIndex): void {
  if (state === "booting") return;
  if (state === "idle") {
    state = "booting";
    void boot(prisma, cfg, index)
      .catch((err) => console.warn(`[Vigie] Index de recherche illisible : ${err instanceof Error ? err.message : err}`))
      .finally(() => {
        state = "ready";
        nextCheck = 0;
        ensureTitleIndex(prisma, cfg, index);
      });
    return;
  }
  const now = Date.now();
  if (crawling || now < nextCheck) return;
  nextCheck = now + CHECK_EVERY_MS;
  void check(prisma, cfg, index).catch(() => { nextCheck = now + 60_000; });
}

/** Où en est l'index — pour l'interface (« index en préparation »). */
export function titleIndexBuilding(): boolean {
  return state !== "ready" || crawling;
}
