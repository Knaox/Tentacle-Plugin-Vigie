/* ------------------------------------------------------------------ */
/*  Vigie — L'en-tête du hub : la recherche d'abord                    */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'on vient faire ici, neuf fois sur dix, c'est chercher un titre qui
 * n'est pas sur le serveur : le champ est donc grand, en haut, et prend le
 * clavier au ⌘K (Ctrl+K). Dessous, les quatre vues du hub — elles restent
 * accrochées en haut de l'écran quand on descend, pour passer de l'une à
 * l'autre sans remonter.
 *
 * Au téléphone, l'écran est compté : l'onglet de l'hôte s'appelle déjà
 * « Vigie », le titre et sa phrase d'accroche cèdent donc la place (le titre
 * reste pour les lecteurs d'écran) et le contenu commence sous le champ.
 * Quand on a fait défiler le champ hors de vue, une loupe apparaît au bout de
 * la barre accrochée : la recherche reste à un toucher, où qu'on soit.
 */

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { searchShortcutLabel, showsKeyboardHints } from "../utils/host-env";
import { useSearchHotkey } from "../hooks/useSearchHotkey";
import { CalendarIcon, CloseIcon, CompassIcon, LayersIcon, ListIcon, SearchIcon } from "../components/ui/icons";
import type { HubTab } from "./HubContext";

interface HubHeaderProps {
  query: string;
  onQuery: (query: string) => void;
  searching: boolean;
  tab: HubTab;
  /** Recherche en cours : aucun onglet n'est actif, la recherche couvre tout. */
  searchActive: boolean;
  onTab: (tab: HubTab) => void;
  /** Demandes en cours d'arrivée. */
  activeRequests: number;
  /** Sorties des sept prochains jours. */
  weekReleases: number;
}

/** Hauteur de la barre accrochée (48 + filet) : sous elle, le champ est caché. */
const STICKY_BAR = 49;

/** Le champ est-il encore visible sous la barre accrochée ? */
function useInView(target: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: `-${STICKY_BAR}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  return inView;
}

export const HubHeader = memo(function HubHeader(props: HubHeaderProps) {
  const { query, onQuery, searching, tab, searchActive, onTab, activeRequests, weekReleases } = props;
  const { t } = useTranslation("seer");
  const input = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const fieldInView = useInView(field);
  useSearchHotkey(input, () => onQuery(""));

  // « Rechercher » sur le clavier du téléphone : on a tapé, on veut voir les
  // résultats — le clavier se range au lieu de les couvrir.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  // Focus SYNCHRONE, dans le geste : iOS ne sort le clavier que pour un focus
  // donné pendant le toucher lui-même.
  const jumpToSearch = () => {
    window.scrollTo({ top: 0 });
    input.current?.focus({ preventScroll: true });
  };

  /* Au téléphone, les quatre onglets se partagent la largeur, sans icône et
   * avec un libellé court ; le compteur y devient un exposant pour ne rien
   * pousser hors de l'écran. Chacun prend sa largeur NATURELLE puis une part
   * du reste : à parts égales, « Demandes », le plus long, était tronqué. */
  const tabs: Array<{ id: HubTab; label: string; short: string; icon: React.ReactNode; badge: number }> = [
    { id: "discover", label: t("seer:tabDiscover"), short: t("seer:tabDiscover"), icon: <CompassIcon className="h-[18px] w-[18px]" />, badge: 0 },
    { id: "catalog", label: t("seer:tabCatalog"), short: t("seer:tabCatalog"), icon: <LayersIcon className="h-[18px] w-[18px]" />, badge: 0 },
    { id: "requests", label: t("seer:tabRequests"), short: t("seer:tabRequestsShort"), icon: <ListIcon className="h-[18px] w-[18px]" />, badge: activeRequests },
    { id: "calendar", label: t("seer:tabCalendar"), short: t("seer:tabCalendar"), icon: <CalendarIcon className="h-[18px] w-[18px]" />, badge: weekReleases },
  ];
  const jumpShown = !fieldInView;

  return (
    <>
      <header className="relative px-4 pb-3 pt-3 sm:pb-4 sm:pt-5 md:px-8 md:pt-7">
        {/* Halo de marque, fixe — rien ne s'anime (règle GPU du projet). */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: "radial-gradient(60% 100% at 20% 0%, rgba(var(--brand-rgb),0.22), transparent 70%)" }} />
        <div className="relative">
          <h1 className="sr-only text-2xl font-extrabold tracking-tight text-tentacle-text-primary sm:not-sr-only sm:block sm:text-3xl">{t("seer:hubTitle")}</h1>
          <p className="mt-1 hidden max-w-2xl text-sm text-tentacle-text-tertiary sm:block">{t("seer:hubSubtitle")}</p>
          <div
            ref={field}
            role="search"
            className="group flex h-11 w-full max-w-3xl items-center gap-3 rounded-full bg-tentacle-surface-2 pl-4 pr-1 ring-1 ring-tentacle-border-strong transition-shadow focus-within:ring-2 focus-within:ring-[rgba(var(--brand-rgb),0.7)] sm:mt-4 sm:h-14 sm:pl-5 sm:pr-2"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-tentacle-text-tertiary group-focus-within:text-[var(--brand-light)]" />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("seer:hubSearchPlaceholder")}
              aria-label={t("seer:hubSearchPlaceholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-tentacle-text-primary outline-none placeholder:text-tentacle-text-quaternary [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searching && query.trim() !== "" && (
              <span aria-label={t("seer:searching")} className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
            )}
            {query !== "" ? (
              <button
                type="button"
                onClick={() => { onQuery(""); input.current?.focus(); }}
                aria-label={t("seer:clearSearch")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            ) : showsKeyboardHints() ? (
              <kbd className="mr-2 hidden shrink-0 rounded-md border border-tentacle-border-subtle bg-tentacle-fill-subtle px-2 py-0.5 text-[11px] text-tentacle-text-quaternary sm:inline">
                {searchShortcutLabel()}
              </kbd>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        aria-label={t("seer:hubTitle")}
        className="sticky top-0 z-30 border-b border-tentacle-border-subtle bg-tentacle-surface-0 px-4 md:px-8"
      >
        <div className="flex items-center">
          <div role="tablist" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((item) => {
              const selected = !searchActive && tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={item.badge > 0 ? `${item.label} (${item.badge})` : item.label}
                  onClick={() => onTab(item.id)}
                  className={`relative flex min-h-[48px] min-w-0 flex-auto items-center justify-center gap-1.5 px-1 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-rgb),0.6)] min-[400px]:text-sm sm:flex-none sm:shrink-0 sm:justify-start sm:gap-2 sm:px-4 ${
                    selected ? "text-tentacle-text-primary" : "text-tentacle-text-tertiary hover:text-tentacle-text-primary"
                  }`}
                >
                  <span className={`hidden sm:inline ${selected ? "text-[var(--brand-light)]" : ""}`}>{item.icon}</span>
                  {/* La pastille en exposant : posée à côté, elle tronquait « Demandes ». */}
                  <span className="relative flex min-w-0 sm:hidden">
                    <span className="truncate">{item.short}</span>
                    {item.badge > 0 && <span aria-hidden className="absolute -right-2 top-0 h-1.5 w-1.5 rounded-full bg-[var(--brand-light)]" />}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="hidden h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand-soft)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--brand-light)] sm:flex">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  {selected && (
                    <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]" />
                  )}
                </button>
              );
            })}
          </div>
          {/* La place de la loupe est TOUJOURS réservée au téléphone : les
              onglets ne sautent pas quand elle apparaît. */}
          <div className="flex w-11 shrink-0 items-center justify-end sm:hidden">
            <button
              type="button"
              onClick={jumpToSearch}
              aria-label={t("seer:searchJump")}
              aria-hidden={!jumpShown}
              tabIndex={jumpShown ? 0 : -1}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-tentacle-text-secondary transition-[opacity,transform] duration-200 active:scale-95 ${
                jumpShown ? "opacity-100" : "pointer-events-none scale-90 opacity-0"
              }`}
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
});
