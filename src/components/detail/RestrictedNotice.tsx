/* ------------------------------------------------------------------ */
/*  Vigie — « Non disponible pour ce profil »                           */
/* ------------------------------------------------------------------ */

/*
 * Ce que montre une fiche que le contrôle parental refuse au profil (un lien
 * direct, une carte restée en mémoire) : ni l'affiche, ni le résumé, ni
 * erreur — une phrase calme, et la sortie. Le titre n'est pas nommé.
 */

import { useTranslation } from "react-i18next";
import { EyeOffIcon } from "../ui/icons";
import { CTA_SECONDARY, CTA_SIZE_LG } from "../../styles/cta";

export function RestrictedNotice({ onClose, compact = false }: { onClose?: () => void; compact?: boolean }) {
  const { t } = useTranslation("seer");
  return (
    <div role="status" className={`flex flex-col items-center text-center ${compact ? "gap-2 py-6" : "gap-3 px-6 py-16 sm:py-20"}`}>
      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-tentacle-fill-subtle text-tentacle-text-tertiary ring-1 ring-tentacle-border-subtle">
        <EyeOffIcon className="h-6 w-6" />
      </span>
      {/* Dans une feuille, son en-tête le dit déjà. */}
      {!compact && <p className="text-base font-semibold text-tentacle-text-primary">{t("seer:restrictedTitle")}</p>}
      <p className="max-w-sm text-sm text-tentacle-text-tertiary">{t("seer:restrictedTitleHint")}</p>
      {onClose && (
        <button type="button" onClick={onClose} className={`${CTA_SECONDARY} ${CTA_SIZE_LG} mt-2`}>
          {t("seer:close")}
        </button>
      )}
    </div>
  );
}
