/* ------------------------------------------------------------------ */
/*  Vigie — L'en-tête du hub : la recherche d'abord                    */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'on vient faire ici, neuf fois sur dix, c'est chercher un titre qui
 * n'est pas sur le serveur : le champ est donc grand, en haut, et prend le
 * clavier au ⌘K (Ctrl+K). Dessous, les trois vues du hub — elles restent
 * accrochées en haut de l'écran quand on descend, pour passer de l'une à
 * l'autre sans remonter.
 */

import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { searchShortcutLabel, showsKeyboardHints } from "../utils/host-env";
import { useSearchHotkey } from "../hooks/useSearchHotkey";
import { CalendarIcon, CloseIcon, CompassIcon, ListIcon, SearchIcon } from "../components/ui/icons";
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

export const HubHeader = memo(function HubHeader(props: HubHeaderProps) {
  const { query, onQuery, searching, tab, searchActive, onTab, activeRequests, weekReleases } = props;
  const { t } = useTranslation("seer");
  const input = useRef<HTMLInputElement>(null);
  useSearchHotkey(input, () => onQuery(""));

  /* Au téléphone, les trois onglets se partagent la largeur, sans icône et
   * avec un libellé court : « Mes demandes » en entier poussait « Calendrier »
   * hors de l'écran. */
  const tabs: Array<{ id: HubTab; label: string; short: string; icon: React.ReactNode; badge: number }> = [
    { id: "discover", label: t("seer:tabDiscover"), short: t("seer:tabDiscover"), icon: <CompassIcon className="h-[18px] w-[18px]" />, badge: 0 },
    { id: "requests", label: t("seer:tabRequests"), short: t("seer:tabRequestsShort"), icon: <ListIcon className="h-[18px] w-[18px]" />, badge: activeRequests },
    { id: "calendar", label: t("seer:tabCalendar"), short: t("seer:tabCalendar"), icon: <CalendarIcon className="h-[18px] w-[18px]" />, badge: weekReleases },
  ];

  return (
    <>
      <header className="relative px-4 pb-4 pt-5 md:px-8 md:pt-7">
        {/* Halo de marque, fixe — rien ne s'anime (règle GPU du projet). */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: "radial-gradient(60% 100% at 20% 0%, rgba(var(--brand-rgb),0.22), transparent 70%)" }} />
        <div className="relative">
          <h1 className="text-2xl font-extrabold tracking-tight text-tentacle-text-primary sm:text-3xl">{t("seer:hubTitle")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-tentacle-text-tertiary">{t("seer:hubSubtitle")}</p>
          <div
            role="search"
            className="group mt-4 flex h-12 w-full max-w-3xl items-center gap-3 rounded-full bg-tentacle-surface-2 pl-5 pr-2 ring-1 ring-tentacle-border-strong transition-shadow focus-within:ring-2 focus-within:ring-[rgba(var(--brand-rgb),0.7)] sm:h-14"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-tentacle-text-tertiary group-focus-within:text-[var(--brand-light)]" />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("seer:hubSearchPlaceholder")}
              aria-label={t("seer:hubSearchPlaceholder")}
              autoComplete="off"
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
        <div role="tablist" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => {
            const selected = !searchActive && tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTab(item.id)}
                className={`relative flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 px-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-rgb),0.6)] sm:flex-none sm:shrink-0 sm:justify-start sm:gap-2 sm:px-4 ${
                  selected ? "text-tentacle-text-primary" : "text-tentacle-text-tertiary hover:text-tentacle-text-primary"
                }`}
              >
                <span className={`hidden sm:inline ${selected ? "text-[var(--brand-light)]" : ""}`}>{item.icon}</span>
                <span className="truncate sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand-soft)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--brand-light)]">
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
      </nav>
    </>
  );
});
