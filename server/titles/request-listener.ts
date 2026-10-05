/* ------------------------------------------------------------------ */
/*  Vigie — Dire au cœur qu'un titre vient d'être demandé              */
/* ------------------------------------------------------------------ */

/*
 * Un titre demandé sort des recommandations de Tentacle — pour le seul
 * compte qui l'a demandé, sans peser sur son goût. C'est Tentacle qui décide
 * de ce que ça veut dire ; Vigie lui dit seulement « ce compte vient de
 * demander ce titre », après CHAQUE demande acceptée (submitRequest : hub,
 * cartes de Tentacle, saisons ajoutées). Par le contexte du plugin
 * (`ctx.recommendations.titleRequested`) : un Tentacle d'avant ne le donne
 * pas, et rien ne se passe.
 *
 * Jamais une panne pour la demande : l'appel part sans être attendu, une
 * erreur est avalée.
 */

export interface RequestedTitle {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

export type TitleRequestedListener = (userId: string, title: RequestedTitle) => Promise<void> | void;

let listener: TitleRequestedListener | null = null;

/** Branché au démarrage, quand le cœur sait l'entendre. `null` : débranché. */
export function onTitleRequested(fn: TitleRequestedListener | null): void {
  listener = fn;
}

export function announceTitleRequested(userId: string, title: RequestedTitle): void {
  const fn = listener;
  if (!fn) return;
  void Promise.resolve()
    .then(() => fn(userId, title))
    .catch(() => {
      // Le masquage est un plus : la demande, elle, est faite.
    });
}
