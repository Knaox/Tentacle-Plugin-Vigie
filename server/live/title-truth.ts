/* ------------------------------------------------------------------ */
/*  Vigie — La vérité d'un titre : Jellyfin d'abord, puis les demandes  */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr range chaque titre sous un statut (demandé, en partie,
 * disponible…), mais ne constate une suppression dans Jellyfin qu'à sa
 * synchronisation nocturne : jusque-là, un film supprimé reste « Disponible ».
 * Ce module corrige le statut de Jellyseerr avec ce que l'on SAIT :
 *
 *   - ce que Jellyfin a (la liste du serveur Tentacle, confirmée au besoin
 *     par Jellyfin lui-même) : là → disponible ; parti → plus disponible ;
 *   - les demandes qui existent encore dans Jellyseerr (ou attendent dans la
 *     file de Vigie). Une demande faite AVANT le départ du titre a été servie,
 *     puis Jellyfin a perdu ce qu'elle avait apporté : elle est CONSOMMÉE et ne
 *     retient plus rien — le titre se redemande aussitôt, comme dans
 *     Jellyseerr (la demande elle-même part peu après, auto-forget.ts). Seule
 *     une demande faite APRÈS (une redemande), ou une saison jamais arrivée,
 *     le garde « Demandé ».
 *
 * Pur : les faits arrivent en entrée, rien n'est lu ni écrit ici. Les mêmes
 * règles servent la recherche, les cartes de Tentacle, les affiches et la
 * fiche du hub, et la liste des demandes — une seule vérité partout.
 */

/** Statuts Jellyseerr d'un média ou d'une saison. */
export const STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  BLOCKLISTED: 6,
  DELETED: 7,
} as const;

/** Statuts Jellyseerr d'une DEMANDE. */
export const REQUEST = { PENDING: 1, APPROVED: 2, DECLINED: 3, FAILED: 4, COMPLETED: 5 } as const;

/** Une demande Jellyseerr, réduite à ce que la règle lit. */
export interface RequestFact {
  status: number;
  /** Saisons couvertes (séries) ; vide pour un film. */
  seasons: readonly number[];
  is4k?: boolean;
  /**
   * Sa création (ms, ou la date ISO de Jellyseerr). Inconnue : la demande
   * n'est jamais tenue pour consommée — la règle d'avant.
   */
  createdAt?: number | string | null;
}

/** Ce que Jellyfin est, d'après la liste du serveur — confirmée. */
export interface LibraryFact {
  state: "present" | "gone" | "unknown";
  /** Séries : saisons dont plus aucun épisode n'est là. */
  goneSeasons: ReadonlySet<number>;
  /** Séries : saisons dont au moins un épisode est là. */
  presentSeasons: ReadonlySet<number>;
  /** Parti : quand il a quitté Jellyfin (ms). */
  departedAt?: number | null;
  /** Séries : quand chaque saison partie a quitté Jellyfin (ms). */
  seasonDepartedAt?: ReadonlyMap<number, number>;
}

export interface TitleFacts {
  library: LibraryFact;
  /**
   * Les demandes du titre dans Jellyseerr — `null` : on ne les connaît pas
   * (index pas encore lu, Jellyseerr muet). Toutes, même refusées : la règle
   * trie elle-même ce qui compte encore.
   */
  requests: readonly RequestFact[] | null;
  /** Une demande attend dans la file de Vigie (pas encore chez Jellyseerr). */
  queued: boolean;
  /** Séries : les saisons de ces demandes en file. */
  queuedSeasons?: ReadonlySet<number>;
  /** Quelque chose descend pour ce titre (Sonarr, Radarr). */
  downloading?: boolean;
}

export const NO_SEASONS: ReadonlySet<number> = new Set();
export const UNKNOWN_LIBRARY: LibraryFact = { state: "unknown", goneSeasons: NO_SEASONS, presentSeasons: NO_SEASONS };

/** Une demande qui court encore : en attente, validée, ou terminée — jamais refusée ni en échec, jamais en 4K. */
export function isLiveRequest(r: RequestFact): boolean {
  return !r.is4k && (r.status === REQUEST.PENDING || r.status === REQUEST.APPROVED || r.status === REQUEST.COMPLETED);
}

/** Une date de demande en ms — `null` si elle manque ou ne se lit pas. */
export function requestTime(createdAt: number | string | null | undefined): number | null {
  if (typeof createdAt === "number") return Number.isFinite(createdAt) ? createdAt : null;
  if (typeof createdAt !== "string" || createdAt === "") return null;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Une demande née avant cet instant (ou sans date connue). */
export function madeBefore(createdAt: number | string | null | undefined, at: number): boolean {
  const ms = requestTime(createdAt);
  return ms === null || ms <= at;
}

/** Quand cette saison a quitté Jellyfin — `null` : elle n'est pas partie. */
function seasonDeparture(library: LibraryFact, season: number): number | null {
  const at = library.seasonDepartedAt?.get(season);
  if (at !== undefined) return at;
  if (library.state === "gone" && library.goneSeasons.has(season) && library.departedAt != null) return library.departedAt;
  return null;
}

/** La demande, née avant ce départ (date CONNUE), ne retient plus ce qu'il a emporté. */
function spentAt(r: RequestFact, at: number | null): boolean {
  const ms = requestTime(r.createdAt);
  return at !== null && ms !== null && ms <= at;
}

/**
 * Le départ du titre a-t-il CONSOMMÉ cette demande ? Un film parti, une série
 * partie dont chaque saison demandée est partie après la demande. Une saison
 * jamais arrivée la garde vivante : supprimer la saison 1 n'annule pas la 2
 * qui est en route.
 */
export function spentRequest(r: RequestFact, library: LibraryFact): boolean {
  if (library.state !== "gone") return false;
  if (r.seasons.length === 0) return spentAt(r, library.departedAt ?? null);
  return r.seasons.every((s) => spentAt(r, seasonDeparture(library, s)));
}

/** La saison partie de Jellyfin après cette demande ne lui doit plus rien. */
export function spentSeason(r: RequestFact, library: LibraryFact, season: number): boolean {
  return spentAt(r, seasonDeparture(library, season));
}

/** Le statut « Demandé » à rendre : en cours tant que quelque chose descend, en attente sinon. */
function requested(facts: TitleFacts, seerr: number | undefined): number {
  return facts.downloading || seerr === STATUS.PROCESSING ? STATUS.PROCESSING : STATUS.PENDING;
}

/**
 * Le titre est-il encore demandé ? `null` : on ne sait pas (demandes
 * inconnues et rien dans la file).
 */
export function stillRequested(facts: TitleFacts): boolean | null {
  if (facts.queued) return true;
  if (facts.requests === null) return null;
  return facts.requests.some((r) => isLiveRequest(r) && !spentRequest(r, facts.library));
}

/** Une saison est-elle encore demandée — par une demande qui la couvre, ou dans la file ? */
export function seasonStillRequested(facts: TitleFacts, season: number): boolean | null {
  if (facts.queuedSeasons?.has(season)) return true;
  if (facts.requests === null) return facts.queued ? true : null;
  return facts.requests.some((r) => isLiveRequest(r) && r.seasons.includes(season) && !spentSeason(r, facts.library, season))
    || (facts.queued && !facts.queuedSeasons);
}

/**
 * Le statut corrigé d'un titre. `seerr` : celui de Jellyseerr (`undefined`
 * s'il ne connaît pas le titre). Rend `undefined` quand il n'y a rien à dire.
 */
export function correctMediaStatus(
  mediaType: "movie" | "tv",
  seerr: number | undefined,
  facts: TitleFacts,
): number | undefined {
  // Masqué : un choix de l'administrateur, que Jellyfin ne contredit pas.
  if (seerr === STATUS.BLOCKLISTED) return seerr;
  const { library } = facts;

  if (library.state === "gone") {
    // Sonarr ou Radarr le font revenir : en route, quelles que soient les demandes.
    if (facts.downloading) return STATUS.PROCESSING;
    // Il y était, il n'y est plus : demandé si une redemande court, sinon libre.
    const still = stillRequested(facts);
    if (still === true) return requested(facts, seerr);
    if (still === false) return STATUS.DELETED;
    // Demandes inconnues : ce que Jellyseerr dit d'une demande en cours vaut encore.
    return seerr === STATUS.PENDING || seerr === STATUS.PROCESSING ? seerr : STATUS.DELETED;
  }

  if (library.state === "present") {
    if (mediaType === "movie") {
      // Jellyfin l'a : il est là, quoi que Jellyseerr n'ait pas encore vu.
      return seerr === STATUS.AVAILABLE || seerr === STATUS.PARTIALLY_AVAILABLE ? seerr : STATUS.AVAILABLE;
    }
    // Une série dont une saison est partie n'est plus là en entier.
    if (seerr === STATUS.AVAILABLE) return library.goneSeasons.size > 0 ? STATUS.PARTIALLY_AVAILABLE : seerr;
    if (seerr === STATUS.PARTIALLY_AVAILABLE) return seerr;
    // Jellyfin en a au moins une saison : elle est là en partie.
    return STATUS.PARTIALLY_AVAILABLE;
  }

  // Jellyfin n'en dit rien : Jellyseerr fait foi, au fil des demandes.
  if (seerr === STATUS.PENDING || seerr === STATUS.PROCESSING) {
    // Plus aucune demande (supprimée, refusée) : il se redemande.
    return stillRequested(facts) === false ? STATUS.UNKNOWN : seerr;
  }
  // Supprimé pour Jellyseerr (sa propre synchro) : une demande terminée a été
  // servie, elle ne le retient plus — comme Jellyseerr, qui l'écarte. Seule
  // une demande qui attend encore (ou la file de Vigie) le dit demandé.
  if (seerr === STATUS.DELETED && (facts.queued || facts.requests?.some((r) => isLiveRequest(r) && r.status !== REQUEST.COMPLETED))) {
    return requested(facts, seerr);
  }
  return seerr;
}

/**
 * Le statut corrigé d'UNE saison (fiche d'une série, feuille des saisons).
 * Une saison partie de Jellyfin redevient demandée si une demande d'APRÈS son
 * départ la couvre, libre sinon (« supprimée », comme la dit Jellyseerr après
 * sa synchro) — elle se redemande seule ou avec d'autres.
 */
export function correctSeasonStatus(season: number, seerr: number | undefined, facts: TitleFacts): number | undefined {
  if (seerr === STATUS.BLOCKLISTED) return seerr;
  const { library } = facts;
  const gone = library.state === "gone" || library.goneSeasons.has(season);
  if (gone && (seerr === undefined || seerr >= STATUS.PENDING)) {
    const still = seasonStillRequested(facts, season);
    if (still === true) return seerr === STATUS.PROCESSING || facts.downloading ? STATUS.PROCESSING : STATUS.PENDING;
    if (still === false) return STATUS.DELETED;
    return seerr === STATUS.PENDING || seerr === STATUS.PROCESSING ? seerr : STATUS.DELETED;
  }
  if (library.state === "present" && library.presentSeasons.has(season)) {
    // Des épisodes sont là : au moins « en partie », même si Jellyseerr ne l'a pas vu.
    return seerr === STATUS.AVAILABLE || seerr === STATUS.PARTIALLY_AVAILABLE ? seerr : STATUS.PARTIALLY_AVAILABLE;
  }
  if (seerr === STATUS.PENDING || seerr === STATUS.PROCESSING) {
    return seasonStillRequested(facts, season) === false ? STATUS.UNKNOWN : seerr;
  }
  return seerr;
}

/** Le titre a-t-il été retiré de Jellyfin (en entier) ? */
export function goneFromLibrary(facts: TitleFacts): boolean {
  return facts.library.state === "gone";
}
