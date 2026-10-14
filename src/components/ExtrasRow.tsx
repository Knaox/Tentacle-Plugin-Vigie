import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseYouTubeId, type RichTrailer } from "../utils/trailers";

interface ExtrasRowProps {
  /** Trailers + extras distants (déjà fusionnés Jellyfin + TMDB, triés langue). */
  trailers: RichTrailer[];
  /** Lance la bande-annonce cliquée (lecteur complet de l'hôte, sinon sa modale ou la nôtre). */
  onSelect: (index: number) => void;
}

/**
 * Rangée « Extras » — réplique STRICTE d'ExtrasRow du core (page média détail) :
 * tuiles vignettes (YouTube, Dailymotion), clic → la bande-annonce cliquée ;
 * sous le titre, ce que le catalogue en dit (« Saison 6 · VF · AlloCiné »).
 * Masquée si rien à montrer.
 */
export function ExtrasRow({ trailers, onSelect }: ExtrasRowProps) {
  const { t } = useTranslation("seer");
  if (trailers.length === 0) return null;

  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
        {t("seer:extras")}
      </h4>
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent" }}
        aria-label={t("seer:extras")}
      >
        {trailers.map((tr, i) => (
          <ExtraTile
            key={tr.Url}
            label={tr.Name || t("seer:watchTrailer")}
            sublabel={trailerSublabel(tr, t) || tr.type || "YouTube"}
            thumb={thumbOf(tr)}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </section>
  );
}

/** La vignette : YouTube (`hqdefault`), Dailymotion (sa vignette publique), sinon aucune. */
function thumbOf(tr: RichTrailer): string | undefined {
  if (tr.playback?.kind === "dailymotion") return `https://www.dailymotion.com/thumbnail/video/${tr.playback.videoId}`;
  const yt = tr.playback?.kind === "youtube" ? tr.playback.ytId : parseYouTubeId(tr.Url);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : undefined;
}

/** Ce que le catalogue dit d'une bande-annonce : portée, version, origine. */
function trailerSublabel(tr: RichTrailer, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!tr.playback) return "";
  const scope = tr.scope?.kind === "season" ? t("seer:trailerScopeSeason", { season: tr.scope.season })
    : tr.scope?.kind === "series" ? t("seer:trailerScopeSeries") : null;
  const version = tr.versionKey ? t(`seer:trailerVersion_${tr.versionKey}`) : null;
  const origin = t(`seer:trailerOrigin_${tr.source === "allocine" ? "allocine" : tr.playback.kind}`);
  return [scope, version, origin].filter(Boolean).join(" · ");
}

function ExtraTile({
  label,
  sublabel,
  thumb,
  onClick,
}: {
  label: string;
  sublabel?: string;
  /** La vignette ; une image grise de 120 px (vidéo retirée ou privée) masque la tuile. */
  thumb?: string;
  onClick: () => void;
}) {
  // YouTube renvoie un placeholder gris 120x90 sur hqdefault.jpg pour les vidéos
  // supprimées ou privées → on masque la tuile au chargement de la vignette.
  const [unavailable, setUnavailable] = useState(false);
  const src = thumb;
  if (unavailable) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/extra flex w-44 flex-shrink-0 cursor-pointer flex-col text-left sm:w-52"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-tentacle-surface-2 transition-transform duration-200 group-hover/extra:scale-[1.03]">
        {src ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover"
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) {
                setUnavailable(true);
              }
            }}
            onError={() => setUnavailable(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-tentacle-text-disabled">
            <PlayGlyph />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition-colors duration-200 group-hover/extra:bg-black/35">
          <span className="opacity-0 transition-opacity duration-200 group-hover/extra:opacity-100">
            <PlayGlyph />
          </span>
        </div>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-tentacle-text-secondary">{label}</p>
      {sublabel && <p className="truncate text-xs text-tentacle-text-tertiary">{sublabel}</p>}
    </button>
  );
}

function PlayGlyph() {
  return (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
