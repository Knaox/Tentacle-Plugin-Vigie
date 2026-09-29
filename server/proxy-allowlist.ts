/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le proxy laisse lire chez Jellyseerr                 */
/* ------------------------------------------------------------------ */

/*
 * Le proxy transparent relayait TOUTE méthode vers TOUTE route `/api/v1`,
 * avec la clé d'administration, pour n'importe quel compte connecté à
 * Tentacle : `GET settings/main` rendait la clé d'API de Jellyseerr,
 * `GET settings/sonarr` celle de Sonarr, `DELETE user/{id}` supprimait un
 * compte. L'interface n'y lit pourtant que le catalogue (`proxyFetch`, en
 * GET) : seules ces lectures passent. Ce qu'elle écrit passe par les routes
 * de Vigie, qui contrôlent les droits et les quotas.
 */

const READABLE: readonly RegExp[] = [
  /^api\/v1\/discover\/(movies|tv)(\/[\w-]+)*$/,
  /^api\/v1\/discover\/trending$/,
  /^api\/v1\/search$/,
  /^api\/v1\/(movie|tv)\/\d+(\/similar)?$/,
  /^api\/v1\/tv\/\d+\/season\/\d+$/,
  /^api\/v1\/person\/\d+(\/combined_credits)?$/,
  /^api\/v1\/collection\/\d+$/,
];

/** Une lecture du catalogue, telle que l'interface de Vigie la fait. */
export function isReadableSeerrPath(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD") && READABLE.some((re) => re.test(path));
}
