# Vigie et le contrôle parental — le cœur décide, Vigie applique

> Chantier « droits » (2026-10-15). Le contrat fait foi dans le dépôt Tentacle-TV :
> `docs/DROITS-UTILISATEURS.md`, § 1 (principe) et § 5 (pont des extensions). Ce carnet
> dit comment Vigie l'applique, route par route.

## Le principe

- **Jellyfin est la source des droits, le cœur les traduit.** Vigie ne lit aucune note,
  aucune étiquette, aucune politique : il pose une seule question au cœur, par le pont
  `ctx.contentPolicy` (champ OPTIONNEL du contexte des extensions, Tentacle ≥ 1.30.0).
- **Un compte restreint ne voit aucun titre au-dessus de son âge**, par aucun chemin de
  Vigie : découverte, tendances, recherche, fiche, titres semblables, saga, filmographie,
  calendrier, « Mes demandes », contrat `titles` du cœur. **Et il ne peut pas en demander
  un** : refus serveur, à chaque demande.
- **Chemin court** : `isRestricted(userId)` faux ⇒ rien ne change, aucune requête de plus
  (ni au pont, ni à TMDB). Un compte non restreint garde les réponses d'avant à l'octet près.
- **Pont absent** (cœur d'avant 1.30.0) ⇒ comportement d'avant : le contrôle parental
  n'existait pas.
- **Pont qui lève ⇒ refus** (fermé à l'échec) : liste vide, fiche « non disponible pour ce
  profil », demande refusée. Jamais « libre faute de savoir ».
- **Invité de la Famille** : il demande à SON PROPRE NOM (le cœur pose son identité sur
  `request.user`) ; c'est donc SA politique qui compte, sans rien de plus côté Vigie.

Le tout passe par UN module, `server/policy/` : rien n'appelle le pont ailleurs.

## Le refus

Une demande d'un titre interdit répond **403** avec
`{ code: "restricted_title", errorKey: "seer:errRestrictedTitle", message }` (porte unique
`request-submit.ts`). Le contrat `titles` (cartes du cœur, TV) reçoit, lui, la phrase à
afficher (`ok: false`, « Ce titre n'est pas disponible pour ce profil. »). Une fiche
interdite répond **403** `{ code: "restricted_title" }` par le proxy : l'interface dit
« Non disponible pour ce profil », jamais une erreur.

## Relevé des routes (`/api/plugins/seer/…`)

Légende — **L** : liste filtrée (`filterExternalTitles`) ; **F** : fiche gardée
(`allowsExternalTitle`, 403 sinon) ; **D** : demande gardée ; **—** : rien à filtrer (ni
titre rendu, ni demande) ; **A** : administration, non filtrée (voir plus bas).

### Proxy du catalogue (`GET /seerr/api/v1/…`, `routes-proxy.ts`)

| Chemin Jellyseerr | Rend | Règle |
|---|---|---|
| `discover/movies`, `discover/tv` (+ sous-chemins) | pages de titres | **L**, pages REMPLIES (ci-dessous) |
| `discover/trending` | page de titres (+ personnes) | **L**, pages remplies ; personnes gardées |
| `search` | page de titres (+ personnes) | **L**, pages remplies ; personnes gardées |
| `movie/:id`, `tv/:id` | la fiche | **F** |
| `movie/:id/similar`, `tv/:id/similar` | page de titres | **L**, pages remplies |
| `tv/:id/season/:n` | les épisodes d'une saison | **F** sur la série |
| `person/:id` | la biographie | — |
| `person/:id/combined_credits` | `cast[]`, `crew[]` | **L** |
| `collection/:id` | `parts[]` (la saga) | **L** |

**Pages remplies.** Une page filtrée garderait ses trous (la grille du parcours
compte vingt cases par page). Pour un compte restreint, les pages d'un parcours
(même chemin, mêmes filtres, même langue) sont tirées D'UN FLUX : les pages de
Jellyseerr sont lues dans l'ordre, filtrées, et les titres permis découpés en
pages de vingt (`server/policy/dense-pages.ts`). Le total annoncé grandit avec le
flux (ce qui est lu, plus une page d'avance tant qu'il en reste) : l'ascenseur ne
promet jamais une page qu'on ne saurait pas remplir. Lecture bornée par requête ;
flux gardés en mémoire dix minutes, par compte, en nombre limité.

### Routes de Vigie

| Route | Rend / fait | Règle |
|---|---|---|
| `GET /search` | recherche du hub (`top`, `movies`, `series`, `people[].knownFor`) | **L** |
| `GET /search/provider` | contrat `search` du cœur (barre globale) | **L** |
| `GET /search/person` | contrat `search.person` (filmographie) | **L** |
| `GET /search/collection` | contrat `search.collection` (saga) | **L** |
| `GET /titles/state` | pastille et geste par titre (cartes du cœur, TV) | **L** : un titre interdit n'a ni pastille, ni geste, ni fiche |
| `POST /titles/request` | demande (film ; saisons d'une série) | **D** |
| `GET /titles/seasons` | saisons d'une série (feuille de la TV) | **F** : aucune saison |
| `GET /titles/gaps` | saisons manquantes des séries de la bibliothèque | **L** |
| `GET /titles/access` | le compte peut-il demander | — (droit du compte, pas d'un titre) |
| `GET /titles/mine` | titres que le compte attend (« Mes demandes » de la TV) | **L** |
| `POST /requests` | demande du hub | **D** |
| `POST /requests/:id/retry`, `POST /requests/bulk-retry` | renvoi d'une demande | **D** |
| `GET /requests` | « Mes demandes » | **L** |
| `GET /requests/progress` | avancement de mes demandes | **L** |
| `GET /requests/stats`, `/requests/lookup` | comptes, saisons demandées d'un titre | — (aucun titre rendu) |
| `GET /calendar/personal` | sorties de mes demandes (ou de tout le monde) | **L** |
| `GET /calendar/global` | sorties d'une plateforme | **L** |
| `GET /calendar/airtimes`, `/episodes/states` | heures et états des épisodes d'une série | **F** : réponse vide |
| `POST /availability`, `GET /series/gaps`, `GET /marks`, `POST /check-providers` | états et marques de titres DÉJÀ affichés | — (aucun titre rendu seul) |
| `DELETE /requests/:id`, `forget`, `mark`, `bulk-delete`, `retry-delete` | gestes sur ses demandes | — (rien ne s'obtient) |
| `GET /config`, `/profiles*`, `/queue/status`, `/stats`, `/sync/state`, `/vendor/*` | réglages, compteurs | — |
| `/admin/*`, `/downloads`, `PUT /config`, `/worker/trigger` | administration | **A** |
| *(aucune route)* notifications des demandes (arrivée, en route, bloquée, refusée, échec) | avis écrits chez le cœur | **L** : un avis d'un titre interdit au DESTINATAIRE n'est pas écrit (`policy/notification-gate.ts`, autour du client du cœur ; format inchangé) |

**Administration non filtrée** : les pages d'administration (toutes les demandes,
comptes, file) servent à GÉRER les demandes de tous ; un administrateur qui se serait
posé une note maximale les garde entières. Tout le reste de Vigie, administrateur
compris, applique sa politique.

## Le hub (iframe, WebView)

- **Aucun trou** : la grille du parcours et les rangées de l'accueil reçoivent des pages
  pleines ; la grille lit le total de la page la plus récente marquée `vigieDense`
  (`src/browse/useSparseCatalog.ts`) — un compte libre garde le total de la page 1, comme avant.
- **Aucune erreur** : une fiche ou une feuille de saisons refusée montre « Non disponible pour
  ce profil » (`RestrictedNotice`), sans affiche ni résumé, et ne se redemande pas
  (`utils/restricted.ts`). Une demande refusée dit la même chose (`seer:errRestrictedTitle`).
- Hors de Vigie : les bandes-annonces de la fiche passent par le cœur (`/api/tmdb/trailers`),
  qui les garde lui-même (chantier Filtrage).

## La preuve

- Tests : `server/policy/*.test.ts` (porte, pages pleines, relais, routes, recherche) et
  `src/utils/restricted.test.ts` — `npm test`.
- Banc de bout en bout (`scripts/banc-droits/`) : le VRAI cœur Tentacle d'une branche donnée,
  un Jellyfin 10.11 JETABLE (`droits-vigie-jf`, 18141), un faux Jellyseerr déterministe (18142,
  aucune sortie vers TMDB), Vigie installée depuis `server/index.mjs`. Lancement : voir l'en-tête
  de `banc.mts` (`REPO`, `VIGIE`, `RUN`, depuis `apps/backend` du dépôt Tentacle, par `npx tsx`).
  Le cœur réel lit les certifications dans son cache des fiches (`tmdb_meta_cache`) : le banc
  y sème des certifications françaises SIMULÉES (film n : « U » si n % 3 = 1, « 12 » si
  n % 3 = 2, « 18 » sinon) — aucun appel à TMDB. Relevé final du 2026-10-15, cœur
  `lot-droits/base` 3fc3e0084 (étape D, pont réel), compte `enfant` à la note max 10 :

  | Compte | Découverte p1 | p2 | Semblables | Fiche U / 12 | Saga (1 U, 2 « 12 ») | Demande U / 18 | Carte « 12 » |
  |---|---|---|---|---|---|---|---|
  | adulte | 20 titres (1…20), total 100 | 20, dès 21 | 20 | 200 / 200 | 1, 2 | 201 / 201 | acceptée |
  | enfant | 20 titres, tous « U » (1…58), total 40 | 14, dès 61, tous « U » | 13 | 200 / 403 `restricted_title` | 1 | 201 / 403 `restricted_title` | « Ce titre n'est pas disponible pour ce profil. » |

  Les 34 titres « U » du catalogue simulé arrivent en deux pages pleines, à la suite, sans
  trou ni doublon ; le total annoncé (40 : une page d'avance) devient exact (34) à la fin.
  Relevés précédents : à l'étape A (pont provisoire), l'enfant n'avait aucun titre ; face à
  un cœur SANS pont (165d09d70), il voyait tout, comme avant.

  **Budget du cœur** : le pont lit au plus 24 titres chez TMDB par appel ; les autres sont
  cachés cette fois et lus en fond. Les pages pleines appellent le pont page de Jellyseerr par
  page (20 titres) : elles restent dans le budget. Une grande liste d'un coup (calendrier
  d'une plateforme, recherche complète) peut montrer moins de titres à sa première ouverture.

## De bout en bout, contre une vraie bibliothèque (lot « droits 2 », 2026-10-15)

Éprouvé par le banc du contrôle parental du cœur (`apps/backend/test/parental-bench/` du dépôt
Tentacle-TV, `pnpm --filter @tentacle-tv/backend bench:parental`) : Vigie de cette branche
installée devant un faux Jellyseerr dont les listes ne portent que de VRAIS identifiants TMDB
(titres de la bibliothèque, permis ou non, et titres extérieurs), le cœur relisant les vraies
classifications chez TMDB, un oracle du banc les relisant de son côté.

- **Ce qui fuyait venait du pont du cœur, pas de Vigie** : un titre de la BIBLIOTHÈQUE caché au
  compte (classé plus haut que sa note, étiqueté, non classé, ou dans une bibliothèque refusée)
  passait le pont — sa classification TMDB, elle, était « tous publics » — et Vigie le montrait
  comme titre à demander, fiche comprise. Corrigé dans le cœur (`contentPolicy/extensionBridge.ts`) :
  le pont applique la règle de « Pour vous » (caché par la bibliothèque = jamais ; une version vue =
  Jellyfin a jugé ; sinon TMDB). **Rien à changer dans Vigie.**
- **`isRestricted` vaut aussi pour des bibliothèques bornées** (cœur, même correction) : un compte
  sans note maximale mais privé d'une bibliothèque passe désormais par les pages pleines et le
  filtre — il ne se voit plus proposer les titres de la bibliothèque qu'il ne voit pas.
- Relevé (compte « 6 ans », compte « Films seule », invité de la Famille sur une Apple TV, compte
  libre en témoin) : découverte films / séries / tendances, recherche (hub, barre du cœur, saga),
  semblables, saga, filmographie, fiche et saisons (403 `restricted_title`), `titles.state`,
  `titles.gaps`, `titles.mine`, « Mes demandes », avancement, calendrier : aucun titre refusé par
  l'oracle ; demander un titre interdit (hub ou carte) : refusé, aucune demande chez Jellyseerr.
  Restriction levée puis remise par l'administration : les demandes faites entre-temps disparaissent
  aussitôt de « Mes demandes », des titres attendus et du calendrier.
