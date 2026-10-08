/* ------------------------------------------------------------------ */
/*  Vigie — environnement fourni par l'application hôte               */
/* ------------------------------------------------------------------ */

interface HostEnv {
  tauri?: boolean;
  desktop?: boolean;
  mac?: boolean;
  prod?: boolean;
  backendUrl?: string;
}

function hostEnv(): HostEnv {
  const w = window as unknown as Record<string, unknown>;
  return (w.__tentacle_env as HostEnv | undefined) ?? {};
}

/**
 * Tentacle TV nous dit déjà si on tourne sur un Mac : la page du plugin vit
 * dans un cadre isolé, sans accès à la fenêtre parente, mais l'hôte lui
 * transmet cette information au montage.
 */
export function isMac(): boolean {
  const env = hostEnv();
  if (typeof env.mac === "boolean") return env.mac;
  // Repli si l'hôte est plus ancien que cette information.
  return typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);
}

/**
 * `⌘K` sur Mac, `Ctrl+K` ailleurs. L'étiquette affichait « Ctrl+K » pour tout
 * le monde alors que le raccourci qui fonctionne sur Mac est ⌘K.
 */
export function searchShortcutLabel(): string {
  return isMac() ? "⌘K" : "Ctrl+K";
}

/** Un écran tactile n'a pas de raccourci clavier à annoncer. */
export function showsKeyboardHints(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints === 0 && !/Mobi|Android/i.test(navigator.userAgent);
}
