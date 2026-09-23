/* ------------------------------------------------------------------ */
/*  Seer Plugin — La file de téléchargement du serveur                 */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr ne rapporte l'avancement que des médias QU'IL connaît, c'est-à-dire
 * des demandes passées par lui. Tout ce qu'un administrateur a ajouté
 * directement dans Sonarr ou Radarr — et tout ce que les autres ont demandé —
 * reste invisible. Pour voir ce que la machine récupère vraiment, il faut lire
 * les deux files directement.
 *
 * Elles exposent l'activité de TOUT le serveur : la route qui sert ces données
 * est réservée aux administrateurs.
 */

import type { WorkerCfg } from "./seerr-unified";
import { buildArrUrl, getArrServerConfig, type ArrServerConfig } from "./arr-service";
import { cached, invalidate } from "./cache";
import { isStalledStatus, parseTimeSpan } from "./download-progress";
import { seriesFactsKey } from "./sonarr-episodes";
import { movieFactsKey } from "./radarr-movies";

/** Au-delà, la liste ne se lit plus ; le total reste annoncé. */
const MAX_ITEMS = 60;
/*
 * La file est la même pour tout le monde : UNE lecture toutes les huit
 * secondes, quel que soit le nombre d'onglets ou d'écrans qui la consultent
 * (liste des administrateurs, avancement des demandes, état des épisodes).
 */
const QUEUE_TTL_MS = 8_000;
/* L'état d'un épisode se lit ici : une page large, pas seulement ce qu'on liste. */
const PAGE_SIZE = 250;

export interface QueueEntry {
  /** « sonarr-42 » — clé de rendu stable. */
  id: string;
  source: "sonarr" | "radarr";
  mediaType: "movie" | "tv";
  /** Série ou film. À défaut, le nom de la release. */
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  /** Permet de raccrocher l'entrée à une demande, et une affiche. */
  tmdbId: number | null;
  percent: number | null;
  size: number | null;
  /** Ce qu'il reste à recevoir — un pack de saison le partage entre ses épisodes. */
  sizeLeft: number | null;
  etaSeconds: number | null;
  /** Fichier complet, en attente de vérification et de rangement. */
  validating: boolean;
  paused: boolean;
  /** N'avancera plus tout seul — cf. `isStalledRecord`. Jamais un échec. */
  stalled: boolean;
  /** Message de *arr (« Not an upgrade », « Sample »…), s'il y en a un. */
  warning: string | null;
  /** Empreinte du téléchargement : un pack de saison la partage entre ses épisodes. */
  downloadId: string | null;
}

export interface QueueResponse {
  updatedAt: string;
  items: QueueEntry[];
  total: number;
  /** Services injoignables : mieux vaut le dire que d'afficher « rien en cours ». */
  unreachable: Array<"sonarr" | "radarr">;
}

interface ArrQueueRecord {
  id?: number;
  title?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  status?: string;
  trackedDownloadState?: string;
  trackedDownloadStatus?: string;
  downloadId?: string;
  errorMessage?: string;
  statusMessages?: Array<{ title?: string; messages?: string[] }>;
  seasonNumber?: number;
  episode?: { episodeNumber?: number; title?: string };
  series?: { title?: string; tmdbId?: number };
  movie?: { title?: string; tmdbId?: number };
}

async function fetchQueue(
  server: ArrServerConfig, path: string,
): Promise<{ records: ArrQueueRecord[]; total: number } | null> {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { records?: ArrQueueRecord[]; totalRecords?: number };
    return { records: data.records ?? [], total: data.totalRecords ?? 0 };
  } catch {
    return null;
  }
}

/*
 * `trackedDownloadState` est le signal le plus fiable pour distinguer un
 * fichier qui descend d'un fichier déjà là qu'on vérifie : Sonarr le passe à
 * `importPending` puis `importing` avant de le ranger.
 */
function isValidating(r: ArrQueueRecord): boolean {
  const state = r.trackedDownloadState ?? "";
  if (state === "importPending" || state === "importing") return true;
  if (r.status === "completed") return true;
  return r.sizeleft === 0 && typeof r.size === "number" && r.size > 0;
}

/* Import refusé ou raté : le fichier est là, *arr ne le rangera pas seul. */
const BLOCKED_STATES = new Set(["importBlocked", "importFailed", "failedPending", "failed"]);

/**
 * Bloqué : source morte, client injoignable, pause, import refusé. Jellyseerr
 * ne relaie que le statut du client — c'est ici seulement qu'un import refusé
 * se voit, là où il ressemblait sinon à une vérification sans fin.
 */
export function isStalledRecord(r: Pick<ArrQueueRecord, "status" | "trackedDownloadState" | "trackedDownloadStatus">): boolean {
  return isStalledStatus(r.status)
    || BLOCKED_STATES.has(r.trackedDownloadState ?? "")
    || r.trackedDownloadStatus === "error";
}

function firstMessage(r: ArrQueueRecord): string | null {
  if (r.errorMessage) return r.errorMessage;
  for (const m of r.statusMessages ?? []) {
    const text = m.messages?.[0] ?? m.title;
    if (text) return text;
  }
  return null;
}

function toEntry(r: ArrQueueRecord, source: "sonarr" | "radarr"): QueueEntry | null {
  if (r.id == null) return null;

  const size = typeof r.size === "number" && r.size > 0 ? r.size : null;
  const left = typeof r.sizeleft === "number" ? Math.max(0, r.sizeleft) : null;
  const percent = size != null && left != null
    ? Math.min(100, Math.max(0, ((size - left) / size) * 100))
    : null;

  const media = source === "sonarr" ? r.series : r.movie;
  const stalled = isStalledRecord(r);

  return {
    id: `${source}-${r.id}`,
    source,
    mediaType: source === "sonarr" ? "tv" : "movie",
    title: media?.title ?? r.title ?? "",
    seasonNumber: r.seasonNumber ?? null,
    episodeNumber: r.episode?.episodeNumber ?? null,
    episodeTitle: r.episode?.title ?? null,
    tmdbId: media?.tmdbId ?? null,
    percent,
    size,
    sizeLeft: size != null ? left : null,
    etaSeconds: parseTimeSpan(r.timeleft),
    validating: isValidating(r) && !stalled,
    paused: r.status === "paused" || r.status === "delay",
    stalled,
    warning: stalled || r.status === "warning" || r.status === "failed" ? firstMessage(r) : null,
    downloadId: typeof r.downloadId === "string" && r.downloadId !== "" ? r.downloadId : null,
  };
}

/* Les titres présents dans la file à la lecture précédente. */
let lastInQueue = new Set<string>();

/**
 * Un titre qui QUITTE la file vient d'être importé (ou abandonné) : ce qu'on
 * savait de ses fichiers est périmé. On l'oublie, et la lecture suivante dit
 * « Disponible » sans attendre la fin d'un cache — ni Jellyseerr.
 */
function forgetFilesOfLeavers(items: readonly QueueEntry[], unreachable: ReadonlyArray<"sonarr" | "radarr">): void {
  const now = new Set(items.filter((e) => e.tmdbId != null).map((e) => `${e.source}:${e.tmdbId}`));
  for (const key of lastInQueue) {
    const [source, id] = key.split(":");
    // Un service muet n'a rien vidé : ses titres ne sont pas partis.
    if (now.has(key) || unreachable.includes(source as "sonarr" | "radarr")) continue;
    invalidate(source === "radarr" ? movieFactsKey(Number(id)) : seriesFactsKey(Number(id)));
  }
  const kept = [...lastInQueue].filter((key) => unreachable.includes(key.split(":")[0] as "sonarr" | "radarr"));
  lastInQueue = new Set([...now, ...kept]);
}

/** Les deux files, normalisées, ENTIÈRES. Un service en panne n'empêche pas l'autre. */
async function readQueues(cfg: WorkerCfg): Promise<QueueResponse> {
  const [sonarr, radarr] = await Promise.all([
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr"),
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr"),
  ]);

  const [sq, rq] = await Promise.all([
    sonarr
      ? fetchQueue(sonarr, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeSeries=true&includeEpisode=true`)
      : Promise.resolve(null),
    radarr
      ? fetchQueue(radarr, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeMovie=true`)
      : Promise.resolve(null),
  ]);

  const unreachable: Array<"sonarr" | "radarr"> = [];
  if (!sq) unreachable.push("sonarr");
  if (!rq) unreachable.push("radarr");

  const items = [
    ...(sq?.records ?? []).map((r) => toEntry(r, "sonarr")),
    ...(rq?.records ?? []).map((r) => toEntry(r, "radarr")),
  ].filter((e): e is QueueEntry => e !== null);

  // Les plus avancés d'abord : c'est ce qui va arriver en premier.
  items.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.title.localeCompare(b.title));
  forgetFilesOfLeavers(items, unreachable);

  return {
    updatedAt: new Date().toISOString(),
    items,
    total: (sq?.total ?? 0) + (rq?.total ?? 0),
    unreachable,
  };
}

/** La file entière, lue une fois pour tous (cf. QUEUE_TTL_MS). */
export function queueSnapshot(cfg: WorkerCfg): Promise<QueueResponse> {
  return cached("seer:arr:queue:all", QUEUE_TTL_MS, () => readQueues(cfg));
}

/** Ce que voient les administrateurs : la file, plafonnée à ce qui se lit. */
export async function fetchServerQueue(cfg: WorkerCfg): Promise<QueueResponse> {
  const snapshot = await queueSnapshot(cfg);
  return { ...snapshot, items: snapshot.items.slice(0, MAX_ITEMS) };
}
