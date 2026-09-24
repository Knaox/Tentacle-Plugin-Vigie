import { useTranslation } from "react-i18next";
import { useProfiles } from "../hooks/useProfiles";
import type { SeerProfile, MediaType } from "../api/types";

interface ProfileSelectorProps {
  mediaType?: MediaType;
  isAnime?: boolean;
  showAll?: boolean;
  selectedId: string | null;
  onChange: (profileId: string | null) => void;
}

/** Les profils de qualité qui valent pour ce titre (film, série, animé). */
export function profilesFor(all: readonly SeerProfile[], mediaType?: MediaType, isAnime?: boolean): SeerProfile[] {
  return all.filter((p) => {
    const target = p.targetMediaType ?? "all";
    if (!mediaType) return true;
    if (mediaType === "movie") return target === "all" || target === "movie";
    if (isAnime) return target === "all" || target === "tv" || target === "anime";
    return target === "all" || target === "tv";
  });
}

export function ProfileSelector({ mediaType, isAnime, showAll, selectedId, onChange }: ProfileSelectorProps) {
  const { t } = useTranslation("seer");
  const { data } = useProfiles();
  const allProfiles = data?.profiles ?? [];

  const profiles = showAll ? allProfiles : profilesFor(allProfiles, mediaType, isAnime);

  if (profiles.length === 0) return null;

  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
        {t("seer:profileLabel")}
      </label>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile: SeerProfile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onChange(selectedId === profile.id ? null : profile.id)}
            aria-pressed={selectedId === profile.id}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors sm:min-h-[32px] sm:px-3 sm:text-xs ${
              selectedId === profile.id
                ? "border-tentacle-brand bg-[rgba(var(--brand-rgb),0.2)] text-tentacle-text-primary"
                : "border-tentacle-border-subtle bg-tentacle-fill-subtle text-tentacle-text-tertiary hover:border-tentacle-border-strong hover:bg-tentacle-fill-medium"
            }`}
          >
            {profile.name}
            {profile.isDefault && (
              <span className="ml-1 text-[11px] text-tentacle-brand-light sm:text-[10px]">({t("seer:profileDefault")})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
