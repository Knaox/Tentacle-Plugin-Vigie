/* ------------------------------------------------------------------ */
/*  Host theme — tokens Tentacle garantis sur toutes les plateformes.  */
/*                                                                     */
/*  Le wrapper iframe du host WEB injecte tokens.css + une config      */
/*  Tailwind complète. Le template WebView MOBILE récent injecte le    */
/*  vocabulaire sémantique dérivé du thème actif ; les anciens         */
/*  templates ne fournissent que les alias historiques. On répare      */
/*  côté plugin :                                                      */
/*    1. détection du schéma host (host-scheme.ts) ;                   */
/*    2. injection du fallback CLAIR ou SOMBRE si les variables        */
/*       manquent (host-theme-fallback.ts) ;                           */
/*    3. injection des tokens « posé sur média » et des statuts Seer   */
/*       (--seer-st-*) du schéma courant ;                             */
/*    4. fusion NON destructive de la config Tailwind runtime (une     */
/*       clé fournie par le host n'est jamais écrasée).                */
/* ------------------------------------------------------------------ */

import { detectHostScheme, watchHostScheme } from "./host-scheme";
import type { HostScheme } from "./host-scheme";
import { buildFallbackTokensCss, buildSeerStatusCss, SEER_CONST_CSS } from "./host-theme-fallback";
import { buildStateCss } from "./state-tokens";

/* Même mapping sémantique que buildPluginTheme.ts (host web ≥ 1.7.1). */
const TENTACLE_COLORS: Record<string, string> = {
  "surface-0": "var(--surface-0)", "surface-1": "var(--surface-1)",
  "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
  "surface-modal": "var(--surface-modal)", "surface-dropdown": "var(--surface-dropdown)",
  "surface-toolbar": "var(--surface-toolbar)",
  brand: "var(--brand)", "brand-light": "var(--brand-light)",
  "brand-dark": "var(--brand-dark)", "brand-accent": "var(--brand-accent)",
  "brand-soft": "var(--brand-soft)",
  "text-primary": "var(--text-primary)", "text-secondary": "var(--text-secondary)",
  "text-tertiary": "var(--text-tertiary)", "text-quaternary": "var(--text-quaternary)",
  "text-disabled": "var(--text-disabled)",
  "cta-primary": "var(--cta-primary-bg)", "cta-primary-fg": "var(--cta-primary-fg)",
  "cta-secondary": "var(--cta-secondary-bg)", "cta-secondary-fg": "var(--cta-secondary-fg)",
  "cta-ghost": "var(--cta-ghost-bg)", "cta-brand-fg": "var(--cta-brand-fg)",
  "border-subtle": "var(--border-subtle)", "border-strong": "var(--border-strong)",
  "border-focus": "var(--border-focus)",
  "status-success": "var(--status-success)", "status-success-bg": "var(--status-success-bg)",
  "status-success-fg": "var(--status-success-fg)",
  "status-warning": "var(--status-warning)", "status-warning-bg": "var(--status-warning-bg)",
  "status-warning-fg": "var(--status-warning-fg)",
  "status-error": "var(--status-error)", "status-error-bg": "var(--status-error-bg)",
  "status-error-fg": "var(--status-error-fg)",
  "status-info": "var(--status-info)", "status-info-bg": "var(--status-info-bg)",
  "status-info-fg": "var(--status-info-fg)",
  "fill-faint": "var(--fill-faint)", "fill-subtle": "var(--fill-subtle)",
  "fill-soft": "var(--fill-soft)", "fill-medium": "var(--fill-medium)",
  "fill-strong": "var(--fill-strong)", "fill-shimmer": "var(--fill-shimmer)",
  "on-media-primary": "var(--on-media-primary)", "on-media-secondary": "var(--on-media-secondary)",
  "on-media-muted": "var(--on-media-muted)",
};

function hasCssVar(name: string): boolean {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() !== "";
  } catch {
    return false;
  }
}

/** Crée ou met à jour un bloc <style> identifié. `prepend` : le host gagne s'il injecte après. */
function upsertStyle(id: string, css: string, position: "prepend" | "append"): void {
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    if (position === "prepend") document.head.prepend(style);
    else document.head.append(style);
  }
  style.textContent = css;
}

/** Injecte les CSS variables du thème si le host ne les fournit pas. */
function ensureCssVariables(scheme: HostScheme): void {
  if (hasCssVar("--surface-1") && !document.getElementById("seer-theme-fallback")) return;
  upsertStyle("seer-theme-fallback", buildFallbackTokensCss(scheme), "prepend");
}

/** Tokens « posé sur média » — absents des hosts < 1.7.1 et du mobile. */
function ensureOnMediaTokens(): void {
  if (hasCssVar("--on-media-primary") && !document.getElementById("seer-onmedia-fallback")) return;
  upsertStyle("seer-onmedia-fallback", SEER_CONST_CSS, "prepend");
}

/** Statuts Seer et états d'un titre — toujours injectés (vocabulaire propre au plugin). */
function ensureStatusTokens(scheme: HostScheme): void {
  upsertStyle("seer-status-tokens", buildSeerStatusCss(scheme) + buildStateCss(scheme), "append");
}

/** Complète la config Tailwind runtime (Play CDN) SANS écraser les clés du host. */
function ensureTailwindConfig(): void {
  const tw = (window as unknown as Record<string, unknown>).tailwind as
    | { config?: Record<string, any> }
    | undefined;
  if (!tw) return; // pas de Tailwind runtime → rien à faire

  const config = (tw.config ??= {});
  const theme = (config.theme ??= {});
  const extend = (theme.extend ??= {});
  const colors = (extend.colors ??= {});
  const tentacle = (colors.tentacle ??= {});

  // Fusion non destructive clé par clé : sur un host complet (web ≥ 1.7.1)
  // tout existe déjà ; sur un host partiel (web 1.7.0, mobile) on ne comble
  // que les manques (fill-*, brand-soft, on-media-*, cta-brand-fg…).
  for (const [key, value] of Object.entries(TENTACLE_COLORS)) {
    if (!(key in tentacle)) tentacle[key] = value;
  }
  extend.borderRadius = {
    "tentacle-xs": "var(--radius-xs)", "tentacle-sm": "var(--radius-sm)",
    "tentacle-md": "var(--radius-md)", "tentacle-lg": "var(--radius-lg)",
    "tentacle-xl": "var(--radius-xl)", "tentacle-pill": "var(--radius-pill)",
    ...(extend.borderRadius ?? {}),
  };
  extend.boxShadow = {
    "tentacle-elev-1": "var(--elev-1)", "tentacle-elev-2": "var(--elev-2)",
    "tentacle-elev-3": "var(--elev-3)", "tentacle-modal": "var(--shadow-modal)",
    "tentacle-dropdown": "var(--shadow-dropdown)", "tentacle-sheet": "var(--shadow-sheet)",
    ...(extend.boxShadow ?? {}),
  };
  extend.backdropBlur = {
    "tentacle-overlay": "var(--blur-overlay)", "tentacle-modal": "var(--blur-modal)",
    "tentacle-dropdown": "var(--blur-dropdown)", "tentacle-sheet": "var(--blur-sheet)",
    ...(extend.backdropBlur ?? {}),
  };
  extend.transitionTimingFunction = {
    "tentacle-out": "var(--ease-out)", "tentacle-in-out": "var(--ease-in-out)",
    "tentacle-spring": "var(--ease-spring)",
    ...(extend.transitionTimingFunction ?? {}),
  };
  extend.transitionDuration = {
    "tentacle-instant": "var(--duration-instant)", "tentacle-fast": "var(--duration-fast)",
    "tentacle-base": "var(--duration-base)", "tentacle-slow": "var(--duration-slow)",
    ...(extend.transitionDuration ?? {}),
  };
  // Réassignation : le Play CDN relit la config au prochain rebuild
  // (déclenché par la première mutation DOM du render React).
  tw.config = config;
}

/**
 * À appeler avant le premier render du plugin. Idempotent, no-op quand le
 * host fournit déjà le thème complet (iframe web). Suit une bascule de
 * schéma à chaud via `data-theme` (les blocs injectés sont mis à jour).
 */
export function ensureHostTheme(): void {
  try {
    const scheme = detectHostScheme();
    ensureCssVariables(scheme);
    ensureOnMediaTokens();
    ensureStatusTokens(scheme);
    ensureTailwindConfig();
    watchHostScheme((next) => {
      try {
        if (document.getElementById("seer-theme-fallback")) {
          upsertStyle("seer-theme-fallback", buildFallbackTokensCss(next), "prepend");
        }
        ensureStatusTokens(next);
      } catch {
        /* jamais bloquant */
      }
    });
  } catch {
    /* jamais bloquant pour le render */
  }
}
