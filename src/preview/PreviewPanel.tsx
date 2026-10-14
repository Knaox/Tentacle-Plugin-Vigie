/* ------------------------------------------------------------------ */
/*  Vigie — Le bandeau de la mini-carte d'aperçu                       */
/* ------------------------------------------------------------------ */

/*
 * Le JUMEAU du bandeau du cœur pour une carte hors bibliothèque
 * (`ExternalHoverOverlay` en surface « preview ») : les ronds du plateau
 * PUIS le titre et sa note en étoiles, puis les faits.
 *
 *   - le plateau garde l'ordre et les gestes du survol de Vigie
 *     (usePosterGestures, comme PosterHover) : l'action primaire en tête —
 *     « Demander » / « Choisir les saisons » au dégradé de marque, « Regarder »
 *     en rond blanc —, « Demander d'autres saisons », « Ma liste », « J'aime »,
 *     puis « Plus d'infos » (i) au bout, qui ouvre la fiche ;
 *   - les faits : année • Film/Série • ★ note publique, puis l'état du titre
 *     (ou ce qui manque, ou son canal de sortie), sans requête de plus.
 *
 * Les gestes arrêtent leur clic : seul le reste de la mini-carte ouvre la fiche.
 */

import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import type { PosterGestures, PosterPrimary } from "../hooks/usePosterGestures";
import { CardBookmarkGlyph, CardHeartGlyph, InfoIcon, PlayIcon, PlusBoldIcon, StarIcon } from "../components/ui/icons";
import { StarsInput } from "../components/ui/StarsInput";
import { getCurrentLanguage, mediaYear } from "../utils/media-helpers";

function stop(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}

function Primary({ primary, name }: { primary: PosterPrimary; name: string }) {
  const watch = primary.kind === "watch";
  const label = `${primary.label} — ${name}`;
  return (
    <button
      type="button"
      className="vgp-btn"
      data-primary={watch ? "quiet" : "brand"}
      aria-label={label}
      title={label}
      onClick={(e) => { stop(e); primary.run(); }}
    >
      {watch ? <PlayIcon /> : <PlusBoldIcon />}
    </button>
  );
}

export function PreviewPanel({ item, name, gestures, detail, onOpen }: {
  item: SeerrSearchResult;
  name: string;
  gestures: PosterGestures;
  /** La ligne d'état de la carte (« Demandé », « Il manque 1 saison », « Au cinéma »…). */
  detail: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation("seer");
  const { primary, more, watchlist, favorite, rating } = gestures;
  const lang = getCurrentLanguage();
  const year = mediaYear(item);
  const vote = item.voteAverage && item.voteAverage > 0
    ? item.voteAverage.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : null;
  const facts = [year, item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie")].filter(Boolean) as string[];

  return (
    <div className="vgp-panel" onKeyDown={(e) => e.stopPropagation()}>
      <div className="vgp-tray" role="toolbar" aria-label={name} onClick={stop}>
        {primary && <Primary primary={primary} name={name} />}
        {more && <Primary primary={more} name={name} />}
        <button
          type="button"
          className="vgp-btn"
          aria-label={watchlist.label}
          aria-pressed={watchlist.active}
          title={watchlist.label}
          onClick={(e) => { stop(e); watchlist.toggle(); }}
        >
          <CardBookmarkGlyph filled={watchlist.active} />
        </button>
        {favorite && (
          <button
            type="button"
            className="vgp-btn"
            data-tone={favorite.active ? "liked" : undefined}
            aria-label={favorite.label}
            aria-pressed={favorite.active}
            title={favorite.label}
            onClick={(e) => { stop(e); favorite.toggle(); }}
          >
            <CardHeartGlyph filled={favorite.active} />
          </button>
        )}
        <button
          type="button"
          className="vgp-btn"
          data-extra="details"
          aria-label={t("seer:gestureMoreInfo")}
          title={t("seer:gestureMoreInfo")}
          onClick={(e) => { stop(e); onOpen(); }}
        >
          <InfoIcon />
        </button>
      </div>
      <p className="vgp-title">{name}</p>
      <div className="vgp-stars" onClick={stop}>
        <StarsInput value={rating.value} onRate={rating.rate} onClear={rating.clear} size="sm" tone="onMedia" />
      </div>
      <p className="vgp-line" data-line="first">
        {facts.map((fact, i) => (
          <span key={fact}>{i > 0 && <span className="vgp-dot" aria-hidden />}{fact}</span>
        ))}
        {vote && (
          <span>
            <span className="vgp-dot" aria-hidden />
            <StarIcon className="vgp-star inline-block h-[0.95em] w-[0.95em] -translate-y-px align-middle" /> {vote}
          </span>
        )}
      </p>
      {detail && <p className="vgp-line" data-line="last">{detail}</p>}
    </div>
  );
}
