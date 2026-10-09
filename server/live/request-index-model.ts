/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes de Jellyseerr, toutes, tenues à jour (modèle)  */
/* ------------------------------------------------------------------ */

/*
 * Savoir qu'une demande a été supprimée dans Jellyseerr sans relire chacune
 * d'elles : Jellyseerr ne prévient de rien (aucune notification de
 * suppression). Une seule question, minuscule, le dit — la première ligne de
 * `GET /request?sort=modified` et le total :
 *
 *   - une demande ajoutée ou modifiée passe en tête (sa date de modification) ;
 *   - une demande supprimée fait baisser le total.
 *
 * Tant que l'empreinte (total, tête, date de la tête) ne bouge pas, rien n'a
 * bougé. Quand elle bouge : la page des dernières modifications, et — si le
 * total dit qu'il manque des demandes — une relecture complète, qui donne
 * celles qui ont disparu. Ce module décide ; request-index.ts lit Jellyseerr.
 */

export interface IndexedRequest {
  id: number;
  /** 1 en attente, 2 validée, 3 refusée, 4 en échec, 5 terminée. */
  status: number;
  is4k: boolean;
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Saisons demandées (séries). */
  seasons: number[];
  /** Le compte Jellyseerr, et son pendant Jellyfin quand Jellyseerr le donne. */
  requestedBy: { seerrUserId: number | null; jellyfinUserId: string | null; name: string | null };
  createdAt: string | null;
  updatedAt: string | null;
  /** Statut du média chez Jellyseerr au moment de la lecture. */
  mediaStatus: number | null;
}

export interface IndexSignature {
  total: number;
  topId: number | null;
  topUpdatedAt: string | null;
}

export function sameSignature(a: IndexSignature | null, b: IndexSignature | null): boolean {
  return !!a && !!b && a.total === b.total && a.topId === b.topId && a.topUpdatedAt === b.topUpdatedAt;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/** Une ligne de `GET /request`, réduite. `null` : illisible (pas d'id, pas de média). */
export function toIndexed(raw: unknown): IndexedRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = num(r.id);
  const status = num(r.status);
  const media = (r.media && typeof r.media === "object" ? r.media : {}) as Record<string, unknown>;
  const tmdbId = num(media.tmdbId);
  const type = media.mediaType === "tv" || r.type === "tv" ? "tv" : media.mediaType === "movie" || r.type === "movie" ? "movie" : null;
  if (id === null || status === null || tmdbId === null || tmdbId <= 0 || !type) return null;
  const seasons = Array.isArray(r.seasons)
    ? (r.seasons as Array<{ seasonNumber?: unknown }>).map((s) => num(s?.seasonNumber)).filter((n): n is number => n !== null)
    : [];
  const by = (r.requestedBy && typeof r.requestedBy === "object" ? r.requestedBy : {}) as Record<string, unknown>;
  return {
    id,
    status,
    is4k: r.is4k === true,
    mediaType: type,
    tmdbId,
    seasons: [...new Set(seasons)].sort((a, b) => a - b),
    requestedBy: {
      seerrUserId: num(by.id),
      jellyfinUserId: text(by.jellyfinUserId),
      name: text(by.displayName) ?? text(by.jellyfinUsername) ?? text(by.username) ?? text(by.email),
    },
    createdAt: text(r.createdAt),
    updatedAt: text(r.updatedAt),
    mediaStatus: num(media.status),
  };
}

/** L'empreinte rendue par la question minuscule (`take=1`). */
export function signatureOf(page: { pageInfo?: { results?: unknown }; results?: unknown[] } | null): IndexSignature | null {
  if (!page || typeof page !== "object") return null;
  const total = num(page.pageInfo?.results);
  if (total === null) return null;
  const top = Array.isArray(page.results) && page.results.length > 0 ? toIndexed(page.results[0]) : null;
  return { total, topId: top?.id ?? null, topUpdatedAt: top?.updatedAt ?? null };
}

export type IncrementalVerdict =
  /** Les lignes lues suffisent : l'index est à jour. */
  | { kind: "applied"; changed: IndexedRequest[] }
  /** Il manque quelque chose (suppression, rafale) : tout relire. */
  | { kind: "reload" };

/**
 * Applique la page des dernières modifications (`sort=modified`, plus récente
 * d'abord). Relecture complète quand :
 *   - le total est INFÉRIEUR à ce que l'index connaîtrait après la page : des
 *     demandes ont été supprimées (une ajoutée et une supprimée dans la même
 *     fenêtre donnent le même total, mais l'ajoutée gonfle l'index) ;
 *   - toute la page est nouvelle : il y en a peut-être d'autres derrière ;
 *   - le total dépasse l'index : des ajouts nous ont échappé.
 */
export function applyIncremental(
  byId: Map<number, IndexedRequest>,
  page: readonly IndexedRequest[],
  pageSize: number,
  total: number,
  /** Demandes trop anciennes pour avoir été lues (relecture tronquée) : elles comptent dans le total. */
  hidden = 0,
): IncrementalVerdict {
  const changed: IndexedRequest[] = [];
  for (const row of page) {
    const known = byId.get(row.id);
    if (!known || known.updatedAt !== row.updatedAt || known.status !== row.status || known.mediaStatus !== row.mediaStatus) {
      changed.push(row);
    }
  }
  const added = changed.filter((r) => !byId.has(r.id)).length;
  const after = byId.size + added + hidden;
  if (total < after) return { kind: "reload" };
  if (page.length >= pageSize && changed.length === page.length) return { kind: "reload" };
  if (total > after) return { kind: "reload" };
  for (const row of changed) byId.set(row.id, row);
  return { kind: "applied", changed };
}

/**
 * Ce qu'une relecture complète a fait disparaître. Tronquée (trop de
 * demandes pour tout lire), elle ne conclut rien sous la plus ancienne
 * demande lue : l'absence n'y prouve rien.
 */
export function vanished(
  before: ReadonlyMap<number, IndexedRequest>,
  after: readonly IndexedRequest[],
  truncated: boolean,
): number[] {
  const seen = new Set(after.map((r) => r.id));
  const floor = truncated && after.length > 0 ? Math.min(...after.map((r) => r.id)) : -Infinity;
  const out: number[] = [];
  for (const id of before.keys()) if (!seen.has(id) && id >= floor) out.push(id);
  return out.sort((a, b) => a - b);
}

/** « movie:603 » → les demandes du titre. */
export function byTitleOf(rows: Iterable<IndexedRequest>): Map<string, IndexedRequest[]> {
  const out = new Map<string, IndexedRequest[]>();
  for (const row of rows) {
    const key = `${row.mediaType}:${row.tmdbId}`;
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}
