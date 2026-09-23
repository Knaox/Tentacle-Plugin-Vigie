/* ------------------------------------------------------------------ */
/*  Vigie — Les filtres actifs, en puces qu'on retire d'un geste        */
/* ------------------------------------------------------------------ */

/*
 * Ce qui filtre la grille reste visible au-dessus d'elle : chaque filtre est
 * une puce avec sa croix (cible de 32 px, libellé accessible « Retirer … »),
 * et « Tout effacer » vide le tout. Défilante au téléphone, sur une seule
 * ligne : la grille ne descend pas d'un écran pour trois filtres.
 */

import { useTranslation } from "react-i18next";
import { MOVIE_GENRES, TV_GENRES } from "../constants/genres";
import { LANGUAGES } from "../constants/languages";
import { TV_STATUSES } from "../constants/tv-statuses";
import { PLATFORMS } from "../utils/platforms";
import { useCalendarProviders } from "../hooks/useReleases";
import { CloseIcon } from "./ui/icons";
import type { DiscoverMediaType, DiscoverFilters, TvStatus } from "../api/types";

interface ActiveFilterPillsProps {
  mediaType: DiscoverMediaType;
  filters: DiscoverFilters;
  onRemoveGenre: (id: number) => void;
  onRemoveWatchProvider: (id: number) => void;
  onClearYears: () => void;
  onClearRating: () => void;
  onClearLanguage: () => void;
  onRemoveTvStatus: (s: TvStatus) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation("seer");
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--brand-soft)] pl-3 pr-1 text-xs font-semibold text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.35)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("seer:removeFilter", { label })}
        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--brand-rgb),0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function ActiveFilterPills({
  mediaType, filters, onRemoveGenre, onRemoveWatchProvider, onClearYears, onClearRating,
  onClearLanguage, onRemoveTvStatus, onReset, hasActiveFilters,
}: ActiveFilterPillsProps) {
  const { t } = useTranslation("seer");
  const { data: providers } = useCalendarProviders();
  if (!hasActiveFilters) return null;

  const genres = mediaType === "movies" ? MOVIE_GENRES : TV_GENRES;
  const providerName = (id: number) =>
    providers?.results?.find((p) => p.id === id)?.name ?? PLATFORMS.find((p) => p.id === id)?.name ?? null;

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {filters.genres.map((id) => {
        const genre = genres.find((g) => g.id === id);
        return genre ? <Chip key={`g-${id}`} label={t(genre.key)} onRemove={() => onRemoveGenre(id)} /> : null;
      })}
      {filters.watchProviders.map((id) => {
        const name = providerName(id);
        return name ? <Chip key={`p-${id}`} label={name} onRemove={() => onRemoveWatchProvider(id)} /> : null;
      })}
      {(filters.yearFrom != null || filters.yearTo != null) && (
        <Chip label={`${filters.yearFrom ?? "…"} – ${filters.yearTo ?? "…"}`} onRemove={onClearYears} />
      )}
      {filters.ratingMin != null && <Chip label={`★ ${filters.ratingMin.toFixed(1)}+`} onRemove={onClearRating} />}
      {filters.originalLanguage && (
        <Chip label={t(LANGUAGES.find((l) => l.code === filters.originalLanguage)?.key ?? "langEnglish")} onRemove={onClearLanguage} />
      )}
      {mediaType !== "movies" && filters.tvStatus.map((s) => {
        const status = TV_STATUSES.find((ts) => ts.value === s);
        return status ? <Chip key={`s-${s}`} label={t(status.key)} onRemove={() => onRemoveTvStatus(s)} /> : null;
      })}
      <button
        type="button"
        onClick={onReset}
        className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
      >
        {t("seer:clearAllFilters")}
      </button>
    </div>
  );
}
