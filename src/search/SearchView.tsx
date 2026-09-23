/* ------------------------------------------------------------------ */
/*  Vigie — Les résultats d'une recherche                              */
/* ------------------------------------------------------------------ */

/*
 * Ce qui remplace l'onglet courant dès qu'on tape : une correction quand il y
 * a eu faute, les genres et plateformes qui répondent au mot tapé, le meilleur
 * résultat en grand, puis les films, les séries et les personnes. Les
 * affiches apparaissent pendant la frappe (réponse de l'index), la réponse
 * complète les rejoint sans rien bousculer.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import type { VigieSearchResponse } from "../api/types-search";
import { useHub } from "../hub/HubContext";
import { PosterCard, PosterCardSkeleton } from "../components/ui/PosterCard";
import { SectionHeader } from "../components/ui/Rail";
import { EmptyState } from "../components/EmptyState";
import { BlockedResultsBanner } from "../components/BlockedResultsBanner";
import { CTA_SECONDARY, CTA_SIZE_MD } from "../styles/cta";
import { SearchFacets } from "./SearchFacets";
import { PeopleRow } from "./PeopleRow";
import { TopMediaResult, TopPersonResult } from "./TopResult";
import type { VigieSearchState } from "./useVigieSearch";

const GRID = "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8";

interface Props {
  query: string;
  search: VigieSearchState;
  showBlocked: boolean;
  onToggleBlocked: () => void;
  /** « Rechercher X quand même » : relance sans correction. */
  onSearchExact: () => void;
}

export const SearchView = memo(function SearchView({ query, search, showBlocked, onToggleBlocked, onSearchExact }: Props) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const data = search.data;

  if (!data) {
    return (
      <div aria-busy="true" className={GRID}>
        {Array.from({ length: 12 }, (_, i) => <PosterCardSkeleton key={i} />)}
      </div>
    );
  }

  const nothing = data.top === null && data.movies.length + data.series.length + data.people.length === 0;

  return (
    <div className="space-y-8" style={{ animation: "viewCrossfade 180ms ease both" }}>
      <Notices data={data} typed={query} onSearchExact={onSearchExact} />
      {data.facets.length > 0 && <SearchFacets facets={data.facets} />}

      {nothing ? (
        search.refining ? (
          <div className={GRID}>{Array.from({ length: 6 }, (_, i) => <PosterCardSkeleton key={i} />)}</div>
        ) : (
          <EmptyState title={t("seer:searchNothing", { query: data.query })} subtitle={t("seer:searchNothingHint")} />
        )
      ) : (
        <>
          {data.top?.kind === "media" && <TopMediaResult item={data.top.item} />}
          {data.top?.kind === "person" && <TopPersonResult person={data.top.person} />}
          <ResultGrid title={t("seer:resultsMovies")} items={data.movies} onOpen={hub.openMedia} onQuickRequest={hub.quickRequest} />
          <ResultGrid title={t("seer:resultsSeries")} items={data.series} onOpen={hub.openMedia} />
          {data.people.length > 0 && <PeopleRow people={data.people} />}
          {search.refining && (
            <p className="flex items-center gap-2 text-xs text-tentacle-text-quaternary" role="status">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
              {t("seer:searchRefining")}
            </p>
          )}
          {search.hasMore && (
            <div className="flex justify-center pt-2">
              <button type="button" onClick={search.loadMore} disabled={search.loadingMore} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
                {search.loadingMore ? t("seer:loading") : t("seer:searchMore")}
              </button>
            </div>
          )}
        </>
      )}
      {/* Après ce qu'on cherchait — ou sous « aucun résultat » quand tout a été masqué. */}
      {data.blockedActive && (data.blockedCount > 0 || showBlocked) && (
        <BlockedResultsBanner blockedCount={data.blockedCount} showBlocked={showBlocked} onToggle={onToggleBlocked} />
      )}
    </div>
  );
});

function Notices({ data, typed, onSearchExact }: { data: VigieSearchResponse; typed: string; onSearchExact: () => void }) {
  const { t } = useTranslation("seer");
  if (!data.correction && !data.indexing) return null;
  return (
    <div className="space-y-1 text-sm text-tentacle-text-tertiary">
      {data.correction && (
        <p>
          {t("seer:resultsFor")} <span className="font-semibold italic text-[var(--brand-light)]">{data.correction}</span>
          {" · "}
          <button type="button" onClick={onSearchExact} className="underline-offset-2 hover:underline">
            {t("seer:searchInstead", { query: typed.trim() })}
          </button>
        </p>
      )}
      {data.indexing && <p className="text-xs text-tentacle-text-quaternary">{t("seer:searchIndexing")}</p>}
    </div>
  );
}

function ResultGrid({ title, items, onOpen, onQuickRequest }: {
  title: string;
  items: SeerrSearchResult[];
  onOpen: (item: SeerrSearchResult) => void;
  onQuickRequest?: (item: SeerrSearchResult) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeader title={title} count={items.length} />
      <div className={GRID}>
        {items.map((item, i) => (
          <PosterCard key={`${item.mediaType}:${item.id}`} item={item} onOpen={onOpen} onQuickRequest={onQuickRequest} eager={i < 8} />
        ))}
      </div>
    </section>
  );
}
