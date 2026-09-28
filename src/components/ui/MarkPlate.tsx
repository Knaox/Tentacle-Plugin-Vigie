/* ------------------------------------------------------------------ */
/*  Vigie — Les marques du compte, sur une affiche                     */
/* ------------------------------------------------------------------ */

/*
 * Le bandeau du pied dit où en est le titre pour le SERVEUR ; le coin du
 * haut dit ce que la PERSONNE en a fait, d'un coup d'œil, comme sur les
 * plateformes de streaming :
 *
 *   - à gauche, une plaque d'icônes : dans la bibliothèque, vu, dans « Ma
 *     liste », aimé — dans cet ordre, toujours, pour que l'œil apprenne
 *     leur place. Rien n'y est dit deux fois : quand le bandeau annonce déjà
 *     « Disponible » ou « En partie », l'icône de la bibliothèque s'efface ;
 *   - à droite, la note : la SIENNE quand il en a posé une (étoile à la
 *     couleur de la marque, sur cinq, comme dans Tentacle), celle de TMDB
 *     sinon (étoile ambrée, sur dix).
 *
 * Même plaque presque opaque que le bandeau : aucune affiche claire ne peut
 * avaler une icône. Ni flou ni animation — une grille en rend des centaines
 * (règle GPU du projet). Le sens n'est jamais porté par la couleur seule :
 * chaque icône a sa forme, et le libellé de la carte les énonce toutes.
 */

import { memo, type ReactNode } from "react";
type Translate = (key: string, opts?: Record<string, unknown>) => string;
import type { TitleMarks } from "../../hub/UserMarks";
import { BookmarkIcon, EyeIcon, HeartIcon, LibraryIcon, StarIcon } from "./icons";

const ICON = "h-3 w-3 shrink-0";

/**
 * Ce que la plaque montre ; `library` suit la règle « rien deux fois ». Un
 * titre mis de côté porte le signet de Ma liste, estompé : il y entrera à
 * son arrivée.
 */
function shown(marks: TitleMarks, bandSaysHere: boolean) {
  return {
    library: marks.library && !bandSaysHere,
    watched: marks.watched,
    watchlist: marks.watchlist,
    pending: !marks.watchlist && marks.pending,
    liked: marks.liked,
  };
}

export const MarkPlate = memo(function MarkPlate({ marks, bandSaysHere }: { marks: TitleMarks; bandSaysHere: boolean }) {
  const s = shown(marks, bandSaysHere);
  if (!s.library && !s.watched && !s.watchlist && !s.pending && !s.liked) return null;
  return (
    <span
      aria-hidden
      className="absolute left-1.5 top-1.5 inline-flex h-5 items-center gap-1 rounded-full px-1.5"
      style={{ background: "var(--vg-plate)" }}
    >
      {s.library && <LibraryIcon className={`${ICON} text-[var(--vg-media-available)]`} />}
      {s.watched && <EyeIcon className={`${ICON} text-tentacle-on-media-primary`} />}
      {s.watchlist && <BookmarkIcon className={`${ICON} text-[var(--brand-light)]`} />}
      {s.pending && <BookmarkIcon className={`${ICON} text-[var(--brand-light)] opacity-60`} />}
      {s.liked && <HeartIcon className={`${ICON} text-[var(--brand-accent-light)]`} />}
    </span>
  );
});

/** Une note sur cinq, à la demi-étoile, dans la langue de l'interface. */
function fiveScale(score: number, lang: string): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(score / 2);
}

export const RatingChip = memo(function RatingChip({ score, publicRating, lang }: {
  /** Sa note, 1..10 ; `null` : celle de TMDB. */
  score: number | null;
  publicRating: number;
  lang: string;
}) {
  if (score === null && publicRating <= 0) return null;
  const mine = score !== null;
  return (
    <span
      aria-hidden
      className={`absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-tentacle-on-media-primary ${mine ? "ring-1 ring-[rgba(var(--brand-rgb),0.65)]" : ""}`}
      style={{ background: "var(--vg-plate)" }}
    >
      <StarIcon className={`h-2.5 w-2.5 ${mine ? "text-[var(--brand-light)]" : "text-[var(--seer-st-rating-solid)]"}`} />
      {mine ? fiveScale(score, lang) : publicRating.toFixed(1)}
    </span>
  );
});

/** Les marques, en mots — pour le libellé accessible de la carte. */
export function marksText(marks: TitleMarks | null, bandSaysHere: boolean, t: Translate, lang: string): string[] {
  if (!marks) return [];
  const s = shown(marks, bandSaysHere);
  const words: string[] = [];
  if (s.library) words.push(t("seer:markLibrary"));
  if (s.watched) words.push(t("seer:markWatched"));
  if (s.watchlist) words.push(t("seer:markWatchlist"));
  if (s.pending) words.push(t("seer:markWatchlistPending"));
  if (s.liked) words.push(t("seer:markLiked"));
  if (marks.score !== null) words.push(t("seer:markYourRating", { score: fiveScale(marks.score, lang) }));
  return words;
}

/**
 * Les marques en toutes lettres, sur une surface de la page (meilleur
 * résultat, en-tête de fiche) : là, il y a la place de dire le mot.
 */
export const MarkLine = memo(function MarkLine({ marks, bandSaysHere, t, lang, onMedia = false }: {
  marks: TitleMarks | null;
  bandSaysHere: boolean;
  t: Translate;
  lang: string;
  /** Posée sur une image (en-tête de fiche) : le texte clair des médias. */
  onMedia?: boolean;
}) {
  if (!marks) return null;
  const s = shown(marks, bandSaysHere);
  const items: Array<{ key: string; icon: ReactNode; text: string }> = [];
  if (s.library) items.push({ key: "library", icon: <LibraryIcon className={`${ICON} text-[var(--seer-st-available-fg)]`} />, text: t("seer:markLibrary") });
  if (s.watched) items.push({ key: "watched", icon: <EyeIcon className={ICON} />, text: t("seer:markWatched") });
  if (s.watchlist) items.push({ key: "watchlist", icon: <BookmarkIcon className={`${ICON} text-[var(--brand-light)]`} />, text: t("seer:markWatchlist") });
  if (s.pending) items.push({ key: "pending", icon: <BookmarkIcon className={`${ICON} text-[var(--brand-light)] opacity-60`} />, text: t("seer:markWatchlistPending") });
  if (s.liked) items.push({ key: "liked", icon: <HeartIcon className={`${ICON} text-[var(--brand-accent-light)]`} />, text: t("seer:markLiked") });
  if (marks.score !== null) {
    items.push({
      key: "score",
      icon: <StarIcon className={`${ICON} text-[var(--brand-light)]`} />,
      text: t("seer:markYourRating", { score: fiveScale(marks.score, lang) }),
    });
  }
  if (items.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium ${onMedia ? "text-tentacle-on-media-primary" : "text-tentacle-text-secondary"}`}>
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1">{i.icon}{i.text}</li>
      ))}
    </ul>
  );
});
