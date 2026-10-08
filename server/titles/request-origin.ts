/* ------------------------------------------------------------------ */
/*  Vigie — D'où part une demande (l'origine que déclare Tentacle)      */
/* ------------------------------------------------------------------ */

/*
 * Un client de Tentacle peut dire d'où part une demande : deux champs
 * FACULTATIFS du corps de `POST /titles/request` —
 *
 *   origin   — « tv » : n'importe quel téléviseur ;
 *   platform — « appletv », « androidtv », « webos »… : gardée pour plus
 *              tard, rien ne la lit encore.
 *
 * Vigie les garde avec la demande (colonnes `origin` et `platform` de
 * `seer_requests`, posées par storage/schema.ts), et `GET /titles/mine?origin=tv`
 * ne rend que les demandes de cette origine : « Mes demandes » d'un
 * téléviseur ne montre que ce qu'on a demandé depuis une TV.
 *
 * Additif de bout en bout : un client qui ne dit rien (le hub, le web, le
 * mobile, un Tentacle d'avant) laisse l'origine vide, et `mine` sans `origin`
 * rend toute la liste, comme avant. Une demande faite avant n'a pas
 * d'origine : aucun filtre ne la garde.
 */

/** L'origine d'une demande, telle que Vigie la garde. */
export interface RequestOrigin {
  origin: string;
  platform: string | null;
}

/* Des mots courts, en minuscules : rien d'autre n'entre en base. */
const ORIGIN = /^[a-z][a-z0-9-]{0,15}$/;
const PLATFORM = /^[a-z][a-z0-9-]{0,23}$/;

/** L'origine que déclare le corps d'une demande ; `null` : il n'en dit rien de lisible. */
export function readRequestOrigin(body: unknown): RequestOrigin | null {
  const raw = body && typeof body === "object" ? (body as { origin?: unknown; platform?: unknown }) : null;
  const origin = typeof raw?.origin === "string" && ORIGIN.test(raw.origin) ? raw.origin : null;
  if (!origin) return null;
  const platform = typeof raw?.platform === "string" && PLATFORM.test(raw.platform) ? raw.platform : null;
  return { origin, platform };
}

/**
 * Le filtre de `mine` : `undefined` sans `origin` — toute la liste ; sinon la
 * seule origine gardée. Illisible, il ne garde rien (`""` n'est l'origine
 * d'aucune demande) : on a demandé une partie, jamais le tout.
 */
export function readOriginFilter(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === "string" && ORIGIN.test(raw) ? raw : "";
}

/** Les demandes d'une origine ; sans filtre, toutes. */
export function ofOrigin<T extends { origin: string | null }>(requests: readonly T[], filter: string | undefined): readonly T[] {
  return filter === undefined ? requests : requests.filter((r) => r.origin === filter);
}

/** L'origine d'une demande déjà gardée : une relance (autre profil) la reprend. */
export function originOf(request: { origin: string | null; platform: string | null }): RequestOrigin | null {
  return request.origin ? { origin: request.origin, platform: request.platform } : null;
}
