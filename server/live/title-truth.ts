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
 *     file de Vigie) : un titre parti dont la demande est toujours là redevient
 *     « Demandé » ; sans demande, il se redemande.
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
}

/** Ce que Jellyfin est, d'après la liste du serveur — confirmée. */
export interface LibraryFact {
  state: "present" | "gone" | "unknown";
  /** Séries : saisons dont plus aucun épisode n'est là. */
  goneSeasons: ReadonlySet<number>;
  /** Séries : saisons dont au moins un épisode est là. */
  presentSeasons: ReadonlySet<number>;
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
  return facts.requests.some(isLiveRequest);
}

/** Une saison est-elle encore demandée — par une demande qui la couvre, ou dans la file ? */
export function seasonStillRequested(facts: TitleFacts, season: number): boolean | null {
  if (facts.queuedSeasons?.has(season)) return true;
  if (facts.requests === null) return facts.queued ? true : null;
  return facts.requests.some((r) => isLiveRequest(r) && r.seasons.includes(season)) || (facts.queued && !facts.queuedSeasons);
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
    // Il y était, il n'y est plus : demandé si une demande court encore, sinon libre.
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
  if (seerr === STATUS.DELETED && stillRequested(facts) === true) return requested(facts, seerr);
  return seerr;
}

/**
 * Le statut corrigé d'UNE saison (fiche d'une série, feuille des saisons).
 * Une saison partie de Jellyfin redevient demandée si une demande la couvre
 * encore, libre sinon (« supprimée », comme la dit Jellyseerr après sa synchro).
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
