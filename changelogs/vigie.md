# Changelog — Vigie

Notes de version du plugin, lues par le workflow de publication (`.github/workflows/publish.yml`)
pour la Release GitHub ET le champ `changelog` du marketplace.

Format (bilingue) — un bloc par version, plus récent en haut :

```
## [X.Y.Z]
### FR
- Ligne de note en français
### EN
- English note line
```

Si aucun bloc ne correspond à la version publiée, le workflow retombe sur le
sujet du commit (publication sans friction). Le numéro de version est
auto-bumpé par le message du commit (`feat`→mineure, `fix`→patch, `!`→majeure).

---

## [1.16.0]
### FR
- **Au téléphone, Vigie se parcourt au pouce.** L'en-tête se fait compact et le contenu commence bien plus haut ; les onglets restent accrochés en haut de l'écran, et une loupe y apparaît dès que le champ de recherche a défilé. Toucher l'onglet ouvert remonte en haut de sa page
- **Catalogue** : au téléphone, une seule rangée accrochée sous les onglets — le type, et les filtres (le tri est en tête du panneau). Un filtre actif se retire d'un toucher sur toute sa pastille
- **Un bouton pour revenir en haut** apparaît après un long défilement, au Catalogue comme dans les autres vues
- **Changer d'onglet remet ses réglages par défaut** : revenir au Catalogue après un détour par Mes demandes le rouvre sur « Tous », et de même pour les filtres des demandes et la vue du calendrier
- **Calendrier** : au téléphone, le mois se lit comme le Calendrier d'iOS — des points pour chaque jour qui a des sorties, et la liste du jour touché juste dessous
- **Mes demandes** : deux rangées d'outils au lieu de trois ; « Regarder » ou « Réessayer » reste à portée sur chaque demande ; la dernière erreur se lit en entier, sans infobulle ; déplier une saison en cours ne rouvre plus la fiche
- **Retirer une demande « À vérifier » sans rien toucher d'autre** : une demande en échec quitte la liste, sans supprimer de fichier ni rien changer dans Jellyfin, Sonarr ou Radarr
- **Les panneaux se referment en les tirant vers le bas**, et ils sont pleins : la page ne transparaît plus dessous. Les confirmations (saisons à supprimer ou à redemander, redemande groupée) deviennent des panneaux, avec des boutons à la taille du doigt
- Dans la prochaine version de l'application mobile Tentacle, la barre d'onglets s'efface quand un panneau s'ouvre, et les liens (YouTube…) s'ouvrent hors de l'application
- La recherche ne corrige plus « Dune » en « D'une », et le clavier se range quand on lance la recherche ou qu'on ouvre une fiche
- Plus de titre de rangée tronqué par son lien, des notifications pleine largeur au téléphone, des onglets de filmographie à la taille du doigt
### EN
- **On a phone, Vigie is easy to reach with your thumb.** The header is compact and the content starts much higher; the tabs stay pinned at the top of the screen, and a magnifier shows up in them once the search field has scrolled away. Tapping the open tab scrolls back to its top
- **Catalog**: on a phone, a single row pinned under the tabs — the type, and the filters (sorting sits at the top of the panel). An active filter is removed with one tap anywhere on its chip
- **A back-to-top button** shows up after a long scroll, in the Catalog as in the other views
- **Switching tabs restores their defaults**: going back to the Catalog after a detour through My requests reopens it on "All", and the same goes for request filters and the calendar view
- **Calendar**: on a phone, the month reads like the iOS Calendar — dots on each day with releases, and the tapped day's list right below
- **My requests**: two rows of tools instead of three; "Watch" or "Retry" stays within reach on every request; the last error reads in full, no tooltip needed; expanding a season in progress no longer reopens the detail page
- **Remove a request "to check" without touching anything else**: a failed request leaves the list without deleting any file or changing anything in Jellyfin, Sonarr or Radarr
- **Panels close when you pull them down**, and they are solid: the page no longer shows through. Confirmations (seasons to remove or request again, bulk retry) become panels, with finger-sized buttons
- In the next release of the Tentacle mobile app, the tab bar steps aside when a panel opens, and links (YouTube…) open outside the app
- Search no longer corrects "Dune" into "D'une", and the keyboard goes away when you search or open a title
- Row titles are no longer cut off by their link, notifications span the phone's width, and filmography tabs are finger-sized

## [1.15.1]
### FR
- **Mes demandes suivent Sonarr et Radarr en direct** : l'avancement réel, comme dans la file du serveur, puis « En cours d'importation » dès que le fichier est complet, et « Disponible » dès qu'il est rangé — sans plus attendre que Jellyseerr le constate. Ce nouvel état se lit aussi sur les affiches, la fiche et le calendrier
- **Une série demandée en partie ne se dit plus demandée en entier** : sur la fiche, seules les saisons réellement demandées portent « Demandé », comme chez Jellyseerr ; les autres restent libres et se cochent pour une demande
- **Un film déjà demandé ne propose plus « Demander quand même »** : sa fiche n'affiche que son état, y compris après « Marquer comme… › Demandée » et tant que la demande attend dans la file de Vigie
- **« Films » ne montre plus de séries** : dans le Catalogue, passer d'un type à l'autre rangeait parfois des titres du nouveau type sous l'ancien — de retour sur « Films », des séries s'y glissaient (et inversement). La grille du nouveau type charge aussi plus vite
### EN
- **My requests follow Sonarr and Radarr live**: real progress, as in the server queue, then "Importing" as soon as the file is complete, and "Available" as soon as it is in the library — no more waiting for Jellyseerr to notice. The new state also shows on posters, the detail page and the calendar
- **A partly requested series no longer shows every season as requested**: on the detail page, only the seasons actually requested read "Requested", as in Jellyseerr; the others stay free and can be ticked for a request
- **An already requested movie no longer offers "Request anyway"**: its detail page shows only its state, including after "Mark as… › Requested" and while the request is still waiting in Vigie's queue
- **"Movies" no longer shows series**: in the Catalog, switching types sometimes filed titles of the new type under the old one — back on "Movies", series slipped in (and vice versa). The new type's grid also loads faster

## [1.15.0]
### FR
- **Vigie tient en un seul onglet.** Découvrir, Mes demandes et Calendrier sont réunis sous la barre de recherche ; chaque vue garde sa position quand on passe de l'une à l'autre, et les anciens liens (/requests, /releases) ouvrent le bon onglet
- **Une recherche instantanée.** Les résultats s'affichent pendant la frappe et se complètent sans rien bousculer ; les fautes sont corrigées (« interstelar » → Interstellar, avec « Rechercher quand même » pour garder la saisie), les titres en romaji trouvent leur œuvre (« shingeki no kyojin »), et genres, plateformes et personnes répondent aussi
- **Chercher depuis Tentacle.** La barre de recherche globale et celle des bibliothèques proposent aussi ce qui n'est pas encore sur le serveur (« Pas encore sur le serveur · via Vigie »). Nécessite la prochaine version du serveur Tentacle ; sur un serveur plus ancien, rien ne change
- **Cinq états, une couleur chacun, partout.** Demandé, en route (avec son avancement), bloqué, disponible, en partie : chaque affiche le dit dans un bandeau que l'image ne peut pas avaler. Ce qui n'avance plus est « bloqué », **jamais** « en échec » — et la demande n'est plus supprimée puis recréée pour autant
- **« En partie » dit ce qui manque** : « Il manque 1 saison », « Il manque des épisodes de la saison 4 » — sous les affiches, sur la fiche, dans la recherche et dans Mes demandes, où ces demandes ont leur section et leur filtre. Une demande parle de SES saisons : la saison 1 en partie là et la 2 arrivée font une demande « en partie », la saison 2 seule une demande « disponible »
- **Chaque épisode a son état**, dans le calendrier (Re:Zero S4E18 « Disponible », S4E19 « Demandé ») comme dans les saisons de la fiche — même quand TMDB et Sonarr ne numérotent pas pareil
- **Par où le titre est sorti**, sous chaque affiche : au cinéma, en streaming, en Blu-ray, bientôt, ou « potentiellement disponible »
- **Un onglet Catalogue** : toute la base à portée de main, films et séries mêlés (« Tous », par défaut) ou par type. « Tout voir », genres et plateformes y mènent, filtrés, sous un titre qui suit le type choisi ; des filtres avancés plus nets, au pouce comme à la souris
- **Demande rapide** : au survol d'une affiche, « + » demande un film d'un geste, ou ouvre les saisons encore libres d'une série pour les ajouter d'un coup
- **Une fiche refaite** : l'état de chaque saison et de chaque épisode, le prochain épisode avec son état (et sa vraie saison), où regarder, les sorties et la fiche en colonne
- **Mes demandes** : en mode sélection, toute la ligne sélectionne ; la date d'une prochaine sortie ouvre sa semaine au calendrier
- **La filmographie d'un acteur, dans la recherche de Tentacle**, montre aussi ce qui n'est pas sur le serveur — seulement quand Vigie est installé et actif. Nécessite la prochaine version du serveur Tentacle
- Au téléphone, les panneaux ne passent plus sous la barre de navigation ; changer d'onglet ramène en haut de sa page
- **Découvrir** : une affiche à la une, vos demandes en cours (ou « Comment ça marche » pour commencer), les sorties de la semaine, des rangées, des raccourcis par plateforme et par genre. « Tout voir » ouvre une grille qui défile sans à-coups et où l'on peut sauter loin dans le catalogue sans tout charger
- **Mes demandes** : une phrase dit où en est chaque demande, avec l'avancement réel et la prochaine sortie ; filtres, sélection multiple, actions regroupées derrière « ⋯ »
- **Calendrier** : la semaine par défaut, la liste et le mois ; mes demandes, tout le serveur ou toutes les sorties
- **La fiche** : « Demander » visible sans défiler, la filmographie d'un acteur depuis le casting, les fiches qui s'empilent (« retour » ramène à la précédente) ; Échap ferme un panneau à la fois
- Au téléphone, les trois onglets tiennent sur la largeur de l'écran
### EN
- **Vigie fits in a single tab.** Discover, My requests and Calendar sit together under the search bar; each view keeps its position when you switch, and the old links (/requests, /releases) open the right tab
- **Instant search.** Results show up while you type and complete without shuffling; typos are fixed ("interstelar" → Interstellar, with "Search for … instead" to keep what you typed), romaji titles find their show ("shingeki no kyojin"), and genres, platforms and people answer too
- **Search from Tentacle.** The global search bar and the library search also offer what isn't on the server yet ("Not on the server yet · via Vigie"). Requires the next Tentacle server release; on an older server, nothing changes
- **Five states, one color each, everywhere.** Requested, on its way (with its progress), stuck, available, partial: every poster says it in a band the artwork can't swallow. What stopped moving is "stuck", **never** "failed" — and the request is no longer deleted and recreated because of it
- **"Partial" says what's missing**: "1 season missing", "Missing episodes of season 4" — under posters, on the detail sheet, in search and in My requests, where such requests get their own section and filter. A request speaks of ITS seasons: season 1 partly here and season 2 arrived make a "partial" request, season 2 alone an "available" one
- **Every episode has its state**, in the calendar (Re:Zero S4E18 "Available", S4E19 "Requested") as in the detail's seasons — even when TMDB and Sonarr number them differently
- **How the title came out**, under every poster: in theaters, streaming, on Blu-ray, soon, or "possibly available"
- **A Catalog tab**: the whole database at hand, movies and shows mixed ("All", by default) or by type. "See all", genres and platforms lead there, filtered, under a title that follows the chosen type; sharper advanced filters, for thumbs and mice alike
- **Quick request**: hovering a poster, "+" requests a movie in one move, or opens a show's free seasons to add them at once
- **A redesigned detail sheet**: each season's and each episode's state, the next episode with its state (and its real season), where to watch, releases and facts in a side column
- **My requests**: in selection mode, the whole row selects; the date of an upcoming release opens its week in the calendar
- **An actor's filmography, in Tentacle's search**, also shows what isn't on the server — only when Vigie is installed and enabled. Requires the next Tentacle server release
- On phones, panels no longer slide under the navigation bar; switching tabs brings you back to the top of the page
- **Discover**: a featured title, your requests in progress (or "How it works" to get started), this week's releases, rows, platform and genre shortcuts. "See all" opens a grid that scrolls smoothly and lets you jump far into the catalog without loading everything
- **My requests**: one sentence tells where each request stands, with real progress and the next release; filters, multi-select, actions grouped behind "⋯"
- **Calendar**: the week by default, list and month; my requests, the whole server or every release
- **The detail sheet**: "Request" visible without scrolling, an actor's filmography from the cast, stacked sheets ("back" returns to the previous one); Escape closes one panel at a time
- On phones, the three tabs fit the screen width

## [1.14.5]
### FR
- **Une demande supprimée dans Jellyseerr reste supprimée.** Le plugin la classait « en échec » et l'auto-retry la recréait quelques minutes plus tard : la saison qu'on venait de libérer réapparaissait « Demandée ». Elle est désormais close côté plugin — ni nouvelle tentative, ni verrou de saison
- **Les affiches de la première rangée du Catalogue s'affichent** quand la fiche s'ouvre à l'arrivée (`?media=…`) : les cartes montées pendant que la fiche couvrait la grille ne recevaient jamais leur verdict de visibilité
- **Une saison dont les données ont été supprimées dans Jellyseerr redevient libre** dans la fiche : elle quitte la demande locale (qui se ferme s'il n'en reste aucune), la fiche ne la compte plus « demandée », et elle relit l'état Jellyseerr à chaque ouverture au lieu de le garder un jour en cache. Agir sur une demande disparue de Jellyseerr le dit clairement et rafraîchit la liste
### EN
- **A request deleted in Jellyseerr stays deleted.** The plugin filed it as "failed" and the auto-retry recreated it minutes later: the season you had just freed showed up as "Requested" again. It is now closed on the plugin side — no retry, no season lock
- **First-row posters in the Catalog show up** when the detail opens on arrival (`?media=…`): cards mounted while the detail covered the grid never received their visibility verdict
- **A season whose data was deleted in Jellyseerr becomes free again** in the detail: it leaves the local request (which closes when none remains), the detail no longer counts it as requested, and it re-reads the Jellyseerr state on every opening instead of caching it for a day. Acting on a request gone from Jellyseerr says so clearly and refreshes the list

## [1.14.3]
### FR
- **La fiche s'ouvre à l'arrivée.** Un lien `?media=movie:123` (ou `tv:456`) sur la page Découvrir ouvre directement le détail du titre — c'est la porte d'entrée des recommandations de Tentacle (« Voir dans le catalogue »). Point d'entrée uniquement : fermer la fiche ne la rouvre pas
- **Une fiche ouverte par lien se complète toute seule** : titre, année et images sont tirés du détail chargé — plus jamais de carte sans nom ni affiche
- Nécessite un hôte Tentacle ≥ 1.16 pour transmettre le lien (`__tentacle_env.query`) ; sur un hôte plus ancien, rien ne change

### EN
- **The details open on arrival.** A `?media=movie:123` (or `tv:456`) link on the Discover page opens the title's details directly — the landing door for Tentacle's recommendations ("View in catalog"). Entry point only: closing the details does not reopen them
- **A link-opened card completes itself**: title, year and artwork are pulled from the loaded detail — never again a card with no name or poster
- Requires a Tentacle host ≥ 1.16 to pass the link through (`__tentacle_env.query`); on an older host, nothing changes

## [1.14.2]
### FR
- **Une panne n'est plus jamais confondue avec « rien à signaler ».** Quand une des sources du calendrier (Jellyseerr/TMDB, Sonarr) ne répondait pas — réseau pas encore prêt juste après un redémarrage, service momentanément indisponible — le plugin pouvait retenir un calendrier maigre comme s'il était complet, pendant six heures, sans bandeau ni nouvelle tentative
- Désormais : un échec n'est **jamais mis en cache comme un succès**, la dernière bonne réponse connue continue d'être servie, le calendrier se déclare **incomplet** (bandeau « Construction du calendrier en cours… ») et la reconstruction se relance chaque minute jusqu'à ce que tout réponde
- Une instance **sans Sonarr** reste parfaitement normale : « pas de Sonarr configuré » est un vrai « rien à signaler » — seul « Sonarr configuré mais muet » compte comme une panne (et n'est plus masqué dix minutes par le cache de configuration)
- Le sélecteur de plateformes et les heures de diffusion ne peuvent plus retenir un résultat vide pendant des heures après une panne passagère
### EN
- **An outage can no longer be mistaken for "nothing to report".** When one of the calendar's sources (Jellyseerr/TMDB, Sonarr) failed to answer — network not ready right after a restart, service briefly down — the plugin could cache a thin calendar as if it were complete, for six hours, with no banner and no retry
- Now: a failure is **never cached as a success**, the last known good answer keeps being served, the calendar declares itself **incomplete** (the "Building the calendar…" banner shows) and rebuilds every minute until everything answers
- Instances **without Sonarr** stay perfectly normal: "no Sonarr configured" is a genuine "nothing to report" — only "configured but silent" counts as an outage (and is no longer hidden for ten minutes by the settings cache)
- The platform picker and episode air times can no longer hold an empty result for hours after a transient failure

## [1.14.1]
### FR
- **La page Sorties devient « Calendrier »**, et ses onglets disent enfin ce qu'ils montrent : **« Mes demandes »** (avec « Toutes mes demandes » / « Toutes les demandes ») et **« Toutes les sorties »** — tous les calendriers de la période, contenus non demandés compris
- **Les jours passés de la semaine et du mois affichent leurs sorties.** Un samedi, le calendrier ne savait plus ce qui était sorti lundi : la fenêtre de données démarrait à aujourd'hui, et les séries n'avaient aucune source de dates passées. Le calendrier de Sonarr les fournit désormais, épisodes passés compris
- **La vue semaine de « Toutes les sorties » n'est plus vide** sans filtre : elle ne recevait que des premières diffusions et des sorties salle, rarement dans les sept jours. Les prochains épisodes des séries en cours y figurent maintenant d'office, plus besoin de cocher une plateforme pour voir quelque chose
- **Le calendrier général est construit une seule fois pour tout le serveur**, mis en cache six heures et rafraîchi en arrière-plan — préchauffé dès le démarrage : le premier visiteur ne paie plus la construction entière. « Mes demandes » est dérivé de ce même calendrier par filtrage, quasi instantané une fois chaud ; une demande toute fraîche reste visible immédiatement
- **Le premier chargement se voit** : squelette en forme de calendrier (plus de saut de mise en page), bandeau « Construction du calendrier en cours — les sorties s'ajoutent au fur et à mesure », et revenir sur la page se peint immédiatement grâce à la dernière réponse mémorisée dans le navigateur
- **Le filtre « Animés » fonctionne**, films d'animation compris — une fiche jamais évaluée n'éteint plus le filtre. Les plateformes **filtrent** en mode « Toutes les sorties » au lieu de remplacer le calendrier, et changer n'importe quel filtre ne recharge plus rien
- **« Semaine précédente » et « Mois précédent » gardent leur position** au lieu de revenir à la période courante ; la vue mois s'ouvre sur le mois courant (plus de saut au mois du premier titre) et gagne un bouton « Ce mois-ci »
- Une nouvelle demande apparaît immédiatement dans « Toutes les demandes » — le cache partagé n'était jamais purgé et pouvait retarder l'affichage d'un quart d'heure
- L'option de tri « Date » n'est plus étiquetée « Titre »
### EN
- **The Releases page is now “Calendar”**, with tabs that say what they show: **“My requests”** (with “All my requests” / “All requests”) and **“All releases”** — every calendar for the period, unrequested content included
- **Past days of the current week and month show their releases.** On a Saturday the calendar no longer knew what came out on Monday: the data window started at today, and series had no source of past dates. Sonarr's calendar now provides them, past episodes included
- **The week view of “All releases” is no longer empty** without filters: it only received premieres and theatrical dates, rarely within seven days. Next episodes of ongoing series now show up out of the box
- **The general calendar is built once for the whole server**, cached for six hours and refreshed in the background — warmed up at startup, so the first visitor no longer pays for the full build. “My requests” derives from that same calendar by filtering, near-instant once warm; a brand-new request still shows up immediately
- **The first load is visible**: a calendar-shaped skeleton (no more layout jump), a “Building the calendar” banner, and returning to the page paints instantly from the last response kept in the browser
- **The “Anime” filter works**, animated movies included. Platforms now **filter** in “All releases” instead of replacing the calendar, and changing any filter no longer refetches anything
- **“Previous week” and “Previous month” keep their position** instead of snapping back; the month view opens on the current month and gains a “This month” button
- A new request shows up immediately in “All requests” — the shared cache was never purged and could delay it by fifteen minutes
- The “Date” sort option is no longer labeled “Title”

## [1.14.0]
### FR
- **Le plugin s'appelle désormais Vigie.** Il n'est affilié ni à Jellyseerr ni à Overseerr : c'est un plugin indépendant qui se connecte à votre propre instance. La mention figure dans le README, sur la fiche de la marketplace et sur la page de configuration
- **Pages renommées** : « Découvrir » devient **Catalogue** (ce qui n'est pas encore dans votre bibliothèque et que vous pouvez demander), « Demandes » devient **Mes demandes** partout — le même écran portait jusqu'ici trois noms différents
- **Nouvelle page Sorties** : un vrai agenda, en vue **semaine** (sept jours, affiche et titre lisibles sans survol) ou **mois** (les titres s'affichent dans les cases, pas de simples pastilles). Deux modes — vos demandes en attente, ou tout ce qui sort — que l'on croise avec autant de plateformes qu'on veut (Crunchyroll, Netflix, Disney+, ADN, Canal+… 80 disponibles en France). Un titre peut être demandé directement depuis l'agenda
- **On voit où un titre est déjà regardable** : les logos des plateformes d'abonnement apparaissent sur les sorties et sur la fiche détaillée
- Une saison publiée d'un coup ne remplit plus la journée de dix lignes identiques : les épisodes se replient en « S5E1–E8 »
- Le plugin utilise enfin **la même police que Tentacle TV**. Il tournait en police système, ce qui le faisait détonner sur chaque écran
- Une cinquantaine d'états qui ne s'affichaient pas du tout — onglet actif, pilule sélectionnée, anneau de focus au clavier — sont réparés. Les boutons et pilules reprennent le style du reste de l'application
- **On sait enfin si un titre est vraiment sorti, et PAR OÙ.** Un film annoncé « 2026 » peut être au cinéma sans exister nulle part ailleurs. Le catalogue distingue maintenant les trois canaux — salle, en ligne, DVD/Blu-ray — et les affiche **ensemble** quand ils se cumulent : un film peut être encore à l'affiche et déjà pressé en Blu-ray, ce qui change tout pour une demande. La fiche ajoute une phrase sur ce qu'on peut raisonnablement espérer, sans jamais le promettre ni le chiffrer. Rien ne s'affiche quand il n'y a rien à signaler, et le mot « Disponible » reste réservé à votre bibliothèque
- Correctif : un film déjà sorti en Blu-ray n'affichait **rien du tout** — l'information la plus utile était précisément celle qui disparaissait
- **Les logos des plateformes apparaissent sur les cartes du catalogue**, à côté de l'année. Ils voyagent avec les dates de sortie : aucune requête supplémentaire, et la carte ne grandit pas
- **L'heure réelle de diffusion des épisodes**, quand Sonarr suit la série. TMDB ne donne que la date, et c'est celle du fuseau de la chaîne d'origine : un épisode annoncé le 14 août sortait en fait le 13 à 17 h 15 chez vous. La date était donc fausse d'un jour sur toutes les séries diffusées en Asie. Une série que Sonarr ne suit pas garde sa date seule — on n'invente pas d'heure
- **La progression d'une série se lit saison par saison** : une ligne par saison, dépliable jusqu'au détail des épisodes. Demander les saisons 1 et 2 et ne voir descendre que la 1 laissait croire que la seconde avait été oubliée ; elle apparaît maintenant « En attente »
- **« En cours de validation »** quand un téléchargement est terminé mais pas encore vérifié ni rangé. La demande restait affichée « En téléchargement », avec un temps restant figé à zéro, pendant que Jellyseerr affichait déjà autre chose
- **Onglet « Téléchargements du serveur » pour les administrateurs** : la file de Sonarr et Radarr en entier, y compris ce qui n'est pas passé par le plugin — ajouts manuels et demandes des autres comprises. Un service injoignable est signalé, plutôt que de laisser croire qu'il ne se passe rien
- Correctif : une série « partiellement disponible » n'affichait aucune barre de progression et n'était plus suivie, au moment précis où elle récupérait encore des épisodes
- **Progression réelle des téléchargements** : pourcentage, taille et temps restant remontés par Sonarr / Radarr, à la place de la barre d'étapes symbolique. La barre avance en continu entre deux rafraîchissements, sans requête supplémentaire, et rien n'est interrogé quand aucun téléchargement n'est en cours ou que l'onglet est en arrière-plan
- **Mes demandes s'ouvre en une fraction de seconde** au lieu de plusieurs dizaines de secondes. Les fiches (titres, affiches, dates) sont mémorisées durablement et survivent au redémarrage du serveur ; les statistiques arrivent avec la liste au lieu de la recharger une seconde fois ; l'expiration du cache ne fait plus attendre personne
- Le raccourci affiche **⌘K sur Mac** au lieu de « Ctrl+K », et fonctionne aussi sur Mes demandes qui n'en avait aucun
- Revenir sur une page du plugin la rouvre **en haut**
- Les pages du plugin peuvent être **retirées de la barre de navigation** (menu « Bibliothèques ») ; elles y sont par défaut
- **La barre de l'agenda tient sur une ligne** : elle empilait jusqu'à trois rangées, dont un mur de quarante pilules de plateformes qui repoussait le calendrier hors de l'écran. Les plateformes passent derrière un bouton « Filtres », le même que sur le catalogue
- **On peut suivre plusieurs plateformes à la fois.** Il fallait auparavant choisir « Par plateforme », puis UNE seule plateforme, en perdant au passage l'affichage de ses propres demandes. On coche maintenant Netflix ET Disney+ ET Crunchyroll, avec leur logo, et le filtre s'applique aussi bien à « Mes sorties » qu'à « Tout »
- Correctif : chaque sortie de l'agenda affichait les logos des plateformes **demandées** plutôt que les siennes. Inoffensif à une plateforme, faux dès qu'on en cochait plusieurs
- **« Mes sorties » propose « À venir » ou « Toutes les demandes »** : la page ne montrait que ce qui restait à arriver, et paraissait donc vide quand tout était là. « À venir » affiche désormais l'intégralité de vos demandes, et **« Toutes les demandes » montre celles de tous les utilisateurs du serveur** — sur une instance partagée, « qu'est-ce qui arrive bientôt ici ? » n'avait aucune réponse
- **Le catalogue ne clignote plus quand on le fait défiler.** Les pastilles et les logos s'éteignaient d'un coup sur tout l'écran à chaque page chargée, le temps d'un aller-retour, et les cartes rétrécissaient puis regrandissaient au passage. Les titres au-delà des premiers n'obtenaient d'ailleurs jamais leur pastille
- **Les cartes n'attendent plus pour s'afficher** : passé la première page, chacune restait invisible presque une seconde alors que son contenu était déjà chargé. Le défilement lui-même est nettement plus fluide — le plugin préchargeait deux pages à chaque fois sous une adresse que personne ne lisait, se faisant concurrence à lui-même, et gardait en mémoire vive toutes les cartes déjà parcourues, y compris hors écran
- **Le filtre plateformes du catalogue s'ouvre aux cent plateformes** de la région au lieu de onze écrites en dur, toujours en sélection multiple, avec recherche
- Les pages de catalogue sont désormais **mises en cache pour tout le monde** pendant cinq minutes : deux personnes qui appliquent le même filtre ne déclenchent plus qu'un seul aller-retour
- **Les filtres du catalogue sont rangés** : sept sections dépliées d'un coup deviennent des sections repliables, chacune avec le nombre de valeurs retenues et son propre « Effacer ». Le panneau parlait quatre langages de bouton différents, il n'en parle plus qu'un. Un bouton fixe en bas annonce combien de titres correspondent
- Correctif : une suppression par un utilisateur ne vidait plus seulement son propre cache mais celui de tout le monde
- **Le catalogue ne gonfle plus quand on le fait défiler longtemps.** Chaque affiche parcourue restait en mémoire jusqu'à la fin de la session, y compris des centaines d'écrans plus haut : vingt pages, c'étaient plusieurs centaines de mégaoctets retenus pour des images que personne ne regardait. Une affiche trop loin de l'écran est maintenant libérée, et récupérée bien avant de redevenir visible — le défilement, lui, ne change en rien
- Le diaporama en tête du catalogue **ne travaille plus quand il n'est pas à l'écran**. Il faisait tourner ses cinq grandes images de fond toutes les six secondes, indéfiniment, pendant qu'on parcourait la grille bien plus bas ou qu'on regardait un autre onglet
- Les vignettes de l'agenda et de Mes demandes **ne chargent plus des affiches cinq fois trop grandes** pour la place qu'elles occupent
- **« Toutes les demandes » montre enfin autre chose que les vôtres.** Trois défauts se cumulaient, et chacun rendait le suivant invisible : une fiche connue mais sans aucune date comptait comme acquise — c'est le cas de toutes celles amorcées depuis vos demandes, titre seul — la réponse tronquée qui en résultait était ensuite gardée un quart d'heure puis servie six heures de plus, et rien n'allait jamais chercher les demandes faites ailleurs que dans le plugin. La page se complète maintenant d'elle-même pendant qu'on la regarde
- **Les Sorties se trient et se filtrent** : par popularité, note ou titre, avec une note minimum et une langue originale — comme le catalogue, en gardant les critères qui ont un sens sur un agenda. Le tri s'applique à l'intérieur d'une journée : en vue mois, où une case n'affiche que les premières sorties, c'est lui qui décide de ce qu'on voit
- **Le type Animés arrive sur les Sorties.** Il ne se déduit pas du genre Animation, qui rangerait Pixar et les Simpson avec les productions japonaises
- **Le mode « Tout » ne noie plus vos demandes** : elles portent leur pastille au milieu des sorties de la région, et un bouton permet de n'afficher qu'elles
- **Le catalogue se filtre par canal de sortie** — au cinéma, en streaming, en Blu-ray
- Les réglages de l'agenda sont tous retenus d'une visite à l'autre ; le type de média était le seul à repartir de zéro
- Correctif : régler une note minimum et vider l'agenda annonçait « vous n'avez aucune demande à venir », ce qui était faux — c'était le filtre, pas l'absence de demandes
- **Une demande dont toutes les saisons demandées sont arrivées s'affiche « Disponible ».** Demander les saisons 1 et 2, les recevoir toutes les deux et lire encore « Partiellement disponible » : le badge parlait de la série entière — à qui il manque la saison 3 — pas de la demande, qui était satisfaite. Le compteur du bandeau, le suivi en direct et l'agenda disent maintenant la même chose que la carte
- **Sur mobile, la barre d'onglets ne mange plus le bas des panneaux.** Elle flotte au-dessus du plugin : le bouton « Appliquer » des filtres se retrouvait entièrement dessous, tout comme la fin de la fiche détaillée, la dernière option de « Marquer comme », les toasts et la barre de sélection multiple

### EN
- **The plugin is now called Vigie.** It is affiliated with neither Jellyseerr nor Overseerr: it is an independent plugin connecting to your own instance. Stated in the README, on the marketplace listing and on the settings page
- **Pages renamed**: "Discover" becomes **Catalog** (what is not yet in your library and can be requested), "Requests" becomes **My Requests** everywhere — the same screen used to carry three different names
- **New Releases page**: a real calendar, in **week** view (seven days, poster and title readable without hovering) or **month** view (titles show inside the cells, not just coloured dots). Two modes — your pending requests, or everything coming out — crossed with as many platforms as you like (Crunchyroll, Netflix, Disney+, ADN, Canal+… 80 available in France). Titles can be requested straight from the calendar
- **You can see where a title is already watchable**: subscription platform logos appear on releases and on the detail sheet
- A season dropped all at once no longer fills the day with ten identical rows: episodes collapse into "S5E1–E8"
- The plugin finally uses **the same font as Tentacle TV**. It was running on the system font, which made it stand out on every screen
- Around fifty states that simply did not render — active tab, selected pill, keyboard focus ring — are fixed. Buttons and pills now follow the rest of the app
- **You can finally tell whether a title is actually out, and WHERE.** A movie labelled "2026" may be in theaters and nowhere else. The catalog now tells the three channels apart — theaters, online, DVD/Blu-ray — and shows them **together** when they overlap: a film can still be on screens and already pressed on Blu-ray, which changes everything for a request. The detail sheet adds a line on what can reasonably be expected, without ever promising it or putting a number on it. Nothing is shown when there is nothing to report, and "Available" stays reserved for your library
- Fix: a movie already out on Blu-ray showed **nothing at all** — the single most useful piece of information was the one that disappeared
- **Platform logos now appear on catalog cards**, next to the year. They travel with the release dates: no extra request, and the card does not grow
- **Real air times for episodes**, when Sonarr tracks the series. TMDB only gives the date, and it is the one from the broadcaster's own time zone: an episode announced for August 14th actually aired on the 13th at 5:15 PM for you. The date was therefore a day off on every series airing in Asia. A series Sonarr does not track keeps its plain date — no air time is invented
- **Series progress now reads season by season**: one row per season, expandable down to individual episodes. Requesting seasons 1 and 2 and only seeing the first come down made it look like the second had been forgotten; it now shows as "Waiting"
- **"Validating"** when a download has finished but has not been checked and filed yet. The request used to stay on "Downloading", with a time left frozen at zero, while Jellyseerr already showed something else
- **"Server downloads" tab for administrators**: the whole Sonarr and Radarr queue, including what never went through the plugin — manual additions and other people's requests. An unreachable service is reported, rather than letting you believe nothing is happening
- Fix: a "partially available" series showed no progress bar and was no longer tracked, at the very moment it was still fetching episodes
- **Real download progress**: percentage, size and time left reported by Sonarr / Radarr, replacing the symbolic step bar. The bar advances smoothly between refreshes with no extra request, and nothing is polled when no download is running or the tab is in the background
- **My Requests opens in a fraction of a second** instead of tens of seconds. Metadata (titles, posters, dates) is stored durably and survives a server restart; stats come with the list instead of reloading it a second time; cache expiry no longer makes anyone wait
- The shortcut hint shows **⌘K on Mac** instead of "Ctrl+K", and now works on My Requests too
- Returning to a plugin page reopens it **at the top**
- Plugin pages can be **removed from the navigation bar** (Libraries menu); they are pinned by default
- **The calendar toolbar fits on one line**: it stacked up to three rows, including a wall of forty platform pills that pushed the calendar off screen. Platforms moved behind a "Filters" button, the same one as on the catalog
- **You can follow several platforms at once.** You previously had to pick "By platform", then ONE platform, losing your own requests from the view in the process. You can now tick Netflix AND Disney+ AND Crunchyroll, logos included, and the filter applies to "My releases" just as well as to "Everything"
- Fix: every calendar entry showed the logos of the **requested** platforms rather than its own. Harmless with one platform, wrong as soon as several were ticked
- **"My releases" now offers "Upcoming" or "All requests"**: the page only showed what was still to come, and therefore looked empty once everything had arrived. "Upcoming" now shows all of your requests, and **"All requests" shows those of every user on the server** — on a shared instance, "what is coming up here?" had no answer at all
- **The catalog no longer flickers while scrolling.** Pills and platform logos went dark across the whole screen on every page load, for the duration of a round trip, and cards shrank then grew back in the process. Titles past the first batch never got their pill at all
- **Cards no longer wait to show up**: past the first page, each one stayed invisible for nearly a second even though its content had already loaded. Scrolling itself is markedly smoother — the plugin was prefetching two pages every time under an address nobody ever read, competing with itself, and kept every card already scrolled past in memory, off-screen ones included
- **The catalog platform filter opens up to the region's hundred platforms** instead of eleven hard-coded ones, still multi-select, with search
- Catalog pages are now **cached for everyone** for five minutes: two people applying the same filter no longer trigger two round trips
- **Catalog filters are tidied up**: seven sections unfolded at once become collapsible ones, each showing how many values are selected and its own "Clear". The panel spoke four different button languages, now just one. A fixed button at the bottom states how many titles match
- Fix: one user deleting a request used to clear everyone's cache, not just their own
- **The catalog no longer bloats when scrolled for a long time.** Every poster scrolled past stayed in memory until the end of the session, including ones hundreds of screens above: twenty pages meant several hundred megabytes held for images nobody was looking at. A poster far enough from the screen is now released, and fetched back well before it becomes visible again — scrolling itself is unchanged
- The slideshow at the top of the catalog **no longer works while off-screen**. It kept cycling its five large background images every six seconds, indefinitely, while you browsed the grid far below or looked at another tab
- Thumbnails on the calendar and My Requests **no longer load posters five times larger** than the space they occupy
- **"All requests" finally shows more than your own.** Three flaws stacked up, each hiding the next: a title known but carrying no date at all counted as resolved — which is the case for every entry seeded from your requests, title only — the truncated response that followed was then kept for a quarter of an hour and served six hours beyond that, and nothing ever went looking for requests made outside the plugin. The page now fills itself in while you watch it
- **Releases can be sorted and filtered**: by popularity, rating or title, with a minimum rating and an original language — like the catalog, keeping only the criteria that make sense on a calendar. Sorting applies WITHIN a day: in month view, where a cell shows only the first few releases, it decides what you see at all
- **The Anime type comes to Releases.** It is not inferred from the Animation genre, which would file Pixar and the Simpsons alongside Japanese productions
- **"Everything" no longer drowns your requests**: they carry their badge among the region's releases, and a button shows them alone
- **The catalog can be filtered by release channel** — in theaters, streaming, Blu-ray
- Every calendar setting is now remembered between visits; the media type was the only one starting over each time
- Fix: setting a minimum rating and emptying the calendar announced "you have no upcoming requests", which was untrue — it was the filter, not a lack of requests
- **A request whose requested seasons have all arrived now reads "Available".** Requesting seasons 1 and 2, getting both, and still reading "Partially available": the badge described the whole series — which is still missing season 3 — not the request, which was fulfilled. The stats bar, live progress and calendar now agree with the card
- **On mobile, the tab bar no longer eats the bottom of panels.** It floats above the plugin: the filters' "Apply" button ended up entirely underneath it, as did the end of the detail sheet, the last "Mark as" option, toasts and the bulk selection bar

## [1.13.2]
### FR
- Thème clair 100 % lisible : le hero « Découvrir » garde une image vive avec texte blanc sur dégradé sombre (fini le titre invisible), les chips de statut, statistiques, boutons d'action et survols de cartes suivent désormais le thème avec un vrai contraste (« Partiellement dispo. » n'est plus jaune sur jaune)
- Le repli de thème du plugin gère désormais clair ET sombre (détection du schéma de l'hôte — web, desktop et mobile) et complète les tokens manquants sur mobile (surfaces, remplissages, statuts)
### EN
- Fully readable light theme: the Discover hero keeps vivid artwork with white text over a dark gradient (no more invisible title); status chips, statistics, action buttons and card hovers now follow the theme with proper contrast ("Partially available" is no longer yellow-on-yellow)
- The plugin's theme fallback now handles light AND dark (host scheme detection — web, desktop and mobile) and fills in missing tokens on mobile (surfaces, fills, statuses)

## [1.13.1]
### FR
- Demande de saison : une saison demandée apparaît **immédiatement** comme « Demandé » et ne peut plus être redemandée par erreur. Le verrou s'appuie désormais sur la file locale du plugin (et non sur Jellyseerr, qui accusait un décalage) : il tient dès le clic et survit au rafraîchissement de la page.
### EN
- Season request: a requested season now shows as “Requested” **immediately** and can no longer be re-requested by mistake. The lock now relies on the plugin's local queue (instead of Jellyseerr, which lagged behind): it holds from the moment you click and survives a page refresh.

## [1.13.0]
### FR
- Disponibilité par-saison : une demande de saison(s) est désormais considérée disponible dès que les saisons DEMANDÉES sont présentes, même si le reste de la série manque — fini les demandes bloquées en « partiellement disponible » sans notification.
- Notifications enrichies : « Saison N est sortie sur Tentacle TV » (accord grammatical film/série/saison), avec une notification dès qu'une partie des saisons demandées arrive (ex. 2/3 saisons) puis pour les suivantes.
- Réconciliation de disponibilité accélérée côté Jellyseerr (rafraîchissement de l'état par saison).
- Notifications épurées : Seer ne notifie plus qu'aux étapes utiles — en cours de téléchargement, sortie, et échec définitif. Fini les notifications « demande envoyée », « approuvée » et les tentatives automatiques (anti-spam).
- Anti-doublon : quand une demande devient disponible, une seule notification part (celle de Seer) — plus de doublon avec la notification « ajout bibliothèque » (nécessite le serveur ≥ 1.5.5).
- Notification même si déjà présent : demander un contenu déjà dans la bibliothèque envoie quand même la notification « disponible » (avant : silence).

### EN
- Per-season availability: a season request is now considered available as soon as the REQUESTED seasons are present, even if the rest of the series is missing — no more requests stuck as "partially available" with no notification.
- Richer notifications: "Season N is now on Tentacle TV", with a notification as soon as some of the requested seasons arrive (e.g. 2 of 3) and again for the following ones.
- Faster availability reconciliation on the Jellyseerr side (per-season status refresh).
- Streamlined notifications: Seer now only notifies at useful stages — downloading, released, and permanent failure. No more "request sent", "approved" or auto-retry notifications (anti-spam).
- Deduplication: when a request becomes available, only one notification is sent (Seer's) — no more duplicate with the "library added" notification (requires server ≥ 1.5.5).
- Notify even if already present: requesting content already in the library still sends the "available" notification (previously: silent).

## [1.12.0]
### FR
- Support complet du thème CLAIR : surfaces, textes, boutons et modales suivent désormais le thème de l'application (fini le texte blanc sur fond blanc).
- Boutons et champs branchés sur les tokens sémantiques de l'hôte (cohérence clair/sombre garantie).

### EN
- Full LIGHT theme support: surfaces, text, buttons and modals now follow the host app theme (no more white-on-white text).
- Buttons and inputs wired to the host semantic tokens (guaranteed light/dark consistency).
