import { useTranslation } from "react-i18next";
import { EyeIcon, EyeOffIcon } from "./ui/icons";

interface BlockedResultsBannerProps {
  /** Nombre d'éléments masqués par le filtre de contenu. */
  blockedCount?: number;
  /** True quand l'utilisateur a choisi d'afficher le contenu masqué. */
  showBlocked: boolean;
  onToggle: () => void;
}

/**
 * « N résultats masqués · Afficher quand même », en une ligne.
 *
 * Une mention, pas un bandeau : posée en tête des résultats, elle passait
 * avant le meilleur résultat et se lisait comme une erreur. Elle vient donc
 * après ce qu'on cherchait. Le bouton garde une cible tactile de 44 px.
 */
export function BlockedResultsBanner({ blockedCount = 0, showBlocked, onToggle }: BlockedResultsBannerProps) {
  const { t } = useTranslation("seer");

  const label = showBlocked
    ? t("blockedShown")
    : blockedCount > 0
      ? t("blockedHidden", { count: blockedCount })
      : t("blockedFilterActive");

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2 text-xs text-tentacle-text-quaternary">
      <EyeOffIcon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={showBlocked}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 font-semibold text-tentacle-text-secondary transition-colors hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
      >
        {showBlocked ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        {showBlocked ? t("blockedHideAgain") : t("blockedShowAnyway")}
      </button>
    </div>
  );
}
