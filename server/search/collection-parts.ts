/* ------------------------------------------------------------------ */
/*  Vigie — Les volets d'une saga, hors bibliothèque                    */
/* ------------------------------------------------------------------ */

/*
 * La fiche d'un film, dans Tentacle, montre sa saga — mais seulement les
 * films que la bibliothèque a. Les volets qui manquent, ceux qu'on voudrait
 * justement demander, n'y figuraient pas.
 *
 * Même contrat générique que la recherche (`search.collection` du
 * manifeste) : Tentacle donne l'identifiant TMDB de la saga, Vigie rend les
 * volets que la bibliothèque n'a pas. Chacun porte `tmdbId` — celui du film —
 * pour que Tentacle le range à son rang dans la saga ; la petite ligne ne dit
 * que l'année (ou la date de sortie à venir) : Tentacle y ajoute le rang.
 */

import { cached } from "../cache";
import type { WorkerCfg } from "../seerr-unified";
import { MEDIA_STATUS, noteStatus, statusOf } from "./status-map";
import { inLibraryOrBlocked, type ProviderItem, type ProviderResponse } from "./present";

const PARTS_TTL_MS = 30 * 60_000;
const PARTS_STALE_MS = 6 * 3_600_000;

type Raw = Record<string, unknown>;

export interface CollectionPart {
  id: number;
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  status: number | undefined;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Un volet tel que Jellyseerr le rend (`/api/v1/collection/{id}` → `parts`). Illisible : `null`. */
export function toPart(r: Raw): CollectionPart | null {
  const id = typeof r.id === "number" && Number.isInteger(r.id) && r.id > 0 ? r.id : 0;
  const title = str(r.title) ?? str(r.name);
  if (id === 0 || title === null) return null;
  const date = str(r.releaseDate);
  const info = r.mediaInfo as { status?: number } | undefined;
  return {
    id,
    title,
    releaseDate: date !== null && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null,
    posterPath: str(r.posterPath),
    status: typeof info?.status === "number" ? info.status : undefined,
  };
}

const LABELS = {
  fr: { requested: "Demandé", processing: "En cours", upcoming: "À venir", missing: "Pas sur le serveur", release: "Sortie le" },
  en: { requested: "Requested", processing: "In progress", upcoming: "Upcoming", missing: "Not on the server", release: "Out" },
};

function shortDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

/**
 * Un volet manquant, au contrat générique. La pastille dit ce que Vigie sait :
 * demandé, en cours, à venir (pas encore sorti) — sinon « Pas sur le
 * serveur » : dans une rangée où la bibliothèque et ses manques se côtoient,
 * c'est elle qui les distingue.
 */
export function toCollectionItem(p: CollectionPart, status: number | undefined, lang: string, today: string): ProviderItem {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  const upcoming = p.releaseDate === null || p.releaseDate > today;
  const year = p.releaseDate ? Number(p.releaseDate.slice(0, 4)) || null : null;
  const subtitle = upcoming
    ? (p.releaseDate ? `${l.release} ${shortDate(p.releaseDate, lang)}` : null)
    : (year !== null ? String(year) : null);
  const badge = status === MEDIA_STATUS.PENDING
    ? { label: l.requested, tone: "info" as const }
    : status === MEDIA_STATUS.PROCESSING
      ? { label: l.processing, tone: "warning" as const }
      : { label: upcoming ? l.upcoming : l.missing, tone: "neutral" as const };
  return {
    id: `movie:${p.id}`,
    kind: "movie",
    title: p.title,
    year,
    subtitle,
    imageUrl: p.posterPath ? `https://image.tmdb.org/t/p/w185${p.posterPath}` : null,
    href: `/discover?media=movie:${p.id}`,
    badge,
    tmdbId: p.id,
  };
}

/** Les volets à proposer : ni dans la bibliothèque, ni bloqués — dans l'ordre de sortie, les annoncés en dernier. */
export function missingParts(parts: readonly CollectionPart[], statusFor: (p: CollectionPart) => number | undefined): Array<{ part: CollectionPart; status: number | undefined }> {
  return parts
    .map((part) => ({ part, status: statusFor(part) }))
    .filter(({ status }) => !inLibraryOrBlocked(status))
    .sort((a, b) => {
      const left = a.part.releaseDate ?? "9999";
      const right = b.part.releaseDate ?? "9999";
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

async function collectionParts(cfg: WorkerCfg, collectionId: number, lang: string): Promise<CollectionPart[]> {
  return cached(`vigie:collection:${collectionId}:${lang}`, PARTS_TTL_MS, async () => {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/collection/${collectionId}?language=${lang}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Jellyseerr collection ${res.status}`);
    const raw = (await res.json()) as Raw;
    const parts = (Array.isArray(raw.parts) ? (raw.parts as Raw[]) : [])
      .map(toPart)
      .filter((p): p is CollectionPart => p !== null);
    for (const p of parts) noteStatus("movie", p.id, p.status);
    return parts;
  }, { staleMs: PARTS_STALE_MS });
}

export interface CollectionQuery {
  collectionId: number;
  lang: string;
  limit: number;
  today: string;
}

/** Le contrat générique : les volets de la saga que la bibliothèque n'a PAS. */
export async function collectionProvider(cfg: WorkerCfg, q: CollectionQuery): Promise<ProviderResponse> {
  const parts = await collectionParts(cfg, q.collectionId, q.lang);
  const items = missingParts(parts, (p) => statusOf("movie", p.id) ?? p.status)
    .slice(0, q.limit)
    .map(({ part, status }) => toCollectionItem(part, status, q.lang, q.today));
  return { query: String(q.collectionId), correction: null, complete: true, items, moreHref: null };
}
