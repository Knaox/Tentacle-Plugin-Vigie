/* ------------------------------------------------------------------ */
/*  Vigie — Les genres et plateformes que la recherche reconnaît        */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchFacet } from "../api/types-search";
import { useHub } from "../hub/HubContext";
import { genrePreset, providerPreset } from "../browse/presets";
import { ChevronRight } from "../components/ui/icons";

const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";

/** « Comédie · Films », « Netflix » : une pastille ouvre le catalogue déjà filtré. */
export const SearchFacets = memo(function SearchFacets({ facets }: { facets: SearchFacet[] }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={t("seer:browseBy")}>
      {facets.map((facet) => {
        const kindLabel = facet.kind === "genre"
          ? (facet.mediaType === "movie" ? t("seer:filterMovies") : t("seer:filterSeries"))
          : t("seer:platform");
        const open = () => hub.browse(facet.kind === "genre"
          ? genrePreset(facet.id, facet.mediaType, facet.label)
          : providerPreset(facet.id, facet.label));
        return (
          <button
            key={`${facet.kind}:${facet.id}:${facet.kind === "genre" ? facet.mediaType : ""}`}
            type="button"
            role="listitem"
            onClick={open}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-tentacle-surface-2 py-1.5 pl-2 pr-3 text-sm font-semibold text-tentacle-text-primary ring-1 ring-tentacle-border-strong transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            {facet.kind === "provider" && facet.logoPath ? (
              <img src={`${TMDB_LOGO}${facet.logoPath}`} alt="" className="h-6 w-6 rounded-md object-cover" />
            ) : (
              <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-light)]">{kindLabel}</span>
            )}
            {facet.label}
            <ChevronRight className="h-4 w-4 text-tentacle-text-quaternary" />
          </button>
        );
      })}
    </div>
  );
});
