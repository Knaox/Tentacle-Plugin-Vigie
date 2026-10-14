/* ------------------------------------------------------------------ */
/*  Vigie — Un portail React sans react-dom                            */
/* ------------------------------------------------------------------ */

/*
 * La page de Vigie reçoit React des dépendances partagées de Tentacle
 * (`TentacleShared`) : React et `react-dom/client`, pas `react-dom` — donc
 * pas `createPortal`. Empaqueter react-dom dans Vigie en ferait une seconde
 * copie. Un portail n'est pourtant qu'un OBJET que le moteur de rendu
 * reconnaît à son `$$typeof` (`Symbol.for("react.portal")`, registre global
 * des symboles) : exactement ce que `createPortal` rend, en React 18 comme
 * en 19 (react-dom.production.js, `createPortal$1`). La mini-carte en a
 * besoin : rendue dans `document.body`, aucune rangée ne la rogne et aucune
 * ligne transformée de la grille virtuelle ne la déplace.
 */

import type { ReactNode, ReactPortal } from "react";

const REACT_PORTAL_TYPE = Symbol.for("react.portal");

export function portal(children: ReactNode, container: Element): ReactPortal {
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: null,
    children,
    containerInfo: container,
    implementation: null,
  } as unknown as ReactPortal;
}
