/* ------------------------------------------------------------------ */
/*  Vigie — Les notifications, au contrôle parental du destinataire     */
/* ------------------------------------------------------------------ */

/*
 * Un titre interdit à un compte ne lui parvient par aucun chemin, avis
 * compris (« La Chasse est sortie », « bloquée », « échec »…) : un profil
 * restreint après sa demande ne reçoit plus rien de ce titre.
 *
 * Le format des notifications ne bouge pas (notify/core-notification.ts) :
 * `requestNotificationData` note à côté, sans l'écrire, le titre dont parle
 * la notification qu'il fabrique ; `gateNotifications`, posé AUTOUR du client
 * du cœur (storage/startup.ts), le retrouve à l'écriture et se tait si le
 * destinataire ne peut pas le voir. Une notification sans titre noté passe.
 * Pont absent : comme avant ; pont qui lève : rien n'est écrit.
 */

import type { CorePrisma } from "../storage/contract";
import { allowsTitle, type ExternalTitle } from "./content-gate";

const titles = new WeakMap<object, ExternalTitle>();

/** Le titre dont parle cette notification (l'objet même passé à `create`). */
export function noteNotificationTitle(data: object, title: ExternalTitle): void {
  if (Number.isSafeInteger(title.tmdbId) && title.tmdbId > 0) titles.set(data, title);
}

export function gateNotifications(core: CorePrisma): CorePrisma {
  return {
    ...core,
    notification: {
      async create(args) {
        const title = titles.get(args.data);
        const userId = args.data.jellyfinUserId;
        if (title && !(await allowsTitle(typeof userId === "string" ? userId : "", title))) {
          console.log("[vigie-policy] notification tue : titre interdit au destinataire");
          return null;
        }
        return core.notification.create(args);
      },
    },
  };
}
