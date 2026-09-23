/* ------------------------------------------------------------------ */
/*  Vigie — Le verdict de sortie d'un titre, demandé par lots           */
/* ------------------------------------------------------------------ */

/*
 * « Au cinéma », « En streaming », « Potentiellement disponible » : chaque
 * carte veut le sien, mais le serveur les rend par lots. Les cartes montées
 * dans la même fraction de seconde se regroupent donc en UNE requête (cent
 * titres au plus) ; chaque verdict garde ensuite sa propre entrée de cache —
 * une rangée, une grille, une fiche et une filmographie se le partagent, et
 * rien ne se recharge d'un écran à l'autre.
 *
 * Le serveur ne résout qu'une partie des fiches par appel et poursuit en
 * tâche de fond : un verdict encore inconnu se redemande quelques fois.
 */

import { useQuery } from "@tanstack/react-query";
import { currentRegion, getAvailability } from "../api/client-releases";
import type { AvailabilityVerdict } from "../api/types-releases";

interface Ref {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

interface Result {
  verdict: AvailabilityVerdict | null;
  /** Le serveur n'avait pas encore la fiche : il faudra repasser. */
  pending: boolean;
}

interface Waiting {
  ref: Ref;
  resolve: (result: Result) => void;
  reject: (err: unknown) => void;
}

/* Le plafond du serveur est de 120 : on reste en deçà. */
const BATCH_MAX = 100;
/* Une image et demie : le temps que toute une rangée se monte. */
const WINDOW_MS = 30;
const PENDING_POLL_MS = 4_000;
const MAX_POLLS = 6;

let waiting: Waiting[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (ref: Ref) => `${ref.mediaType}:${ref.tmdbId}`;

function flush(): void {
  timer = null;
  const batch = waiting.slice(0, BATCH_MAX);
  waiting = waiting.slice(BATCH_MAX);
  if (waiting.length > 0) timer = setTimeout(flush, 0);

  const refs = [...new Map(batch.map((w) => [keyOf(w.ref), w.ref])).values()];
  getAvailability(refs).then(
    (res) => {
      const byKey = new Map(res.results.map((v) => [`${v.mediaType}:${v.tmdbId}`, v]));
      const serverPending = (res.pending ?? 0) > 0;
      for (const w of batch) {
        const verdict = byKey.get(keyOf(w.ref)) ?? null;
        w.resolve({ verdict, pending: verdict === null && serverPending });
      }
    },
    (err) => batch.forEach((w) => w.reject(err)),
  );
}

function load(ref: Ref): Promise<Result> {
  return new Promise((resolve, reject) => {
    waiting.push({ ref, resolve, reject });
    if (waiting.length >= BATCH_MAX) {
      if (timer) clearTimeout(timer);
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, WINDOW_MS);
    }
  });
}

/** Le verdict d'un titre ; `null` tant qu'il n'est pas là (ou pour une personne). */
export function useVerdict(mediaType: string | undefined, tmdbId: number | undefined, enabled = true): AvailabilityVerdict | null {
  const region = currentRegion();
  const type = mediaType === "movie" || mediaType === "tv" ? mediaType : null;
  const id = typeof tmdbId === "number" && tmdbId > 0 ? tmdbId : 0;
  const query = useQuery({
    queryKey: ["vigie-verdict", region, type, id],
    queryFn: () => load({ mediaType: type as "movie" | "tv", tmdbId: id }),
    enabled: enabled && type !== null && id > 0,
    // Les dates de sortie ne bougent pas d'une journée.
    staleTime: 24 * 60 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: (q) =>
      q.state.data?.pending && q.state.dataUpdateCount < MAX_POLLS ? PENDING_POLL_MS : false,
  });
  return query.data?.verdict ?? null;
}
