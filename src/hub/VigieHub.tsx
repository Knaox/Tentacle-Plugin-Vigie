/* ------------------------------------------------------------------ */
/*  Vigie — Le hub                                                     */
/* ------------------------------------------------------------------ */

/*
 * UNE page pour tout : chercher, découvrir, parcourir le catalogue entier,
 * suivre ses demandes, voir ce qui sort. Les vues déjà ouvertes restent
 * montées (cachées) : revenir à un onglet le retrouve tel qu'on l'a laissé,
 * sans rien recharger — là où l'hôte reconstruisait tout le cadre du plugin à
 * chaque entrée du menu. Un onglet s'ouvre en haut de sa page.
 *
 * Le catalogue a son onglet, et c'est LA grille de Vigie : « Tout voir », un
 * genre, une plateforme, une pastille de la recherche y mènent, déjà filtrés.
 * On n'a plus à descendre au bas de Découvrir pour trouver le catalogue, et un
 * parcours ouvert se retrouve tel quel en revenant sur l'onglet.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BrowseType, SeerrSearchResult } from "../api/types";
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
import { QuickSeasonsSheet } from "../components/QuickSeasonsSheet";
import { HubContext, type BrowsePreset, type HubApi, type HubTab, type OpenMediaOptions } from "./HubContext";
import { HubHeader } from "./HubHeader";
import { hostQuery, readHubEntry } from "./deepLink";
import { useHubData } from "./useHubData";
import { TitleStatesProvider } from "./TitleStates";

const MIN_SEARCH = 2;

const TAB_LABEL: Record<HubTab, string> = {
  discover: "seer:tabDiscover", catalog: "seer:tabCatalog", requests: "seer:tabRequests", calendar: "seer:tabCalendar",
};

/** Ce que l'onglet Catalogue montre : un parcours, ses filtres ouverts ou non, et d'où l'on vient. */
interface CatalogEntry {
  /** Change à chaque ouverture demandée : la grille repart de ce qu'on a demandé. */
  nonce: number;
  preset: BrowsePreset;
  filters: boolean;
  /** L'onglet d'où l'on est venu, pour y revenir d'un geste. */
  from: HubTab | null;
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
  const [catalog, setCatalog] = useState<CatalogEntry>(() => ({ nonce: 0, preset: catalogPreset(t), filters: false, from: null }));
  const [detail, setDetail] = useState<{ item: SeerrSearchResult; options?: OpenMediaOptions } | null>(
    entry.media ? { item: { id: entry.media.id, mediaType: entry.media.mediaType } } : null,
  );
  const [personId, setPersonId] = useState<number | null>(entry.person);
  const [quickSeasons, setQuickSeasons] = useState<SeerrSearchResult | null>(null);

  const data = useHubData();
  const search = useVigieSearch(query, { showBlocked, exact });
  const searching = query.trim().length >= MIN_SEARCH;

  // Un onglet s'ouvre en haut de sa page. Seuls un RETOUR (« Retour à
  // Découvrir ») et la sortie d'une recherche rendent la position qu'on avait
  // quittée : là, c'est ce qu'on attend.
  const viewKey = searching ? "search" : tab === "catalog" ? `catalog:${catalog.nonce}` : tab;
  const positions = useRef(new Map<string, number>());
  const currentView = useRef(viewKey);
  const restoreNext = useRef(false);
  const leave = useCallback(() => { positions.current.set(currentView.current, window.scrollY); }, []);
  useLayoutEffect(() => {
    if (currentView.current === viewKey) return;
    const fromSearch = currentView.current === "search";
    currentView.current = viewKey;
    const restore = restoreNext.current || fromSearch;
    restoreNext.current = false;
    window.scrollTo({ top: restore ? positions.current.get(viewKey) ?? 0 : 0 });
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

  const setTab = goTo;

  /** Le catalogue, sur un parcours : « Tout voir », un genre, une plateforme… */
  const browse = useCallback((preset: BrowsePreset, withFilters = false) => {
    setCatalog((c) => ({ nonce: c.nonce + 1, preset, filters: withFilters, from: tab === "catalog" ? c.from : tab }));
    goTo("catalog");
  }, [goTo, tab]);

  const openCatalog = useCallback((mediaType?: BrowseType, withFilters = false) => {
    if (!mediaType && !withFilters) { goTo("catalog"); return; }
    browse(catalogPreset(t, mediaType ?? catalog.preset.mediaType), withFilters);
  }, [browse, catalog.preset.mediaType, goTo, t]);

  const openMedia = useCallback((item: SeerrSearchResult, options?: OpenMediaOptions) => {
    setPersonId(null);
    setDetail({ item, options });
  }, []);

  const quickRequest = useCallback((item: SeerrSearchResult) => {
    // Une série : ses saisons libres, cochées d'un geste — sans ouvrir la fiche.
    if (item.mediaType === "tv") { setQuickSeasons(item); return; }
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
            <div hidden={!show("discover")}><DiscoverHome data={data} /></div>
            {visited.has("catalog") && (
              <div hidden={!show("catalog")}>
                <BrowseView
                  key={`catalog:${catalog.nonce}`}
                  preset={catalog.preset}
                  active={show("catalog")}
                  openFilters={catalog.filters}
                  back={catalog.from ? {
                    label: t("seer:backToTab", { tab: t(TAB_LABEL[catalog.from]) }),
                    run: () => { restoreNext.current = true; goTo(catalog.from as HubTab); },
                  } : undefined}
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
        {quickSeasons && (
          <QuickSeasonsSheet
            item={quickSeasons}
            onClose={() => setQuickSeasons(null)}
            onOpenDetail={(item) => { setQuickSeasons(null); openMedia(item); }}
          />
        )}
      </TitleStatesProvider>
    </HubContext.Provider>
  );
}
