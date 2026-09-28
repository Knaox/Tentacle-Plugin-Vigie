/* ------------------------------------------------------------------ */
/*  Vigie — Le clic « fantôme » d'un appui long                        */
/* ------------------------------------------------------------------ */

/*
 * Au relâcher d'un appui long, le navigateur peut délivrer un clic à ce qui
 * se trouve SOUS le doigt — et c'est désormais la feuille que l'appui vient
 * d'ouvrir. Constaté au banc : le clic tombait sur son « Demander », et le
 * titre partait en demande sans que personne ne l'ait touché. Ce clic-là est
 * avalé, une fois, à la capture du document ; le relâcher ouvre une courte
 * fenêtre au-delà de laquelle plus rien n'est retenu (un navigateur qui n'en
 * émet pas ne perd pas le suivant). Le jumeau de celui des cartes de Tentacle
 * (`useLongPress` du miroir).
 */

/** Après le relâcher, le délai au-delà duquel plus aucun clic fantôme n'est attendu. */
export const GHOST_CLICK_WINDOW_MS = 600;
/** Filet : un doigt dont on ne reçoit jamais le relâcher ne retient pas les clics indéfiniment. */
const MAX_WATCH_MS = 10_000;
/* Un objet, pas `true` : l'EventTarget de Node ne retire pas un écouteur
 * capture désigné par le booléen — les navigateurs lisent les deux pareil. */
const CAPTURE = { capture: true } as const;

/**
 * Avale le prochain clic reçu par `target` (le document), à la capture.
 * `onDone` part quand c'est fini — clic avalé, fenêtre écoulée ou geste
 * annulé. Rend de quoi tout défaire tout de suite.
 */
export function swallowGhostClick(
  target: EventTarget,
  onDone: () => void,
  windowMs = GHOST_CLICK_WINDOW_MS,
): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    target.removeEventListener("click", onClick, CAPTURE);
    target.removeEventListener("pointerup", onUp, CAPTURE);
    target.removeEventListener("pointercancel", stop, CAPTURE);
    clearTimeout(timeout);
    clearTimeout(guard);
    onDone();
  };
  const guard = setTimeout(stop, MAX_WATCH_MS);
  function onClick(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    stop();
  }
  function onUp() {
    clearTimeout(timeout);
    timeout = setTimeout(stop, windowMs);
  }
  target.addEventListener("click", onClick, CAPTURE);
  target.addEventListener("pointerup", onUp, CAPTURE);
  target.addEventListener("pointercancel", stop, CAPTURE);
  return stop;
}
