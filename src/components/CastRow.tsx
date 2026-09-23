import { useRef, useState, useEffect, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { profileUrl } from "../utils/media-helpers";
import type { SeerrCastMember } from "../api/types";
import { HubContext } from "../hub/HubContext";

interface CastRowProps {
  cast: SeerrCastMember[];
}

function AvatarFallback({ name }: { name: string }) {
  return (
    <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-tentacle-fill-soft text-sm font-medium text-tentacle-text-quaternary">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function CastRow({ cast }: CastRowProps) {
  const { t } = useTranslation("seer");
  // Dans le hub : un portrait ouvre la filmographie. Ailleurs, rien ne se passe.
  const hub = useContext(HubContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const members = cast.slice(0, 15);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows, members.length]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  if (members.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
          {t("castTitle")}
        </h3>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-tentacle-fill-soft text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-tentacle-fill-soft text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium disabled:opacity-20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent", cursor: "grab" }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grabbing"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
      >
        {members.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => hub?.openPerson(person.id)}
            disabled={!hub}
            aria-label={person.name}
            className="group flex w-[60px] flex-shrink-0 flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default"
          >
            {person.profilePath ? (
              <img
                src={profileUrl(person.profilePath)}
                alt=""
                className="h-[60px] w-[60px] rounded-full object-cover ring-2 ring-transparent transition-shadow group-hover:ring-[rgba(var(--brand-rgb),0.6)]"
                loading="lazy"
              />
            ) : (
              <AvatarFallback name={person.name} />
            )}
            <span className="mt-1.5 w-full text-center text-[11px] font-medium leading-tight text-tentacle-text-secondary line-clamp-2">
              {person.name}
            </span>
            <span className="w-full truncate text-center text-[10px] text-tentacle-text-quaternary">
              {person.character}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
