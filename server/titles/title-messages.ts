/* ------------------------------------------------------------------ */
/*  Vigie — Les phrases que Tentacle affiche après un geste             */
/* ------------------------------------------------------------------ */

/*
 * Tentacle ne connaît pas nos clés de traduction : il affiche telle quelle la
 * phrase que la réponse lui donne. Les mêmes mots que le hub (requests.ts,
 * hub.ts), dans la langue de l'interface — et jamais de la famille de
 * « téléchargement » : l'application mobile les lit.
 */

const FR = {
  requested: (title: string) => `« ${title} » est demandé — vous serez prévenu à son arrivée.`,
  blocked: "Votre compte ne peut pas faire de demandes.",
  moviesDenied: "Votre compte ne peut pas demander de films.",
  masked: "Ce titre est masqué : sa demande n'est pas ouverte.",
  quota: (limit: number) => `Limite atteinte : ${limit} demande${limit > 1 ? "s" : ""} par jour.`,
  already: "Ce titre est déjà demandé.",
  failed: "La demande n'a pas abouti.",
  unreachable: "Jellyseerr ne répond pas pour l'instant.",
};

const EN = {
  requested: (title: string) => `“${title}” requested — you'll be notified when it arrives.`,
  blocked: "Your account can't make requests.",
  moviesDenied: "Your account can't request movies.",
  masked: "This title is hidden: it can't be requested.",
  quota: (limit: number) => `Limit reached: ${limit} request${limit > 1 ? "s" : ""} per day.`,
  already: "This title has already been requested.",
  failed: "The request didn't go through.",
  unreachable: "Jellyseerr isn't answering right now.",
};

function words(lang: string) {
  return lang === "fr" ? FR : EN;
}

export function requestedMessage(title: string, lang: string): string {
  return words(lang).requested(title);
}

export function unreachableMessage(lang: string): string {
  return words(lang).unreachable;
}

/** La phrase d'un refus de `submitRequest`, d'après son code et sa clé d'erreur. */
export function refusalMessage(status: number, body: Record<string, unknown>, lang: string): string {
  const w = words(lang);
  if (status === 409) return w.already;
  if (body.errorKey === "seer:errUserBlocked") return w.blocked;
  if (body.errorKey === "seer:errMoviesDenied") return w.moviesDenied;
  if (body.errorKey === "seer:errMaskedDenied") return w.masked;
  if (body.errorKey === "seer:errQuotaReached" && typeof body.limit === "number") return w.quota(body.limit);
  return w.failed;
}
