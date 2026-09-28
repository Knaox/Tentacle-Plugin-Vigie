/* ------------------------------------------------------------------ */
/*  Vigie — La saga d'un film, sur sa fiche                            */
/* ------------------------------------------------------------------ */

/*
 * Twilight, Harry Potter, Dune : un film se regarde rarement seul. La fiche
 * montre toute sa saga, dans l'ordre de sortie, chaque volet avec son état
 * (le bandeau de la carte : demandé, en route, disponible…) et ce que le
 * compte en a fait (vu, aimé…). Le titre de la section dit combien de volets
 * sont déjà là. Le volet de la fiche courante est cerclé, et n'ouvre rien ;
 * un autre volet REMPLACE la fiche (cf. MediaDetailModal).
 */

import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../../api/types";
import { useMediaCollection } from "../../hooks/useMediaCollection";
import { partsHere } from "../../utils/collection";
import { HubContext } from "../../hub/HubContext";
import { Rail } from "../ui/Rail";
import { PosterCard } from "../ui/PosterCard";
import { LayersIcon } from "../ui/icons";

interface Props {
  collectionId: number;
  currentId: number;
  onSelect: (item: SeerrSearchResult) => void;
}

export const CollectionRail = memo(function CollectionRail({ collectionId, currentId, onSelect }: Props) {
  const { t } = useTranslation("seer");
  const hub = useContext(HubContext);
  const { data } = useMediaCollection(collectionId);
  // Une « saga » d'un seul film n'apprend rien : pas de section.
  if (!data || data.parts.length < 2) return null;
  const count = data.parts.length;
  const here = partsHere(data.parts);
  const subtitle = [
    t("seer:collectionSubtitle", { count }),
    here > 0 ? t("seer:collectionHere", { here, count }) : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="mt-10">
      <Rail title={data.name} subtitle={subtitle} icon={<LayersIcon className="h-5 w-5" />}>
        {data.parts.map((item) => {
          const current = item.id === currentId;
          return (
            <div
              key={item.id}
              aria-current={current ? "page" : undefined}
              className={current ? "rounded-xl ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-2 ring-offset-[var(--surface-modal)]" : undefined}
            >
              <PosterCard
                item={item}
                onOpen={current ? noop : onSelect}
                onQuickRequest={current ? undefined : hub?.quickRequest}
                caption={current ? t("seer:collectionCurrent") : undefined}
              />
            </div>
          );
        })}
      </Rail>
    </div>
  );
});

function noop(): void {}
