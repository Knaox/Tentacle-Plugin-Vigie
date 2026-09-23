/* ------------------------------------------------------------------ */
/*  Vigie — traductions françaises                                     */
/* ------------------------------------------------------------------ */

/*
 * Scindé par domaine : le fichier unique dépassait largement la limite de
 * 300 lignes du projet, et l'ajout du calendrier l'aurait fait doubler.
 * L'agrégat reste plat — les clés sont inchangées côté composants.
 */

import common from "./fr/common";
import catalog from "./fr/catalog";
import requests from "./fr/requests";
import releases from "./fr/releases";
import admin from "./fr/admin";
import hub from "./fr/hub";
import states from "./fr/states";

export default {
  ...common,
  ...catalog,
  ...requests,
  ...releases,
  ...admin,
  ...hub,
  ...states,
} as const;
