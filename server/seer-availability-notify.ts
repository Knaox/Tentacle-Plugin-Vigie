/* ------------------------------------------------------------------ */
/*  Seer Plugin — Notification de disponibilité (partagée)             */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest } from "./types";
import { evaluateSeasons, seasonNotification, releasedSuffix, goneSeasons } from "./season-availability";
import { setNotifiedSeasons, addSeasonsToRequest, updateRequestStatus } from "./db";
import { invalidateRequestCaches } from "./cache";

/**
 * TV : évalue la dispo PAR-SAISON, notifie le DELTA de saisons devenues dispo
 * (anti-doublon via notified_seasons) et renvoie le statut résultant, ou null
 * si aucune saison demandée n'est encore dispo (l'appelant gère le repli).
 * Utilisé par la sync ET par le chemin « déjà présent » (notifie même sans
 * téléchargement).
 */
export async function notifyAvailableSeasons(
  prisma: PrismaClient,
  request: SeerRequest,
  mediaSeasons: { seasonNumber: number; status: number }[] | undefined,
): Promise<"available" | "partially_available" | null> {
  const ev = evaluateSeasons(request.seasons, mediaSeasons);
  if (ev.available.length === 0) return null;

  const notified = new Set(request.notifiedSeasons ?? []);
  const newly = ev.available.filter((s) => !notified.has(s));
  if (newly.length > 0) {
    const n = seasonNotification(request, newly, ev.available.length);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId, type: "request_status",
        title: n.title, body: n.message, refId: request.id,
      },
    });
    // Union, pas remplacement : Sonarr a pu annoncer une saison que
    // Jellyseerr ne voit pas encore (arr-advance.ts) — l'oublier la
    // réannoncerait à la passe suivante.
    await setNotifiedSeasons(prisma, request.id, [...new Set([...notified, ...ev.available])].sort((a, b) => a - b));
    console.log(`[SeerWorker] "${request.title}" saisons dispo [${newly.join(",")}] → notif`);
  }
  return ev.allAvailable ? "available" : "partially_available";
}

/** Film : notifie « est sorti » une seule fois (flag via notified_seasons non vide). */
export async function notifyMovieAvailable(
  prisma: PrismaClient,
  request: SeerRequest,
): Promise<void> {
  if ((request.notifiedSeasons ?? []).length > 0) return; // déjà notifié
  await prisma.notification.create({
    data: {
      jellyfinUserId: request.jellyfinUserId, type: "request_status",
      title: request.title,
      body: `« ${request.title} » ${releasedSuffix("m", false)}`,
      refId: request.id,
    },
  });
  await setNotifiedSeasons(prisma, request.id, [0]); // flag « film notifié »
  console.log(`[SeerWorker] "${request.title}" (film) dispo → notif`);
}

/**
 * Saisons demandées que Jellyseerr dit SUPPRIMÉES (données retirées) : elles
 * quittent la demande locale, sinon la file locale les verrouillerait encore
 * dans la fiche alors qu'elles sont libres. Rend la demande mise à jour, ou
 * null quand plus aucune saison ne reste — la demande est alors close.
 */
export async function releaseGoneSeasons(
  prisma: PrismaClient,
  request: SeerRequest,
  mediaSeasons: { seasonNumber: number; status: number }[] | undefined,
): Promise<SeerRequest | null> {
  const gone = goneSeasons(request.seasons, mediaSeasons);
  if (gone.length === 0) return request;
  const remaining = (request.seasons ?? []).filter((s) => !gone.includes(s));
  if (remaining.length === 0) {
    await updateRequestStatus(prisma, request.id, "deleted", {
      lastError: "Saisons supprimées côté Jellyseerr",
    });
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprimée(s) côté Jellyseerr → demande close`);
    return null;
  }
  await addSeasonsToRequest(prisma, request.id, remaining);
  invalidateRequestCaches(request.jellyfinUserId);
  console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprimée(s) côté Jellyseerr → reste S${remaining.join(", S")}`);
  return { ...request, seasons: remaining };
}
