import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { profileUrl } from "../utils/media-helpers";
import type { SeerrCastMember } from "../api/types";
import { HubContext } from "../hub/HubContext";
import { Rail } from "./ui/Rail";

/**
 * La distribution, en portraits qui défilent — comme les autres rangées de
 * Vigie (flèches au survol, aimantation au doigt). Dans le hub, un portrait
 * ouvre la filmographie de la personne.
 */
export const CastRow = memo(function CastRow({ cast }: { cast: SeerrCastMember[] }) {
  const { t } = useTranslation("seer");
  const hub = useContext(HubContext);
  const members = cast.slice(0, 20);
  if (members.length === 0) return null;

  return (
    <Rail title={t("castTitle")} itemWidth="person">
      {members.map((person) => {
        const photo = profileUrl(person.profilePath);
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => hub?.openPerson(person.id)}
            disabled={!hub}
            aria-label={person.character ? `${person.name} — ${person.character}` : person.name}
            className="group flex w-full flex-col items-center rounded-2xl pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default"
          >
            <span className="block aspect-square w-full overflow-hidden rounded-full bg-tentacle-fill-soft ring-2 ring-transparent transition-shadow group-hover:ring-[rgba(var(--brand-rgb),0.6)]">
              {photo
                ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                : <span className="flex h-full w-full items-center justify-center text-lg font-bold text-tentacle-text-quaternary">{person.name[0]?.toUpperCase() ?? "?"}</span>}
            </span>
            <span className="mt-2 line-clamp-2 w-full text-center text-xs font-semibold leading-tight text-tentacle-text-primary">{person.name}</span>
            {person.character && <span className="mt-0.5 w-full truncate text-center text-[11px] text-tentacle-text-tertiary">{person.character}</span>}
          </button>
        );
      })}
    </Rail>
  );
});
