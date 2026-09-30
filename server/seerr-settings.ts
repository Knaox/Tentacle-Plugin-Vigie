/* ------------------------------------------------------------------ */
/*  Vigie — Les réglages de Jellyseerr qui décident de ce qui se demande */
/* ------------------------------------------------------------------ */

/*
 * `GET /api/v1/settings/main`, lu avec la clé d'API d'administration que
 * détient déjà le plugin, et gardé cinq minutes : un réglage changé dans
 * Jellyseerr se retrouve ici sans redémarrer quoi que ce soit. Passé ce délai,
 * la dernière valeur connue sert encore pendant qu'on relit en fond — `GET
 * /config`, qui en dépend, est appelé au montage de Vigie et ne doit jamais
 * attendre Jellyseerr.
 *
 *   - `blocklistedTags` : les mots-clés TMDB masqués (cf. blocklist.ts) ;
 *   - `enableSpecialEpisodes` : « autoriser la demande d'épisodes spéciaux »
 *     — la saison 0. Éteint (le défaut de Jellyseerr), il la retire de toute
 *     demande ; Vigie ne la propose donc qu'allumé.
 *
 * Jellyseerr injoignable : réglages vides — rien de masqué par mots-clés,
 * pas de saison 0. Jamais une erreur.
 */

import { cached } from "./cache";

export interface SeerrMainSettings {
  blocklistedTags?: string;
  enableSpecialEpisodes?: boolean;
}

export function getSeerrMainSettings(seerrUrl: string, apiKey: string): Promise<SeerrMainSettings> {
  return cached(`seerr:settingsMain:${seerrUrl}`, 5 * 60_000, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/settings/main`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return {};
      return (await res.json()) as SeerrMainSettings;
    } catch {
      return {};
    }
  }, { staleMs: 24 * 3600_000 });
}

/** La saison 0 (épisodes spéciaux) se demande-t-elle chez ce Jellyseerr ? */
export async function specialSeasonsEnabled(seerrUrl: string, apiKey: string): Promise<boolean> {
  return (await getSeerrMainSettings(seerrUrl, apiKey)).enableSpecialEpisodes === true;
}

/**
 * La même réponse, sans jamais faire attendre plus de `capMs` : un Jellyseerr
 * lent au tout premier appel (avant que le préchauffage ait abouti) donne
 * « non » pour cette fois, la lecture continuant en fond pour la suivante.
 */
export function specialSeasonsQuick(seerrUrl: string, apiKey: string, capMs = 400): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), capMs); });
  return Promise.race([specialSeasonsEnabled(seerrUrl, apiKey), late]).finally(() => clearTimeout(timer));
}
