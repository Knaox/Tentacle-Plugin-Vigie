/* ------------------------------------------------------------------ */
/*  Seer API — proxy helper + config management                       */
/* ------------------------------------------------------------------ */

import { getCurrentLanguage } from "../utils/media-helpers";

let _backendBase = "";
let _isConfigured = false;

export function setSeerBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export function getSeerBackendUrl(): string {
  return _backendBase;
}

/**
 * Base ABSOLUE d'une ressource que le navigateur charge lui-même (une image),
 * sans passer par le pont `fetch` de l'hôte.
 *
 * Sur le web, l'hôte est à la même origine : sa base est vide, et il sert
 * l'iframe en `srcdoc` sandboxé — un document SANS base, où « /api/… » ne se
 * résout pas (la photo des comptes ne s'affichait pas). L'origine de la page
 * hôte est alors la première de `ancestorOrigins` (Chromium, WebKit) ; faute
 * de mieux, le référent. Vide si rien ne la donne : l'appelant se replie.
 */
export function getAssetBaseUrl(): string {
  if (_backendBase) return _backendBase;
  const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  const parent = ancestors && ancestors.length > 0 ? ancestors[0] : "";
  if (parent && parent !== "null") return parent;
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

export function setConfigured(value: boolean) {
  _isConfigured = value;
}

export function isConfigured(): boolean {
  return _isConfigured;
}

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

/**
 * Transparent streaming proxy to Seerr.
 * GET /api/plugins/seer/seerr/api/v1/... → backend streams Seerr response directly.
 * API key is injected server-side (never exposed to frontend).
 * Accept-Language is passed via _lang query param.
 */
export async function proxyFetch<T>(
  seerrPath: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  if (!_isConfigured) {
    throw new Error("Seer not configured");
  }
  const lang = getCurrentLanguage();
  const sep = seerrPath.includes("?") ? "&" : "?";
  const url = `${_backendBase}/api/plugins/seer/seerr${seerrPath}${sep}_lang=${lang}`;

  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Seerr API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Direct call to the Tentacle plugin config endpoint (not proxied to Seerr) */
export function configUrl(): string {
  return `${_backendBase}/api/plugins/seer/config`;
}
