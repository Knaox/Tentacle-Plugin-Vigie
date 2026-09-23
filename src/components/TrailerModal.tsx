import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseYouTubeId, type RichTrailer } from "../utils/trailers";
import { youtubeEmbedSrc, externalLinkHandler } from "../utils/external";
import { useOverlay } from "../hooks/useOverlay";

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
  trailers: RichTrailer[];
  /** Index du trailer à afficher à l'ouverture (celui sur lequel on a cliqué). */
  initialIndex?: number;
}

/**
 * Modale d'embed des bandes-annonces + extras (YouTube) — même comportement
 * que TrailerModal du core : embed `youtube-nocookie`, lien « Ouvrir sur
 * YouTube » TOUJOURS présent (repli si l'embed est bloqué), sélecteur d'extras.
 */
export function TrailerModal({ open, onClose, trailers, initialIndex = 0 }: TrailerModalProps) {
  const { t } = useTranslation("seer");
  const [index, setIndex] = useState(initialIndex);

  // Réinitialise sur le trailer cliqué à chaque ouverture.
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  useOverlay(open, onClose);

  if (!open) return null;
  const current = trailers[index] ?? trailers[0];
  if (!current) return null;

  const ytId = parseYouTubeId(current.Url);
  const title = current.Name || t("seer:watchTrailer");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
      // stopPropagation : rendu dans l'overlay de la fiche détail — sans ça,
      // fermer le trailer fermerait aussi la fiche.
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ animation: "fadeIn 200ms ease forwards" }}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-tentacle-border-subtle bg-tentacle-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 250ms ease forwards" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h3 className="min-w-0 truncate text-sm font-semibold text-tentacle-text-primary sm:text-base">{title}</h3>
          <button
            onClick={onClose}
            aria-label={t("seer:cancel")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-tentacle-fill-soft text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary focus:outline-none focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {ytId ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                key={current.Url}
                src={youtubeEmbedSrc(ytId)}
                title={title}
                className="absolute inset-0 h-full w-full"
                // YouTube refuse l'embed sans Referer (erreur 153) — on force
                // l'envoi de l'origine pour CETTE iframe (prime sur la politique doc).
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/60 px-6 text-center text-sm text-white/60">
              {/* Boîte du player vidéo : convention "chrome vidéo" toujours sombre (comme le
                  fond bg-black ci-dessus quand la vidéo charge), volontairement non thémée. */}
              {t("seer:trailerUnavailable")}
            </div>
          )}

          <a
            href={current.Url}
            target="_blank"
            rel="noopener noreferrer"
            // Sandbox iframe sans allow-popups : target=_blank est bloqué →
            // on passe par le bridge host (navigateur système sous Tauri).
            onClick={externalLinkHandler(current.Url)}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-tentacle-border-subtle px-3 py-2 text-sm font-medium text-tentacle-text-secondary transition-colors hover:border-tentacle-border-strong hover:text-tentacle-text-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {t("seer:openOnYoutube")}
          </a>

          {trailers.length > 1 && (
            <div className="mt-4 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {trailers.map((tr, i) => (
                <button
                  key={tr.Url}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === index
                      ? "border-[rgba(var(--brand-rgb),0.45)] bg-[rgba(var(--brand-rgb),0.15)] text-tentacle-brand-light"
                      : "border-tentacle-border-subtle bg-tentacle-fill-subtle text-tentacle-text-secondary hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary"
                  }`}
                >
                  {tr.Name || `${t("seer:watchTrailer")} ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
