/* ------------------------------------------------------------------ */
/*  Vigie — La fiche d'une personne                                    */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'on cherche en tapant un nom : « qu'est-ce qu'il a fait que je n'ai pas
 * encore ? ». La filmographie entière, les plus connues d'abord, chaque
 * affiche disant si le titre est déjà là ou demandé — et un clic pour le
 * demander.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "../components/ui/Sheet";
import { PosterCard, PosterCardSkeleton } from "../components/ui/PosterCard";
import { UserIcon } from "../components/ui/icons";
import { segment, SEGMENT_GROUP } from "../styles/pills";
import { profileUrl } from "../utils/media-helpers";
import { useHub } from "../hub/HubContext";
import { filmography, usePerson } from "./usePerson";

type Kind = "all" | "movie" | "tv";

export function PersonSheet({ personId, onClose }: { personId: number; onClose: () => void }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const { detail, credits } = usePerson(personId);
  const [kind, setKind] = useState<Kind>("all");
  const [bioOpen, setBioOpen] = useState(false);
  const person = detail.data;
  const works = useMemo(() => filmography(credits.data, person?.knownForDepartment), [credits.data, person?.knownForDepartment]);
  const shown = kind === "all" ? works : works.filter((w) => w.mediaType === kind);
  const photo = profileUrl(person?.profilePath, "w342");

  return (
    <Sheet open onClose={onClose} title={person?.name ?? ""} size="lg">
      <div className="flex gap-4 sm:gap-6">
        <span className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle sm:h-40 sm:w-28">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-10 w-10 text-tentacle-text-disabled" />}
        </span>
        <div className="min-w-0 flex-1">
          {person?.knownForDepartment && (
            <p className="text-sm font-semibold text-[var(--brand-light)]">{t(`seer:dept_${person.knownForDepartment}`, person.knownForDepartment)}</p>
          )}
          {person?.placeOfBirth && <p className="mt-0.5 text-xs text-tentacle-text-tertiary">{person.placeOfBirth}</p>}
          {person?.biography ? (
            <>
              <p className={`mt-2 text-sm leading-relaxed text-tentacle-text-secondary ${bioOpen ? "" : "line-clamp-4"}`}>{person.biography}</p>
              {person.biography.length > 280 && (
                <button type="button" onClick={() => setBioOpen((v) => !v)} className="mt-1 min-h-[32px] text-xs font-semibold text-[var(--brand-light)]">
                  {bioOpen ? t("seer:showLess") : t("seer:showMore")}
                </button>
              )}
            </>
          ) : detail.isPending ? (
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-3 w-11/12 rounded bg-tentacle-fill-subtle" />
              <div className="h-3 w-4/5 rounded bg-tentacle-fill-subtle" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-tentacle-text-primary">
          {t("seer:filmography")} <span className="text-sm font-semibold text-tentacle-text-quaternary">{works.length || ""}</span>
        </h3>
        <div className={SEGMENT_GROUP} role="tablist">
          {(["all", "movie", "tv"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`${segment(kind === k)} min-h-[32px]`}>
              {k === "all" ? t("seer:filterAllType") : k === "movie" ? t("seer:filterMovies") : t("seer:filterSeries")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
        {credits.isPending
          ? Array.from({ length: 10 }, (_, i) => <PosterCardSkeleton key={i} />)
          : shown.map((item) => (
            <PosterCard key={`${item.mediaType}:${item.id}`} item={item} onOpen={hub.openMedia} onQuickRequest={hub.quickRequest} />
          ))}
      </div>
    </Sheet>
  );
}
