/* ------------------------------------------------------------------ */
/*  Vigie — Les personnes trouvées                                     */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchPerson } from "../api/types-search";
import { useHub } from "../hub/HubContext";
import { profileUrl } from "../utils/media-helpers";
import { Rail } from "../components/ui/Rail";
import { UserIcon } from "../components/ui/icons";

/** Un portrait ouvre la filmographie — de quoi trouver ce qui manque encore. */
export const PeopleRow = memo(function PeopleRow({ people }: { people: SearchPerson[] }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  return (
    <Rail title={t("seer:resultsPeople")} count={people.length}>
      {people.map((person) => {
        const photo = profileUrl(person.profilePath, "w185");
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => hub.openPerson(person.id)}
            className="group flex w-full flex-col items-center text-center focus-visible:outline-none"
          >
            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle transition-shadow group-hover:ring-2 group-hover:ring-[rgba(var(--brand-rgb),0.6)] group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
              {photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : <UserIcon className="h-10 w-10 text-tentacle-text-disabled" />}
            </span>
            <span className="mt-2 line-clamp-2 text-[13px] font-semibold text-tentacle-text-primary">{person.name}</span>
            {person.knownForDepartment && (
              <span className="text-xs text-tentacle-text-tertiary">{t(`seer:dept_${person.knownForDepartment}`, person.knownForDepartment)}</span>
            )}
          </button>
        );
      })}
    </Rail>
  );
});
