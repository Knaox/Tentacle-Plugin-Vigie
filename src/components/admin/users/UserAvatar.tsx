/* ------------------------------------------------------------------ */
/*  Vigie — La photo d'un compte, ou son initiale                       */
/* ------------------------------------------------------------------ */

/*
 * La liste des comptes n'avait ni photo ni repère visuel : on cherchait un
 * nom dans une colonne de texte. La photo vient de Jellyfin, par le relais du
 * serveur Tentacle ; son étiquette (`imageTag`) sert de clé de cache — une
 * photo changée se voit tout de suite. Sans photo, ou si elle ne vient pas,
 * l'initiale sur le dégradé de la marque.
 */

import { useState } from "react";
import { getAssetBaseUrl } from "../../../api/endpoints";

export function UserAvatar({ userId, name, imageTag, size = 40 }: {
  userId: string;
  name: string;
  imageTag: string | null | undefined;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = (Array.from(name.trim())[0] ?? "?").toUpperCase();
  const base = getAssetBaseUrl();
  const src = imageTag && base && failed !== imageTag
    ? `${base}/api/jellyfin/Users/${encodeURIComponent(userId)}/Images/Primary`
      + `?tag=${encodeURIComponent(imageTag)}&maxWidth=${size * 2}&quality=90`
    : null;
  const box = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(imageTag ?? null)}
        style={box}
        className="shrink-0 rounded-full bg-tentacle-fill-soft object-cover ring-1 ring-tentacle-border-subtle"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...box, background: "linear-gradient(135deg, var(--brand-dark), var(--brand))", fontSize: Math.round(size * 0.42) }}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-tentacle-on-media-primary"
    >
      {initial}
    </span>
  );
}
