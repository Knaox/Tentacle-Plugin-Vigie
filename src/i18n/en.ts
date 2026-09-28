/* ------------------------------------------------------------------ */
/*  Vigie — English translations                                       */
/* ------------------------------------------------------------------ */

/*
 * Split by domain: the single file was well past the project's 300-line limit,
 * and the releases calendar would have doubled it. The aggregate stays flat —
 * component-side keys are unchanged.
 */

import common from "./en/common";
import catalog from "./en/catalog";
import requests from "./en/requests";
import releases from "./en/releases";
import admin from "./en/admin";
import adminPage from "./en/admin-page";
import hub from "./en/hub";
import states from "./en/states";
import marks from "./en/marks";
import gestures from "./en/gestures";

export default {
  ...common,
  ...catalog,
  ...requests,
  ...releases,
  ...admin,
  ...adminPage,
  ...hub,
  ...states,
  ...marks,
  ...gestures,
} as const;
