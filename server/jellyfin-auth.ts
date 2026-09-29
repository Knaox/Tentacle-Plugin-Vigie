/* ------------------------------------------------------------------ */
/*  Vigie — S'authentifier auprès de Jellyfin, de 10.10 à 12.x          */
/* ------------------------------------------------------------------ */

/*
 * Jellyfin 12 coupe par défaut l'autorisation « héritée » (jellyfin#15559),
 * et une migration la coupe aussi sur un serveur mis à jour (#16992) :
 * `X-Emby-Token`, `X-MediaBrowser-Token`, `X-Emby-Authorization`, le schéma
 * `Emby` et `api_key` y valent un 401. Vigie parlait en `X-Emby-Token` : sur
 * un 12.1, la synchro des comptes ne voyait plus Jellyfin (« Jellyfin GET
 * /Users a répondu 401 ») et les affiches perdaient en silence les marques
 * de la bibliothèque (vu, Ma liste, favori).
 *
 * Reste l'en-tête `Authorization: MediaBrowser Token="…"`, accepté partout —
 * mesuré le 29 sept. 2026 sur le 12.1.0 de production. C'est la forme
 * qu'emploie le serveur Tentacle (`apps/backend/src/services/jellyfinAuth.ts`).
 */

/** Un jeton ne contient ni guillemet ni espace : on retire ce qui refermerait la valeur. */
function cleanToken(token: string): string {
  return token.replace(/[^\x21-\x7E]/g, "").replace(/"/g, "");
}

/** Les en-têtes d'un appel à Jellyfin fait avec la clé d'API du serveur Tentacle. */
export function jellyfinAuthHeaders(apiKey: string): { Authorization: string } {
  return { Authorization: `MediaBrowser Token="${cleanToken(apiKey)}"` };
}
