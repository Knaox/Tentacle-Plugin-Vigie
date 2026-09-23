/* ------------------------------------------------------------------ */
/*  Vigie — Le hub                                                     */
/* ------------------------------------------------------------------ */

/*
 * UNE page pour tout : chercher, découvrir, parcourir le catalogue entier,
 * suivre ses demandes, voir ce qui sort. Les vues déjà ouvertes restent
 * montées (cachées) : revenir à un onglet le retrouve tel qu'on l'a laissé,
 * position de défilement comprise, sans rien recharger — là où l'hôte
 * reconstruisait tout le cadre du plugin à chaque entrée du menu.
 *
 * Le catalogue a son onglet : on n'a plus à descendre au bas de Découvrir pour
 * trouver « Parcourir tout le catalogue ».
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiscoverMediaType, SeerrSearchResult } from "../api/types";
import { formatSeerError } from "../api/seer-client";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { mediaTitle, mediaYear, posterUrl } from "../utils/media-helpers";
import { CHROME_BOTTOM } from "../utils/host-chrome";
import { MediaDetailModal } from "../components/MediaDetailModal";
import { SearchView } from "../search/SearchView";
import { useVigieSearch } from "../search/useVigieSearch";
import { DiscoverHome } from "../discover/DiscoverHome";
import { BrowseView } from "../browse/BrowseView";
import { catalogPreset } from "../browse/presets";
import { RequestsView } from "../requests/RequestsView";
import { CalendarView } from "../calendar/CalendarView";
import { PersonSheet } from "../person/PersonSheet";
import { HubContext, type BrowsePreset, type HubApi, type HubTab, type OpenMediaOptions } from "./HubContext";
import { HubHeader } from "./HubHeader";
import { hostQuery, readHubEntry } from "./deepLink";
import { useHubData } from "./useHubData";
import { TitleStatesProvider } from "./TitleStates";

const MIN_SEARCH = 2;

/** Ce que l'onglet Catalogue montre : un type, et ses filtres ouverts ou non. */
interface CatalogEntry {
  /** Change à chaque ouverture demandée : la grille repart de ce qu'on a demandé. */
  nonce: number;
  mediaType: DiscoverMediaType;
  filters: boolean;
}

export function VigieHub({ routePath }: { routePath: string }) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const requestMedia = useRequestMedia();
  const entry = useMemo(() => readHubEntry(routePath, hostQuery()), [routePath]);

  const [tab, setTabState] = useState<HubTab>(entry.tab);
  const [visited, setVisited] = useState<ReadonlySet<HubTab>>(() => new Set([entry.tab]));
  const [query, setQueryState] = useState(entry.query);
  const [exact, setExact] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [preset, setPreset] = useState<BrowsePreset | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry>({ nonce: 0, mediaType: "movies", filters: false });
  const [detail, setDetail] = useState<{ item: SeerrSearchResult; options?: OpenMediaOptions } | null>(
    entry.media ? { item: { id: entry.media.id, mediaType: entry.media.mediaType } } : null,
  );
  const [personId, setPersonId] = useState<number | null>(entry.person);

  const data = useHubData();
  const search = useVigieSearch(query, { showBlocked, exact });
  const searching = query.trim().length >= MIN_SEARCH;

  // Chaque vue garde sa position : on la note en partant, on la rend en revenant.
  const viewKey = searching ? "search"
    : tab === "discover" ? (preset ? `browse:${preset.id}` : "home")
      : tab === "catalog" ? `catalog:${catalog.nonce}` : tab;
  const positions = useRef(new Map<string, number>());
  const currentView = useRef(viewKey);
  const leave = useCallback(() => { positions.current.set(currentView.current, window.scrollY); }, []);
  useLayoutEffect(() => {
    if (currentView.current === viewKey) return;
    currentView.current = viewKey;
    window.scrollTo({ top: positions.current.get(viewKey) ?? 0 });
  }, [viewKey]);

  const setQuery = useCallback((next: string) => {
    if (query.trim().length < MIN_SEARCH && next.trim().length >= MIN_SEARCH) leave();
    setExact(false);
    setQueryState(next);
  }, [query, leave]);

  const goTo = useCallback((next: HubTab) => {
    leave();
    setQueryState("");
    // Changer de vue ferme ce qui était ouvert par-dessus (fiche, filmographie).
    setDetail(null);
    setPersonId(null);
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set([...v, next])));
  }, [leave]);

  const setTab = useCallback((next: HubTab) => {
    // Re-cliquer l'onglet Découvrir ramène à son accueil.
    if (next === "discover" && tab === "discover") setPreset(null);
    goTo(next);
  }, [goTo, tab]);

  const openCatalog = useCallback((mediaType?: DiscoverMediaType, withFilters = false) => {
    if (mediaType || withFilters) {
      setCatalog((c) => ({ nonce: c.nonce + 1, mediaType: mediaType ?? c.mediaType, filters: withFilters }));
    }
    goTo("catalog");
  }, [goTo]);

  const browse = useCallback((next: BrowsePreset) => {
    leave();
    setQueryState("");
    setPreset(next);
    setTabState("discover");
    positions.current.delete(`browse:${next.id}`);
  }, [leave]);

  const openMedia = useCallback((item: SeerrSearchResult, options?: OpenMediaOptions) => {
    setPersonId(null);
    setDetail({ item, options });
  }, []);

  const quickRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType !== "movie") { openMedia(item); return; }
    const title = mediaTitle(item) || t("seer:untitled");
    requestMedia.mutate(
      { mediaType: "movie", tmdbId: item.id, title, posterPath: item.posterPath, backdropPath: item.backdropPath, overview: item.overview, year: mediaYear(item) },
      {
        onSuccess: () => toast.show("success", t("seer:requestAddedTitle", { title }), posterUrl(item.posterPath, "w92")),
        onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
      },
    );
  }, [openMedia, requestMedia, toast, t]);

  const api = useMemo<HubApi>(() => ({
    tab, setTab, openCatalog, openMedia, openPerson: setPersonId, browse, setQuery, quickRequest,
  }), [tab, setTab, openCatalog, openMedia, browse, setQuery, quickRequest]);

  const show = (view: HubTab) => !searching && tab === view;

  return (
    <HubContext.Provider value={api}>
      <TitleStatesProvider data={data}>
        <div className="min-h-screen bg-tentacle-surface-0" style={{ paddingBottom: `calc(2.5rem + ${CHROME_BOTTOM})` }}>
          <HubHeader
            query={query}
            onQuery={setQuery}
            searching={search.searching}
            tab={tab}
            searchActive={searching}
            onTab={setTab}
            activeRequests={data.counts.active}
            weekReleases={data.weekItems.length}
          />
          <main className="px-4 pt-5 md:px-8 md:pt-6">
            {searching && (
              <SearchView
                query={query}
                search={search}
                showBlocked={showBlocked}
                onToggleBlocked={() => setShowBlocked((v) => !v)}
                onSearchExact={() => setExact(true)}
              />
            )}
            <div hidden={!show("discover")}>
              {preset
                ? <BrowseView key={preset.id} preset={preset} active={show("discover")} onBack={() => { leave(); setPreset(null); }} />
                : <DiscoverHome data={data} />}
            </div>
            {visited.has("catalog") && (
              <div hidden={!show("catalog")}>
                <BrowseView
                  key={`catalog:${catalog.nonce}`}
                  preset={catalogPreset(t, catalog.mediaType)}
                  active={show("catalog")}
                  openFilters={catalog.filters}
                />
              </div>
            )}
            {visited.has("requests") && (
              <div hidden={!show("requests")}><RequestsView data={data} active={show("requests")} /></div>
            )}
            {visited.has("calendar") && (
              <div hidden={!show("calendar")}><CalendarView active={show("calendar")} /></div>
            )}
          </main>
        </div>

        {detail && (
          <MediaDetailModal
            item={detail.item}
            lockedSeasons={detail.options?.lockedSeasons}
            defaultProfileId={detail.options?.defaultProfileId}
            onClose={() => setDetail(null)}
            onRequest={quickRequest}
            requesting={requestMedia.isPending}
          />
        )}
        {personId !== null && <PersonSheet personId={personId} onClose={() => setPersonId(null)} />}
      </TitleStatesProvider>
    </HubContext.Provider>
  );
}
