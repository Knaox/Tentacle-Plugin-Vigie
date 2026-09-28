/**
 * Fetch authentifié vers le backend core Tentacle (PAS le proxy Seerr).
 *
 *  - Web/desktop : fetch relatif intercepté par le bridge iframe (auth auto).
 *  - Mobile (WebView) : URL backend complète + Bearer token (le chemin relatif
 *    ne fonctionne pas dans la WebView React Native).
 *
 * Retourne `null` en cas d'erreur réseau/HTTP — les consommateurs dégradent
 * proprement (ex : pas de trailers Jellyfin → TMDB seul).
 */
export function isMobileWebView(): boolean {
  return !!(window as any).ReactNativeWebView?.postMessage;
}

export async function tentacleApiFetch<T>(path: string): Promise<T | null> {
  try {
    if (isMobileWebView()) {
      const backendUrl = localStorage.getItem("tentacle_server_url") ?? "";
      const token = localStorage.getItem("tentacle_token") ?? "";
      if (!backendUrl || !token) return null;
      const res = await fetch(`${backendUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    }
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Écriture authentifiée vers le backend core Tentacle (note, Ma liste) : même
 * double chemin que `tentacleApiFetch`, mais qui LÈVE en cas d'échec — une
 * mutation doit pouvoir défaire son écriture optimiste.
 */
export async function tentacleApiSend<T>(path: string, method: "PUT" | "POST" | "DELETE", body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let url = path;
  if (isMobileWebView()) {
    const backendUrl = localStorage.getItem("tentacle_server_url") ?? "";
    const token = localStorage.getItem("tentacle_token") ?? "";
    if (!backendUrl || !token) throw new Error("Tentacle injoignable");
    url = `${backendUrl}${path}`;
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Navigue dans l'app hôte Tentacle (sidebar/bridge selon plateforme). */
export function tentacleNavigate(route: string): void {
  if (isMobileWebView()) {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "NAVIGATE", route }));
  } else if ((window as any).__tentacle_bridge?.navigate) {
    (window as any).__tentacle_bridge.navigate(route);
  } else {
    window.parent.postMessage({ type: "NAVIGATE", path: route }, "*");
  }
}
