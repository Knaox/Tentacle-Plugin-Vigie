/* ------------------------------------------------------------------ */
/*  Vigie — La feuille de la mini-carte d'aperçu                       */
/* ------------------------------------------------------------------ */

/*
 * Le JUMEAU des feuilles de la mini-carte du cœur (`cardPreview.css`,
 * `previewSurface.css`, `previewPanel.css`, `previewActions.css`) : un
 * bandeau GRAPHITE NEUTRE « à la Apple », dans les deux thèmes — la marque
 * n'y paraît qu'en touches (« Demander » au dégradé, l'anneau de focus).
 * Tout s'échelonne en unités de conteneur, de 300 à 560 px de large.
 * N'anime que `transform` et `opacity` ; posée une fois, au premier aperçu.
 */

import { PREVIEW_MOTION as M } from "./timing";

const EASE_OUT = "cubic-bezier(0.22,1,0.36,1)";
const EXIT_EASE = "cubic-bezier(0.4,0,1,1)";

const CSS = `
.vgp{position:fixed;z-index:60;border-radius:12px;opacity:0;transform:var(--vgp-from);transform-origin:50% 50%;
  pointer-events:none;cursor:pointer;transition:transform ${M.exitMs}ms ${EXIT_EASE},opacity ${M.exitMs}ms ${EXIT_EASE}}
.vgp[data-shown=true]{opacity:1;transform:none;pointer-events:auto;
  transition:transform ${M.enterMs}ms ${EASE_OUT},opacity ${M.enterFadeMs}ms linear}
.vgp-surface{position:absolute;inset:0;overflow:hidden;border-radius:inherit;container:vgp / inline-size;
  background:linear-gradient(180deg,rgb(255 255 255/.04) var(--vgp-video-h),rgb(255 255 255/0) 100%),
    linear-gradient(180deg,#141416 var(--vgp-video-h),#0e0e10 100%);
  box-shadow:0 32px 64px -24px rgba(0,0,0,.9),0 0 0 1px rgb(255 255 255/.06)}
.vgp-surface::after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 0 rgb(255 255 255/.08),inset 0 0 0 1px rgb(255 255 255/.04)}
:root[data-theme=light] .vgp-surface{box-shadow:0 26px 52px -18px rgba(11,11,16,.45),0 8px 18px -8px rgba(11,11,16,.28),0 0 0 1px rgba(11,11,16,.08)}
.vgp-stage{position:absolute;inset:0 0 auto 0;height:var(--vgp-video-h);overflow:hidden;
  --vgp-mute:clamp(28px,8.2cqi,38px);--vgp-edge:clamp(8px,2.6cqi,14px)}
.vgp-still,.vgp-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.vgp-video{transform:scale(var(--vgp-crop,1));transition:opacity 360ms ${EASE_OUT}}
.vgp-video[data-waiting=true]{opacity:0;transition:none}
.vgp-veil{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(0deg,#1d1d1f 0%,rgb(29 29 31/.5) 7%,rgb(29 29 31/0) 17%)}
.vgp-sound{position:absolute;top:var(--vgp-edge);right:var(--vgp-edge);z-index:2;display:flex;align-items:center;
  gap:calc(var(--vgp-mute)*.25)}
.vgp-volume{width:calc(var(--vgp-mute)*2.6);height:calc(var(--vgp-mute)*.5);margin:0;cursor:pointer;
  accent-color:var(--brand-light,#c084fc);opacity:0;transform:scaleX(.6);transform-origin:right center;pointer-events:none;
  transition:opacity 140ms ${EASE_OUT},transform 160ms ${EASE_OUT}}
.vgp-sound:hover .vgp-volume,.vgp-sound:focus-within .vgp-volume{opacity:1;transform:none;pointer-events:auto}
.vgp-mute{position:relative;z-index:2;display:flex;align-items:center;
  justify-content:center;width:var(--vgp-mute);aspect-ratio:1;border-radius:9999px;border:0;
  background-color:rgb(28 28 30/.6);color:#fff;transition:transform 150ms ${EASE_OUT}}
.vgp-mute svg{width:46%;height:46%}
.vgp-mute:hover{background-color:rgb(44 44 48/.78);transform:scale(1.05)}
.vgp-mute:active{transform:scale(.95)}
.vgp-panel{position:absolute;inset-inline:0;bottom:0;top:var(--vgp-video-h);display:flex;flex-wrap:wrap;
  align-content:flex-start;align-items:center;justify-content:space-between;color:#fff;
  --vgp-pad-x:clamp(12px,4.4cqi,22px);--vgp-pad-top:clamp(10px,3.2cqi,17px);--vgp-btn:clamp(28px,8.4cqi,40px);
  --vgp-btn-primary:clamp(32px,9.4cqi,44px);--vgp-gap:clamp(6px,2.1cqi,10px);--vgp-icon:clamp(14px,4.1cqi,19px);
  --vgp-title:clamp(14px,4.2cqi,19px);--vgp-text:clamp(12px,calc(1.25cqi + 7.5px),14.5px);
  row-gap:clamp(3px,1.2cqi,6px);padding:var(--vgp-pad-top) var(--vgp-pad-x) 0;
  opacity:0;transform:translateY(6px);transition:opacity 110ms linear,transform 110ms linear}
.vgp[data-shown=true] .vgp-panel{opacity:1;transform:none;
  transition:opacity 220ms ${EASE_OUT} ${M.contentDelayMs}ms,transform 280ms ${EASE_OUT} ${M.contentDelayMs}ms}
.vgp-tray{flex:0 0 100%;display:flex;align-items:center;gap:var(--vgp-gap);min-height:var(--vgp-btn-primary);
  margin-bottom:clamp(5px,2.2cqi,10px)}
.vgp-btn{flex:none;display:flex;align-items:center;justify-content:center;width:var(--vgp-btn);aspect-ratio:1;
  border:0;border-radius:9999px;background-color:rgb(255 255 255/.13);color:rgb(255 255 255/.95);
  transition:transform 150ms ${EASE_OUT}}
.vgp-btn svg{width:var(--vgp-icon);height:var(--vgp-icon)}
.vgp-btn:hover{background-color:rgb(255 255 255/.2);transform:scale(1.05)}
.vgp-btn:active{transform:scale(.95)}
.vgp-btn[aria-pressed=true]{background-color:rgb(255 255 255/.22)}
.vgp-btn[data-tone=liked]{color:var(--brand-accent)}
.vgp-btn[data-primary]{width:var(--vgp-btn-primary);background-color:#fff;color:#0b0b0d}
.vgp-btn[data-primary]:hover{background-color:rgb(255 255 255/.86)}
.vgp-btn[data-primary=brand]{background-image:linear-gradient(135deg,var(--brand) 0%,var(--brand-accent) 100%);color:#fff}
.vgp-btn[data-primary=quiet] svg{transform:translateX(6%)}
.vgp-btn[data-extra=details]{margin-inline-start:auto}
.vgp-btn:focus-visible,.vgp-mute:focus-visible{outline:2px solid var(--brand-light);outline-offset:2px}
.vgp-title{flex:0 1 auto;min-width:0;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
  font-size:var(--vgp-title);line-height:1.25;font-weight:650;letter-spacing:-.012em;color:rgb(255 255 255/.92)}
.vgp-stars{flex:none;display:flex;align-items:center;margin-inline-start:clamp(10px,3cqi,16px)}
.vgp-line{flex:0 0 100%;min-width:0;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
  font-size:var(--vgp-text);line-height:1.38;font-weight:500;color:rgb(255 255 255/.92);font-variant-numeric:tabular-nums}
.vgp-line[data-line=first]{margin-top:clamp(2px,1cqi,5px)}
.vgp-line[data-line=last]{color:rgb(255 255 255/.6);font-weight:450}
.vgp-dot{display:inline-block;vertical-align:middle;width:3.5px;height:3.5px;margin:0 .55em;border-radius:9999px;background:rgb(255 255 255/.45)}
.vgp-star{color:var(--brand-light)}
[data-vgp-concealed=true]{opacity:0;transition:opacity ${M.enterFadeMs}ms linear}
[data-vgp-shift]{transition:transform ${M.enterMs}ms ${EASE_OUT}}
@media (prefers-reduced-motion:reduce){.vgp,.vgp[data-shown=true]{transform:none!important;
  transition:opacity ${M.reducedMs}ms linear!important}[data-vgp-shift]{transition:none}}
`;

let injected = false;

export function injectPreviewStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.setAttribute("data-vigie", "preview");
  style.textContent = CSS;
  document.head.appendChild(style);
}
