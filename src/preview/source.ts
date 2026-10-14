/* ------------------------------------------------------------------ */
/*  Vigie — La décision d'aperçu d'un titre : UNE demande par titre    */
/* ------------------------------------------------------------------ */

/*
 * `GET /api/trailers/preview?tmdbId&mediaType&lang` (serveur Tentacle, capacité
 * `trailers.preview`) : le serveur choisit la bande-annonce, la VÉRIFIE et
 * rend un flux qu'il relaie — ou un refus, et rien ne s'anime.
 *
 * Anti-spam (règle de Damien) : repasser sur une carte ne redemande rien tant
 * que la décision vaut — trouvée ou absente —, deux survols simultanés du même
 * titre partagent la même demande, une bande-annonce qui n'a pas pu se lire
 * n'est pas retentée avant 10 min. Un refus passager (429, réseau) se retient
 * jusqu'à son échéance : on ne martèle pas un serveur qui demande d'attendre.
 * Notre délai expiré (15 s), ou une réponse déjà échue à son arrivée, n'est
 * pas une panne : on redemande aussitôt — le serveur, qui poursuit sa
 * décision, y répond sans rien refaire.
 */

import { PREVIEW_TIMING } from "./timing";

export type PreviewMediaType = "movie" | "tv";

export interface PreviewTitle {
  tmdbId: number;
  mediaType: PreviewMediaType;
}

export const HLS_MIME = "application/vnd.apple.mpegurl";

/** Le contrat 200 de la route (`trailerPreview.ts` du cœur). */
export interface TrailerPreviewBody {
  path: string;
  mimeType: string;
  expiresAt: number;
  heights?: number[];
  qualities?: Array<{ height: number; path: string }>;
  /** La version du catalogue (additif) : une `subtitled` (VOSTFR) a ses sous-titres incrustés. */
  version?: string;
}

export type PreviewDecision =
  | { kind: "found"; preview: TrailerPreviewBody }
  | { kind: "missing" }
  | { kind: "retry"; retryAt: number };

export interface PreviewResponse {
  status: number;
  body: unknown;
  /** Notre délai a expiré avant la réponse (le serveur décide encore). */
  timedOut?: boolean;
}

const T = PREVIEW_TIMING;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const titleKey = (title: PreviewTitle) => `${title.mediaType}:${title.tmdbId}`;

function isPreviewBody(body: unknown): body is TrailerPreviewBody {
  const b = body as Partial<TrailerPreviewBody> | null;
  return !!b && typeof b.path === "string" && b.path.startsWith("/api/trailers/")
    && typeof b.mimeType === "string" && typeof b.expiresAt === "number";
}

/** Ce que dit une réponse du serveur, au moment `now`. */
export function decisionOf(response: PreviewResponse | null, now: number): PreviewDecision {
  if (!response) return { kind: "retry", retryAt: now + T.transientFailureMs };
  if (response.timedOut) return { kind: "retry", retryAt: now + T.timeoutRetryMs };
  const { status, body } = response;
  if (status === 200) {
    if (!isPreviewBody(body)) return { kind: "missing" };
    // Déjà échue à son arrivée (jeton du relais au bout) : on redemande au lieu de la lire.
    return body.expiresAt - 60_000 <= now ? { kind: "retry", retryAt: now + T.timeoutRetryMs } : { kind: "found", preview: body };
  }
  if (status === 429) {
    const seconds = (body as { retryAfterS?: unknown } | null)?.retryAfterS;
    const wait = typeof seconds === "number" && seconds > 0 ? seconds * 1000 : T.rateLimitDefaultMs;
    return { kind: "retry", retryAt: now + clamp(wait, T.rateLimitMinMs, T.rateLimitMaxMs) };
  }
  if (status >= 500) return { kind: "retry", retryAt: now + T.transientFailureMs };
  // 400, 401, 403, 404 : rien à montrer pour ce titre.
  return { kind: "missing" };
}

/** Jusqu'à quand une décision vaut. */
function decisionUntil(decision: PreviewDecision, now: number): number {
  if (decision.kind === "retry") return decision.retryAt;
  if (decision.kind === "missing") return now + T.decisionMemoryMs;
  // Le jeton du relais expire : on redemande un peu avant.
  return Math.min(decision.preview.expiresAt - 60_000, now + T.decisionMemoryMs);
}

/**
 * La hauteur à lire : celle de la boîte en pixels de l'écran — 720p sur un
 * écran Retina, 360p sur un écran normal, jamais 1080p (`previewLevelCap` du
 * cœur). Le maître RÉDUIT à cette hauteur quand le serveur en donne.
 */
export function streamPathFor(preview: TrailerPreviewBody, pixelRatio: number): string {
  const qualities = [...(preview.qualities ?? [])].filter((q) => q.height > 0 && typeof q.path === "string");
  if (qualities.length === 0) return preview.path;
  const target = pixelRatio >= 1.5 ? 720 : 360;
  const capped = qualities.filter((q) => q.height <= 720);
  const pool = (capped.length > 0 ? capped : qualities).sort((a, b) => a.height - b.height);
  return (pool.find((q) => q.height >= target) ?? pool[pool.length - 1]).path;
}

export interface PreviewSource {
  decide(title: PreviewTitle): Promise<PreviewDecision>;
  /** La décision déjà connue et valable, sans rien demander. */
  known(title: PreviewTitle): PreviewDecision | null;
  /** Le flux trouvé n'a pas pu se lire : plus de tentative avant 10 min. */
  markFailed(title: PreviewTitle): void;
  /**
   * Un aperçu déjà prêt, rendu par la préparation des affiches à l'écran
   * (`warm.ts`) : le survol de ce titre n'aura rien à demander. Sans effet si
   * une décision vaut déjà, ou si le corps est illisible.
   */
  seed(title: PreviewTitle, body: unknown): void;
}

export function createPreviewSource(
  request: (title: PreviewTitle) => Promise<PreviewResponse | null>,
  now: () => number = Date.now,
): PreviewSource {
  const memory = new Map<string, { decision: PreviewDecision; until: number }>();
  const inFlight = new Map<string, Promise<PreviewDecision>>();

  const known = (title: PreviewTitle): PreviewDecision | null => {
    const entry = memory.get(titleKey(title));
    if (!entry) return null;
    if (now() < entry.until) return entry.decision;
    memory.delete(titleKey(title));
    return null;
  };

  return {
    known,
    decide(title) {
      const cached = known(title);
      if (cached) return Promise.resolve(cached);
      const key = titleKey(title);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const promise = request(title)
        .catch(() => null)
        .then((response) => {
          const at = now();
          const decision = decisionOf(response, at);
          memory.set(key, { decision, until: decisionUntil(decision, at) });
          return decision;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
    markFailed(title) {
      memory.set(titleKey(title), { decision: { kind: "missing" }, until: now() + T.failureMemoryMs });
    },
    seed(title, body) {
      if (known(title)) return;
      const at = now();
      const decision = decisionOf({ status: 200, body }, at);
      if (decision.kind !== "found") return;
      memory.set(titleKey(title), { decision, until: decisionUntil(decision, at) });
    },
  };
}
