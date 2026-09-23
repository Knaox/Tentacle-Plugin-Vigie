/* ------------------------------------------------------------------ */
/*  Seer Plugin — Avancement réel des téléchargements                  */
/* ------------------------------------------------------------------ */

import type { DownloadProgress } from "./types";

/**
 * Élément de `media.downloadStatus` renvoyé par Jellyseerr (relais de la file
 * Sonarr / Radarr). Tout est optionnel : ce n'est pas un contrat stable, et les
 * champs manquent réellement dans certains états (recherche en cours).
 */
export interface SeerrDownloadItem {
  mediaType?: string;
  externalId?: number;
  size?: number;
  sizeLeft?: number;
  status?: string;
  /** TimeSpan .NET : « 00:12:34 » ou « 1.02:03:04 » (1 j 2 h 3 min 4 s). */
  timeLeft?: string;
  estimatedCompletionTime?: string;
  title?: string;
  /** Empreinte du téléchargement — la même clé que dans la file *arr. */
  downloadId?: string;
  episode?: { seasonNumber?: number; episodeNumber?: number; title?: string };
}

/*
 * Ce qui, dans la file *arr, n'avancera plus tout seul : une source morte
 * (`warning` — qBittorrent « stalled » y arrive ainsi), un client injoignable,
 * une pause. `delay` n'en est pas : c'est un profil de délai, le téléchargement
 * partira à l'heure dite.
 */
const STALLED_STATUSES = new Set(["warning", "failed", "paused", "downloadClientUnavailable"]);

export function isStalledStatus(status: string | undefined): boolean {
  return typeof status === "string" && STALLED_STATUSES.has(status);
}

/**
 * Convertit un TimeSpan .NET en secondes.
 *
 * Piège : les jours précèdent un POINT, pas un deux-points. Un `split(":")`
 * naïf lit « 1.02:03:04 » comme 1,02 heure au lieu de 26 heures.
 */
export function parseTimeSpan(raw: string | undefined): number | null {
  if (!raw || typeof raw !== "string") return null;

  let rest = raw.trim();
  let days = 0;

  // « 1.02:03:04 » → jours en tête. À ne pas confondre avec les fractions de
  // seconde finales (« 00:12:34.5670000 »), qui suivent le dernier deux-points.
  const dot = rest.indexOf(".");
  if (dot > 0 && dot < rest.indexOf(":")) {
    days = Number(rest.slice(0, dot));
    rest = rest.slice(dot + 1);
    if (!Number.isFinite(days)) return null;
  }

  const parts = rest.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;

  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  const total = days * 86_400 + h * 3_600 + m * 60 + s;
  return total >= 0 ? Math.round(total) : null;
}

function etaFrom(item: SeerrDownloadItem): { seconds: number | null; at: string | null } {
  const fromSpan = parseTimeSpan(item.timeLeft);
  const at = item.estimatedCompletionTime ?? null;

  if (fromSpan != null) return { seconds: fromSpan, at };

  if (at) {
    const ms = new Date(at).getTime() - Date.now();
    // Une échéance dans le passé est fréquente en fin de téléchargement :
    // mieux vaut ne rien annoncer qu'un temps restant négatif.
    if (Number.isFinite(ms) && ms > 0) return { seconds: Math.round(ms / 1000), at };
  }
  return { seconds: null, at };
}

/*
 * Fichier complet, mais pas encore rangé dans la bibliothèque.
 *
 * À ce moment-là Jellyseerr repasse la demande en « Demandé » — le download
 * n'est plus actif de son point de vue — alors que l'entrée reste dans la file
 * *arr le temps de la vérification et de l'import. D'où l'écart signalé : le
 * plugin affichait « En téléchargement » quand Jellyseerr disait autre chose.
 *
 * Rien n'est écrit en base : c'est un simple indice de rendu.
 */
function isValidating(size: number | null, sizeLeft: number | null, status: string): boolean {
  if (status === "completed" || status === "importPending" || status === "importing") return true;
  return sizeLeft === 0 && size != null && size > 0;
}

/** null si l'élément n'est pas exploitable. Ne jette jamais. */
export function toDownloadProgress(item: SeerrDownloadItem): DownloadProgress | null {
  if (!item || typeof item !== "object") return null;

  const size = Number.isFinite(item.size) && (item.size as number) > 0 ? (item.size as number) : null;
  const sizeLeft = Number.isFinite(item.sizeLeft) ? Math.max(0, item.sizeLeft as number) : null;

  let percent: number | null = null;
  if (size != null && sizeLeft != null) {
    // sizeLeft > size arrive sur les arrondis *arr → on borne.
    percent = Math.min(100, Math.max(0, ((size - sizeLeft) / size) * 100));
  }

  const eta = etaFrom(item);
  const status = typeof item.status === "string" ? item.status : "downloading";

  return {
    percent,
    size,
    sizeLeft,
    etaSeconds: eta.seconds,
    estimatedCompletionAt: eta.at,
    status,
    validating: isValidating(size, sizeLeft, status),
    stalled: isStalledStatus(status),
    title: item.title ?? item.episode?.title ?? null,
    seasonNumber: item.episode?.seasonNumber ?? null,
    episodeNumber: item.episode?.episodeNumber ?? null,
  };
}

/*
 * Nombre d'épisodes détaillés renvoyés au front. Douze suffisaient pour un
 * compteur ; il en faut le double pour un rendu par saison, une saison
 * complète en alignant couramment vingt-quatre.
 */
const MAX_DETAIL_ITEMS = 24;

/**
 * Agrège les téléchargements d'un même média.
 * - `percent` : (Σtaille − Σrestant) / Σtaille sur les seuls éléments dimensionnés.
 * - `etaSeconds` : le plus long des délais connus (c'est lui qui borne la fin).
 * - `status` : « downloading » dès qu'au moins un l'est.
 * - `stalled` : rien n'avance plus — tout ce qui n'est pas arrivé est bloqué.
 *
 * `isBlocked` lit la file *arr elle-même (par empreinte de téléchargement) :
 * Jellyseerr ne relaie que le statut du client, si bien qu'un import refusé
 * (« completed » de son point de vue) se lisait « presque là » indéfiniment.
 */
export function aggregateDownloads(
  items: readonly SeerrDownloadItem[] | undefined,
  isBlocked?: (downloadId: string) => boolean,
): { summary: DownloadProgress | null; items: DownloadProgress[] } {
  if (!Array.isArray(items) || items.length === 0) return { summary: null, items: [] };

  const parsed: DownloadProgress[] = [];
  for (const raw of items) {
    const p = toDownloadProgress(raw);
    if (!p) continue;
    if (!p.stalled && raw.downloadId && isBlocked?.(raw.downloadId)) {
      // Un fichier complet que *arr refuse d'importer n'est pas « en vérification ».
      p.stalled = true;
      p.validating = false;
    }
    parsed.push(p);
  }
  if (parsed.length === 0) return { summary: null, items: [] };

  let totalSize = 0;
  let totalLeft = 0;
  let sized = 0;
  let maxEta: number | null = null;
  let latestAt: string | null = null;

  for (const p of parsed) {
    if (p.size != null && p.sizeLeft != null) {
      totalSize += p.size;
      totalLeft += p.sizeLeft;
      sized++;
    }
    if (p.etaSeconds != null && (maxEta === null || p.etaSeconds > maxEta)) maxEta = p.etaSeconds;
    if (p.estimatedCompletionAt && (!latestAt || p.estimatedCompletionAt > latestAt)) {
      latestAt = p.estimatedCompletionAt;
    }
  }

  const active = parsed.find((p) => p.status === "downloading") ?? parsed[0];
  const stalledCount = parsed.filter((p) => p.stalled).length;
  const percent = sized > 0 && totalSize > 0
    ? Math.min(100, Math.max(0, ((totalSize - totalLeft) / totalSize) * 100))
    : null;

  const summary: DownloadProgress = {
    percent,
    size: sized > 0 ? totalSize : null,
    sizeLeft: sized > 0 ? totalLeft : null,
    etaSeconds: maxEta,
    estimatedCompletionAt: latestAt,
    status: parsed.some((p) => p.status === "downloading") ? "downloading" : active.status,
    // `every` et non `some` : tant qu'un seul épisode descend encore, la
    // demande télécharge réellement — ce n'est pas de la validation.
    validating: parsed.every((p) => p.validating),
    // Un épisode bloqué parmi d'autres qui avancent : la demande avance.
    stalled: stalledCount > 0 && parsed.every((p) => p.stalled || p.validating),
    stalledCount,
    title: parsed.length === 1 ? active.title : null,
    seasonNumber: parsed.length === 1 ? active.seasonNumber : null,
    episodeNumber: parsed.length === 1 ? active.episodeNumber : null,
  };

  // Les plus avancés d'abord : c'est ce qu'on veut voir en tête de liste.
  const detail = parsed
    .slice()
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .slice(0, MAX_DETAIL_ITEMS);

  return { summary, items: detail };
}
