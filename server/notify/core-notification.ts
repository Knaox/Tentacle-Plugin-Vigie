/* ------------------------------------------------------------------ */
/*  Vigie — Où mène une notification, et l'état qu'elle dit            */
/* ------------------------------------------------------------------ */

/*
 * Le cœur de Tentacle (≥ 1.30.0) range avec chaque notification une CIBLE et
 * un ÉTAT (contrat `notifications/notificationTarget.ts` du cœur) ; il n'en
 * connaît pas le sens, c'est Vigie qui les pose :
 *
 *   - un titre ARRIVÉ (« La Chasse est sortie ») mène à sa fiche dans la
 *     bibliothèque — cible `title` (TMDB, cherché au clic par le client), avec
 *     repli sur la demande si le titre n'y est pas encore ;
 *   - tout le reste (en route, en attente, bloquée, refusée, échec) mène à
 *     « Mes demandes », cherchée sur le titre, la demande mise en évidence
 *     (`?tab=requests&find=<titre>&focus=<id>`, lus par `hub/deepLink.ts`).
 *
 * Un cœur d'avant ne connaît pas ces colonnes : `coreNotifications` les
 * retire avant l'écriture tant que le contexte ne les annonce pas
 * (`ctx.notificationFields`). Chaque notification de Vigie passe par ici.
 */

import type { CorePrisma } from "../storage/contract";
import { noteNotificationTitle } from "../policy/notification-gate";

/** L'état d'une demande, dans le vocabulaire FERMÉ du cœur. */
export type CoreNotificationState = "available" | "progress" | "pending" | "blocked" | "declined" | "failed";

interface RequestRef {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** Identifiant de l'extension et chemin de navigation qu'elle publie (`plugin.json`). */
const PLUGIN_ID = "seer";
const HUB_PATH = "/discover";
/** Le cœur borne chaque paramètre à 200 caractères. */
const MAX_FIND = 120;

/** « Mes demandes », cherchée sur ce titre, cette demande mise en évidence. */
export function requestPageTarget(req: RequestRef) {
  return {
    kind: "extension" as const,
    pluginId: PLUGIN_ID,
    path: HUB_PATH,
    params: { tab: "requests", find: req.title.slice(0, MAX_FIND), focus: req.id },
  };
}

/** La fiche du titre dans la bibliothèque ; à défaut, sa demande. */
export function titleTarget(req: RequestRef) {
  if (!Number.isSafeInteger(req.tmdbId) || req.tmdbId <= 0) return requestPageTarget(req);
  return { kind: "title" as const, mediaType: req.mediaType, tmdbId: req.tmdbId, fallback: requestPageTarget(req) };
}

/** Les colonnes `target` et `state` d'une notification de demande. */
export function requestNotificationExtras(req: RequestRef, state: CoreNotificationState): { target: string; state: CoreNotificationState } {
  const target = state === "available" ? titleTarget(req) : requestPageTarget(req);
  return { target: JSON.stringify(target), state };
}

/** Une notification « demande » complète, prête pour `db.core.notification.create`. */
export function requestNotificationData(
  req: RequestRef & { jellyfinUserId: string },
  text: { title: string; body: string },
  state: CoreNotificationState,
): Record<string, unknown> {
  const data = {
    jellyfinUserId: req.jellyfinUserId, type: "request_status",
    title: text.title, body: text.body, refId: req.id,
    ...requestNotificationExtras(req, state),
  };
  // Le contrôle parental du destinataire se lit à l'écriture (policy/notification-gate.ts).
  noteNotificationTitle(data, { mediaType: req.mediaType, tmdbId: req.tmdbId });
  return data;
}

const EXTRA_FIELDS = ["target", "state"] as const;

/**
 * Le client Prisma du cœur, sans les colonnes qu'il ne connaît pas : un cœur
 * d'avant 1.30.0 n'annonce rien, et la notification part comme avant.
 */
export function coreNotifications(core: CorePrisma, announced: readonly string[] | undefined): CorePrisma {
  const known = new Set(announced ?? []);
  const dropped = EXTRA_FIELDS.filter((f) => !known.has(f));
  if (dropped.length === 0) return core;
  return {
    ...core,
    notification: {
      create: (args) => {
        const data = { ...args.data };
        for (const field of dropped) delete data[field];
        return core.notification.create({ ...args, data });
      },
    },
  };
}
