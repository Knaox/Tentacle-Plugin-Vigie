/* ------------------------------------------------------------------ */
/*  Vigie — Une source morte : écartée, et la recherche relancée        */
/* ------------------------------------------------------------------ */

/*
 * Sonarr et Radarr savent quoi faire d'un transfert ÉCHOUÉ (la source est
 * écartée, une autre est cherchée) — pas d'un transfert à l'ARRÊT : un fichier
 * que plus personne ne partage (qBittorrent le dit « stalled ») reste dans
 * leur file pour toujours. L'avis promet pourtant au compte qu'« il sera
 * recherché à nouveau automatiquement » : Vigie tient la promesse.
 *
 * Une entrée de la file liée à une demande suivie, bloquée pour `noSource`
 * SANS qu'un octet arrive pendant STALLED_RESEARCH_MS, est retirée du client
 * et mise sur liste noire, recherche relancée — le geste « Remove, blocklist
 * and search » de Sonarr et Radarr, par leur API
 * (`DELETE /api/v3/queue/{id}?removeFromClient=true&blocklist=true&skipRedownload=false`).
 * Une seule fois par téléchargement (un pack de saison est UN téléchargement
 * pour plusieurs entrées). Rien d'autre n'est touché : ni les titres que
 * personne n'a demandés par Vigie, ni ce qui avance, même lentement.
 *
 * La règle est pure (horloge injectée) ; la mémoire vit en mémoire : un
 * redémarrage reprend le compte à zéro (au pire, une relance plus tard).
 */

import type { QueueEntry } from "../arr-queue";

/** Six heures sans un octet : la source ne reviendra pas d'elle-même. */
export const STALLED_RESEARCH_MS = 6 * 60 * 60_000;

export interface StalledTrack {
  since: number;
  sizeLeft: number | null;
}

/** Une passe pour une entrée de la file : faut-il relancer sa recherche ? */
export function stepStalled(
  prev: StalledTrack | null, entry: Pick<QueueEntry, "stalled" | "cause" | "sizeLeft">, now: number,
): { track: StalledTrack | null; due: boolean } {
  if (!entry.stalled || entry.cause !== "noSource") return { track: null, due: false };
  if (!prev) return { track: { since: now, sizeLeft: entry.sizeLeft }, due: false };
  // Des octets arrivent encore : la source n'est pas morte, le compte repart.
  if (prev.sizeLeft != null && entry.sizeLeft != null && entry.sizeLeft < prev.sizeLeft) {
    return { track: { since: now, sizeLeft: entry.sizeLeft }, due: false };
  }
  return { track: prev, due: now - prev.since >= STALLED_RESEARCH_MS };
}

/** Le numéro de l'entrée chez Sonarr ou Radarr (« sonarr-42 » → 42). */
export function queueRecordId(entry: Pick<QueueEntry, "id">): number | null {
  const n = Number(/^(?:sonarr|radarr)-(\d+)$/.exec(entry.id)?.[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Ce qui retire l'entrée et relance la recherche — injecté par les tests. */
export type ResearchStalled = (entry: QueueEntry, recordId: number) => Promise<boolean>;

const tracks = new Map<string, StalledTrack>();
/** Téléchargements déjà relancés (empreinte, sinon l'entrée). */
const relaunched = new Set<string>();

/** Une passe sur les entrées d'une demande ; rend ce qui a été relancé. */
export async function researchStalledEntries(
  entries: readonly QueueEntry[], now: number, research: ResearchStalled,
): Promise<QueueEntry[]> {
  const out: QueueEntry[] = [];
  for (const entry of entries) {
    const step = stepStalled(tracks.get(entry.id) ?? null, entry, now);
    if (step.track) tracks.set(entry.id, step.track);
    else tracks.delete(entry.id);
    const download = entry.downloadId ?? entry.id;
    const recordId = queueRecordId(entry);
    if (!step.due || recordId === null || relaunched.has(download)) continue;
    // Réservé AVANT l'appel : une passe concurrente ne relance pas deux fois.
    relaunched.add(download);
    if (await research(entry, recordId).catch(() => false)) out.push(entry);
    else relaunched.delete(download);
  }
  return out;
}

/** Les entrées sorties de la file ne gardent rien en mémoire. */
export function pruneStalledResearch(alive: ReadonlySet<string>, aliveDownloads: ReadonlySet<string>): void {
  for (const id of tracks.keys()) if (!alive.has(id)) tracks.delete(id);
  for (const key of relaunched) if (!alive.has(key) && !aliveDownloads.has(key)) relaunched.delete(key);
}

/** Tests seulement. */
export function resetStalledResearch(): void {
  tracks.clear();
  relaunched.clear();
}
