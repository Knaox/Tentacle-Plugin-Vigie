/* ------------------------------------------------------------------ */
/*  Vigie — Le pays d'une langue d'interface                           */
/* ------------------------------------------------------------------ */

/*
 * Une langue n'est pas un pays. Le calendrier, les dates de sortie et les
 * plateformes envoyaient la langue en majuscules comme région : « EN » n'en
 * est pas une pour TMDB — mesuré sur Jellyseerr, `watchRegion=EN` rend zéro
 * plateforme et zéro série (US : 276 plateformes). En anglais, le calendrier
 * par plateforme était vide et les verdicts de sortie sans date.
 */

const REGION_BY_LANGUAGE: Record<string, string> = {
  fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP",
};

/** Le pays retenu pour une langue d'interface (« en » → « US »). */
export function regionForLanguage(lang: string, fallback: string): string {
  return REGION_BY_LANGUAGE[lang.slice(0, 2).toLowerCase()] ?? fallback;
}
