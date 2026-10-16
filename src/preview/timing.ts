/* ------------------------------------------------------------------ */
/*  Vigie — Les temps de l'aperçu de bande-annonce au survol           */
/* ------------------------------------------------------------------ */

/*
 * Les MÊMES temps que les cartes de Tentacle (`previewTiming.ts` du cœur,
 * packages/shared/src/trailers/preview/) : une affiche de Vigie s'anime au
 * même rendez-vous qu'une affiche de la bibliothèque. Un changement là-bas
 * se reporte ici.
 *
 *   - la demande au serveur part à l'INTENTION : 200 ms de survol ET un
 *     pointeur arrêté depuis 100 ms (moins de 6 px) — une souris qui balaie
 *     une rangée, une page qui défile ne demandent RIEN ;
 *   - la mini-carte se montre au plus tôt au DÉLAI que l'utilisateur a choisi
 *     dans Tentacle (`previewDelay.ts` du cœur, 800 ms par défaut — l'hôte le
 *     dit dans `__tentacle_env.trailerPreview.delayMs` ; 600 ms face à un
 *     hôte d'avant, son ancien rendez-vous), et seulement avec de quoi
 *     montrer : la première image de la vidéo, ou l'image du titre une fois
 *     la bande-annonce vérifiée et son premier fragment reçu. La vidéo y JOUE
 *     dès cet instant, agrandissement compris ;
 *   - le serveur a préparé d'avance l'aperçu des affiches à l'écran
 *     (`warm.ts`) : sa réponse est immédiate.
 */
export const PREVIEW_TIMING = {
  intentMs: 200,
  intentStillMs: 100,
  intentMovePx: 6,
  revealMs: 600,
  /** Où l'aperçu commence (s) : quelques secondes après le noir du début. */
  startOffsetS: 4,
  startOffsetMinDurationS: 30,
  fetchTimeoutMs: 15_000,
  /** Du flux trouvé à la première image : au-delà, la vidéo est jugée bloquée. */
  readyTimeoutMs: 8_000,
  /** Une lecture montrée qui ne progresse plus pendant ce temps s'efface. */
  stallTimeoutMs: 5_000,
  /** Fondu de sortie : la vidéo reste montée — et le son décroît — jusqu'à sa fin. */
  exitMs: 240,
  audioFadeInMs: 400,
  volume: 0.6,
  /** Une bande-annonce qui a échoué à la lecture n'est pas retentée avant ce délai. */
  failureMemoryMs: 10 * 60_000,
  /** La décision d'un titre (trouvée ou absente) vaut au plus ce temps. */
  decisionMemoryMs: 60 * 60_000,
  rateLimitDefaultMs: 2_000,
  rateLimitMinMs: 1_000,
  rateLimitMaxMs: 10_000,
  transientFailureMs: 10_000,
  /** Notre délai (`fetchTimeoutMs`) expiré : le serveur décide encore, on redemande aussitôt. */
  timeoutRetryMs: 1_500,
  maxRetries: 2,
} as const;

/*
 * Le DÉLAI choisi dans Tentacle — la règle JUMELLE de `previewDelay.ts` du
 * cœur (packages/shared/src/trailers/preview/) : la mini-carte au délai, la
 * demande 400 ms avant lui, jamais sous 200 ms de survol (et un pointeur
 * arrêté). Un changement là-bas se reporte ici.
 */
export const PREVIEW_DELAYS = [500, 800, 1200, 2000] as const;
/** Un hôte d'avant le réglage ne dit rien : son ancien rendez-vous, celui de ses propres cartes. */
export const LEGACY_HOST_DELAY_MS = 600;
const INTENT_FLOOR_MS = 200;
const INTENT_LEAD_MS = 400;

/** Le délai que l'hôte dit, s'il est l'un des choix ; sinon celui d'un hôte d'avant. */
export function previewDelayOf(raw: unknown): number {
  return (PREVIEW_DELAYS as readonly unknown[]).includes(raw) ? (raw as number) : LEGACY_HOST_DELAY_MS;
}

/** L'intention et la révélation d'un cycle, pour un délai. */
export function previewPaceFor(delayMs: number): { intentMs: number; revealMs: number } {
  return { intentMs: Math.min(delayMs, Math.max(INTENT_FLOOR_MS, delayMs - INTENT_LEAD_MS)), revealMs: delayMs };
}

/* La mise en mouvement de la mini-carte (`previewMotion.ts` du cœur). */
export const PREVIEW_MOTION = {
  enterMs: 340,
  enterFadeMs: 140,
  contentDelayMs: 160,
  exitMs: 220,
  reducedMs: 180,
} as const;
