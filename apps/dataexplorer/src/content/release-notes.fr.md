# Notes de version

---

## 1.4.x

### Aperçu

La version `1.4.x` ajoute les **variables d'environnement** (couches globales, profil et base avec `{{templates}}`, filtres pipe et dynamiques Faker) ; ajoute le **terminal ORDA** (modes REPL et Code avec fichiers snippets) dans un dock bas partagé avec la Console ; ajoute **l’export REST** (collection v2.1 et OpenAPI 3.1 depuis le catalogue, le Client HTTP et l’Exécuteur de méthodes) ; ajoute les **outils de sélection** (analyse `$distinct` / `$compute`, export/import multi-formats, anonymisation Faker avec téléchargement, import comme nouveaux ou mise à jour in-place) ; ajoute les **favoris** pour le Client HTTP et l’Exécuteur de méthodes ; publie les applications **iOS et Android** ; améliore l’Exécuteur de méthodes (params/en-têtes Advanced, `$method=entityset` par défaut, erreurs dans le panneau résultat, états vides, raccourcis mod-clic) ; améliore le journal réseau de la console (corps pendant le pending, ouverture pendant le pending, annulation) ; et peaufine l'expérience mobile (Client HTTP et dock).

### Fonctionnalités

#### Variables d'environnement

- **Éditeur d'environnements** — Gérez les portées **Globals**, **Profil** et **Cette base** depuis Outils, la palette de commandes (**Environnements**), ou le sélecteur **Environment** du pied de page → **Gérer…**.
- **Environnements actifs** — Un environnement profil et un environnement base actifs à la fois ; le sélecteur du pied de page les choisit et prévisualise la liste fusionnée (les secrets restent masqués jusqu'à révélation).
- **Templates** — Insérez `{{name}}` dans le Client HTTP, l'Exécuteur de méthodes, le Query Builder, Créer une entité, les snippets du terminal ORDA et d'autres champs templated ; résolution à l'envoi / l'exécution.
- **Filtres pipe** — Transformations style Liquid (`upper`, `lower`, `snake`, `hash:md5`, …) et options de génération (`female` / `male`, `min` / `max` / `between`, `after` / `before`).
- **Contexte `$this`** — Accès à l’objet d’exécution (`{{$this.firstName}}`, `{{$this.headers.Authorization}}`, `{{$this.methodName}}`, …) pour les formulaires d’entité, le Client HTTP, l’Exécuteur de méthodes et le Query Builder ; résolution multi-passes entre champs frères.
- **Variables dynamiques** — Surface Faker complète via `{{$faker.module.method}}` (ex. `{{$faker.person.fullName}}`, `{{$faker.string.uuid}}`), plus alias horloge `{{$timestamp}}` / `{{$isoTimestamp}}`.
- **Templates helpers** — `$pick` / `$sample` / `$unique` / `$repeat` / `$object` / `$vector` (et `$faker.helpers.*`) pour listes, objets JSON et tableaux float style embedding ; `count:n`, `count:min,max` ou `count:>=n` / `count:<=n` pour une longueur dynamique ; `$vector | dims:n` (option `normalize`) ; la résolution profonde réhydrate les feuilles structurées exactes.
- **Chips et autocomplétion** — Les variables connues s'affichent en chips ; suggestions pour clés d'environnement, alias, helpers et chemins `$faker.*` ; les clés non résolues restent visibles en `{{…}}`.
- **Export / Import** — Partagez les environnements en JSON depuis la barre d'outils de l'éditeur.
- **API Terminal** — Helpers `app.environment` et commandes `.env` / `.envs`.

#### Terminal ORDA

- **Dock bas** — Console et Terminal partagent un panneau redimensionnable avec onglets ; l'état ouvert et l'onglet actif sont mémorisés par profil.
- **REPL** — Exécutez des expressions `ds.*` avec coloration Monaco, autocomplétion catalogue (y compris dans `query("…")`) et historique ↑/↓.
- **Mode Code** — Éditez des snippets `.js` nommés ; Entrée = nouvelle ligne, Maj+Entrée (ou Exécuter) lance le code ; `⌘/Ctrl+Entrée` exécute toujours.
- **Pack de snippets** — Export/import gzip (`.orda-snippets.gz`) ; `.load` / `.run` / `.rm` avec complétion de noms.
- **Cellules de résultat** — Entités et sélections s'ouvrent en onglets ; binaires/images via les visionneuses existantes ; le trafic REST apparaît dans Console → Réseau.
- **Commandes point** — `.help`, `.exit`, etc. ; aide en rendu compact.

#### Export REST

- **Onglet Export REST** — Ouvrez-le depuis Outils ou la palette de commandes ; un assistant en quatre étapes (sélection → catégories → variables → aperçu) génère une collection v2.1 ou une spec OpenAPI 3.1 à partir du catalogue.
- **Catalogue de requêtes** — Auth, catalog, info, CRUD, entity sets, fonctions dataclass / entity / entitySelection, et singletons. Les méthodes non exposées et le login directory sont désactivés par défaut.
- **Aperçu** — Développez ou réduisez les dossiers (y compris tout développer / tout réduire), activez ou non les emojis, Maj+clic pour appliquer ou retirer un emoji par catégorie, et joignez éventuellement la documentation officielle REST 4D à chaque requête.
- **Client HTTP et Exécuteur de méthodes** — Exportez aussi la requête courante ou les favoris en collection ou OpenAPI.

#### Mobile

- **Apps iOS et Android** — Coques natives avec profils de connexion, HTTP sans CORS et mises en page safe-area.
- **Dock tactile** — Console/Terminal en overlay avec cibles plus grandes ; feuille de partage / Téléchargements pour les exports.
- **CI mobile** — GitHub Actions construit et publie les artefacts mobile (signature Android incluse).

#### Exécuteur de méthodes

- **Params et en-têtes Advanced** — Les onglets Params et Headers reprennent l’éditeur souligné du Client HTTP ; le paramètre de requête `$method=entityset` est prérempli pour les nouveaux appels (l’UI fait foi pour `$method`).
- **Erreurs dans le panneau résultat** — Les erreurs d’exécution, réseau et annulation s’affichent dans le panneau résultat (statut + corps d’erreur), comme dans le Client HTTP ; les messages de validation restent sous la configuration.
- **États vides** — Messages « sélectionnez une méthode » clairs dans les volets configuration et résultat tant qu’aucune méthode n’est choisie ; Exécuter reste désactivé (style outline) jusque-là.
- **Raccourcis mod-clic** — `⌘/Ctrl+clic` ouvre un onglet Exécuteur de méthodes en arrière-plan ; `⌘/Ctrl+Maj+clic` ouvre l’appel dans le Client HTTP (liste, favoris, historique et sélecteur de méthodes).

#### Console et médias

- **Aperçu d'image réseau** — Prévisualisation inline des réponses image dans le journal réseau.
- **Requêtes en cours** — Le corps de la requête est publié dès le démarrage de l’appel ; **Ouvrir dans le Client HTTP** est disponible tant que l’entrée est encore pending.
- **Annulation des requêtes** — Interrompez les appels réseau en cours depuis la console lorsque c’est pris en charge.
- **Partage / enregistrement** — Partage ou téléchargement des objets binaires et images via les chemins natifs (corrige les échecs de téléchargement WKWebView iOS).

#### Favoris et création

- **Favoris Client HTTP** — Enregistrez, rouvrez et exportez des favoris (y compris export collection / OpenAPI).
- **Favoris Exécuteur de méthodes** — Même flux de favoris pour les appels de méthodes.
- **Création d'entités par lot** — Créez plusieurs entités avec des champs templated résolus depuis la carte d'environnement active.

#### Outils de sélection

- **Points d'entrée** — Menu Outils de sélection sur les listes de dataclass, menus contextuels d'onglets, résultats de sélection de l’Exécuteur, ensembles liés, lignes Home et palette de commandes.
- **Analyser** — Valeurs distinctes (`$distinct`) et cartes de calcul (`$compute=$all`) pour un attribut de l’ensemble d’entités courant.
- **Exporter / Importer** — Formats extensibles (JSON, JSON REST, JSONL, CSV, TSV, SQL, XML, YAML, Markdown, HTML) ; l’import crée ou met à jour des enregistrements dans la dataclass ouverte.
- **Anonymiser** — Correspondance de champs avec templates Faker (filtres `|`), valeurs fixes, conserver ou vider ; retirer des champs du plan pour les omettre des payloads ; graine optionnelle ; aperçu style Client HTTP avec mode auto-détecté.
- **Actions d’anonymisation** — Télécharger les données anonymisées, importer comme nouveaux enregistrements, ou écraser les champs mappés de l’ensemble courant (confirmation ; `__KEY` / `__STAMP` plus champs modifiés uniquement).

#### UX

- **À propos** — Dialogue d'informations depuis le chrome mobile/desktop.
- **Hauteurs de panneaux** — Liste d'entités et volets de requête mémorisent la hauteur ; hauteur console bornée si le viewport est inconnu.
- **Client HTTP (mobile)** — Résumé requête/réponse adapté aux écrans étroits.
- **Notifications du Client HTTP** — Les réponses contenant `__WEBFORM.__NOTIFICATION` affichent la même alerte typée et le même stamp de privilège que les résultats de l’Exécuteur de méthodes.
- **Décodage d'URL console** — Option pour décoder les URL percent-encoded dans le journal réseau.
- **Sélecteur d'environnement** — Contrôle du pied de page affiné pour le profil / la base actifs et l'accès à Gérer.
- **Éditeurs de requête partagés** — Le Client HTTP et l’Exécuteur de méthodes partagent l’éditeur clé/valeur Params/Headers pour une édition Advanced cohérente.

### Documentation

- Pages guide [Console](https://midrissi.github.io/4d-dataexplorer/guide/console.html), [Terminal ORDA](https://midrissi.github.io/4d-dataexplorer/guide/terminal.html), [Export REST](https://midrissi.github.io/4d-dataexplorer/guide/rest-export.html), [Variables d'environnement](https://midrissi.github.io/4d-dataexplorer/guide/environments.html), [Outils de sélection](https://midrissi.github.io/4d-dataexplorer/guide/selection-tools.html) et [Applications mobiles](https://midrissi.github.io/4d-dataexplorer/guide/mobile.html).
- La galerie d'accueil inclut l'éditeur d'environnements et des captures mises à jour (clair / sombre).

### Corrections

- **Téléchargements iOS** — Les exports de snippets et de réglages utilisent le chemin natif au lieu de `<a download>` (NSURLError -3000).
- **Restauration de l'onglet** — Recharger avec le Terminal ouvert ne force plus la Console.
- **Révélation d'entité** — L'ouverture d'une entité depuis le terminal utilise la clé primaire au lieu d'un `$filter` sur `__KEY`.
- **Paramètres de requête vides** — L’export collection désactive par défaut les `$filter` / `$orderby` / `$attributes` vides pour qu’ils ne soient pas envoyés tant qu’ils ne sont pas renseignés.
- **Réponses OpenAPI** — Les specs exportées listent les statuts REST 4D connus (200, 401, 402, 404, 500).
- **Onglet Docs de la collection** — La documentation de chaque requête reprend le markdown officiel 4D REST, pas seulement un résumé.
- **Filtres dynamiques** — Genre et bornes numériques / dates sur `$faker.*` passent par les options Faker.
- **Alias Faker `userName`** — Les suggestions et templates acceptent le nom Faker v8 `internet.userName` comme alias de `internet.username`.
- **Templates docs** — Le guide Environnements et l'accueil affichent les exemples `{{…}}` sans casser le compilateur Vue de VitePress.
- **Résultats obsolètes Exécuteur** — Un échec ou une annulation ne laisse plus un succès précédent sous la configuration ; les erreurs remplacent la vue résultat.
- **Corps réseau pending** — Les entrées console n’attendent plus la fin de l’appel pour afficher le corps de requête sortant.

## 1.3.x

### Aperçu

La version `1.3.x` introduit Data Explorer Desktop (Tauri + React) avec des profils de connexion persistants, une integration native de la fenetre et des mises a jour automatiques dans l'application ; ajoute un Exécuteur de méthodes pour sélectionner et lancer les méthodes ORDA exposées avec des arguments typés et des vues de résultat spécialisées ; ajoute un Client HTTP pour composer et rejouer des requêtes REST ; ajoute un panneau Console redimensionnable qui journalise les messages applicatifs et chaque requête HTTP ; améliore la gestion des connexions multiplateformes avec la prise en charge de HTTP fetch ; étend la gestion des données binaires avec le chargement différé des BLOB ; optimise le rendu du graphe de structure pour les schémas volumineux ; et affine le retour visuel de l'assistant ainsi que l'accessibilité dans les zones clés de navigation.

### Fonctionnalités

#### Application desktop

- **Data Explorer Desktop** - Nouvelle application desktop construite avec Tauri et React.
- **Connexions enregistrées** - Créez, modifiez et réutilisez des profils de connexion depuis un écran de connexion desktop dédié.
- **Fenêtre et thème** - Meilleur comportement au démarrage sur desktop avec synchronisation améliorée de l'état de la fenêtre et du thème.
- **Mise a jour automatique** - Détection des mises a jour et gestion du processus dans l'application avec notifications de mise a jour.
- **Pipeline de release macOS** - Le workflow GitHub Actions empaquette et téléverse désormais les artefacts desktop macOS.

#### Exécuteur de méthodes

- **Onglet Exécuteur de méthodes** - Configurez et exécutez les méthodes 4D exposées depuis un onglet dédié ; ouvrez-le depuis la palette de commandes, les vues classe de données et entité, ou l'assistant.
- **Appels selon la portée** - Appelez des méthodes de datastore, classe de données, entité et sélection d'entités avec des expressions de style ORDA (`ds.method`, `ds.Table.method`, `ds.Table.entity(key).method`, `ds.Table.sel(key).method`).
- **Arguments d'exécution** - Construisez des arguments positionnels comme valeurs personnalisées, références d'entité ou sélections d'entités ; réordonnez, dupliquez et validez avant l'exécution.
- **Historique des exécutions** - Rouvrez les exécutions réussies récentes ; ⌘/Ctrl+clic sur les clés dans l'historique pour ouvrir l'entité ou la sélection associée.
- **Vues de résultat** - Inspectez les résultats JSON, ou ouvrez automatiquement des aperçus spécialisés d'entité et de sélection d'entités.

#### Panneau Console

- **Console ancrée** - Ouvrez un panneau inférieur redimensionnable depuis la barre d'état ou la palette de commandes pour inspecter les journaux pendant la navigation.
- **Journalisation réseau** - Chaque requête HTTP est enregistrée avec méthode, URL, statut, durée et taille de réponse ; développez une entrée pour inspecter les en-têtes et les corps (secrets masqués).
- **Ouvrir dans le Client HTTP** - Rejouez une entrée réseau capturée dans le Client HTTP avec méthode, URL, en-têtes et corps assainis lorsque disponibles.
- **Filtres et contrôles** - Filtrez par niveau (tous, log, info, avertissement, erreur, réseau), réduisez toutes les lignes développées et effacez le tampon en mémoire ; les compteurs d'erreurs et d'avertissements apparaissent sur le bouton Console du pied de page.

#### Client HTTP

- **Onglet Client HTTP** - Composez et envoyez des requêtes HTTP depuis Outils ou la palette de commandes, vers le serveur courant ou une origine personnalisée.
- **Éditeur de requête** - Autocomplétion méthode / serveur / chemin ; Params, Headers, Body (aucun / formulaire / urlencoded / brut / binaire) et Settings.
- **Inspecteur de réponse** - Statut, timing, taille, en-têtes, cookies et corps après Envoyer (⌘/Ctrl+Entrée).
- **Options desktop** - Contrôle de session cookies, timeouts, limites de redirection, et option TLS skip sur les builds desktop.

#### Connectivité et chargement des données

- **Prise en charge de HTTP fetch** - Les flux de connexion ont été mis a jour pour prendre en charge les appels HTTP basés sur fetch selon l'environnement.
- **Chargement différé des BLOB** - Le chargement des objets binaires est amélioré avec une récupération des BLOB a la demande dans le visualiseur d'entités.

#### Graphe de structure et interface

- **Réactivité du graphe** - Le rendu du graphe de classes de données utilise désormais une estimation des dimensions des cartes et des comparaisons optimisées pour le surlignage des nœuds.
- **Retour d'activité de l'assistant** - Le chatbot affiche maintenant des états de chargement plus clairs et un indicateur sparkles animé.
- **Améliorations d'accessibilité** - Barre latérale, barre d'onglets, palette de commandes et vues associées ont reçu des améliorations d'accessibilité et un raffinement sémantique des classes.

### Corrections

- **Rendu des objets binaires** - Amélioration des chemins de gestion binaire différée dans le visualiseur d'entités.
- **Stabilité de l'édition des connexions** - Les flux desktop d'édition et de mise a jour de connexion ont été stabilisés.
- **Mise en page HTML de couverture** - Ajustement des marges internes dans la sortie HTML de couverture générée pour un rendu plus propre.

## 1.2.x

### Aperçu

La version `1.2.x` ajoute un gestionnaire visuel de champs pour les attributs affichés (y compris les chemins de relation imbriqués), le chargement à la demande des entités liées, un panneau de métadonnées regroupées, un visualiseur d'objets binaires, une assistance du langage ORDA dans le générateur de requêtes, un assistant IA avec outils configurables, un générateur de schéma JSON, des éditeurs de code basés sur Monaco, la gestion des ensembles d’entités dans le générateur de requêtes, l’éditeur de métadonnées assistant, des mutations d’entités en lot, l’authentification par clé d’accès, des améliorations du graphe de structure dont l’ajustement à la vue, des états de chargement et d’erreur du visualiseur d’entités et des améliorations de l’interface de l’assistant et du générateur de requêtes.

### Fonctionnalités

#### Champs affichés

- **Gestionnaire de champs** — Choisissez et réordonnez les attributs affichés dans les colonnes du tableau et les fiches depuis un seul panneau ; la sélection est conservée par onglet.
- **Attributs imbriqués** — Explorez les relations pour sélectionner des attributs imbriqués (par ex. `company.name`, et plus profond) à la fois pour la vue tableau et la vue fiches.
- **Sélection par vue** — Conservez des listes d'attributs indépendantes pour la vue tableau et la vue fiches ; glissez pour réordonner.
- **Enregistrer par défaut** — Enregistrez la sélection actuelle comme valeur par défaut pour une dataclass, ou rétablissez les valeurs par défaut.

#### Visualiseur d'entités

- **Relations différées** — Chargez les entités et sélections d'entités liées à la demande, directement dans les vues formulaire et arborescence.
- **Tableau partagé pour les relations** — Les sélections d'entités liées s'affichent dans la même grille de données que la vue tableau.
- **Panneau de métadonnées** — Les attributs système de 4D (`__KEY`, `__STAMP`, `__TIMESTAMP`, …) sont regroupés dans un panneau de métadonnées repliable.
- **Tous les attributs dans le détail** — La vue détaillée affiche toujours tous les attributs, même lorsque le gestionnaire de champs limite les colonnes ou les champs de la liste.
- **Champs de fiche extensibles** — Les fiches affichent un aperçu des premiers champs avec un bouton Afficher plus / Afficher moins.
- **Visualiseur d'objets binaires** — Prévisualisez les objets binaires privés de 4D (blobs et images) directement dans le formulaire et le visualiseur d'entités.
- **Indicateurs de chargement** — Les données d'entité affichent un état de chargement pendant la récupération, y compris les entités et sélections d'entités liées.
- **Récupération après erreur** — Lorsque les entités ne peuvent pas être chargées, un panneau intégré permet de réessayer, de réinitialiser la requête ou de fermer l'onglet.
- **Images différées** — Les attributs image se chargent à la demande dans les cellules du tableau et le visualiseur d'entités.
- **Info-bulles de cellule** — Survolez les cellules tronquées du tableau pour afficher la valeur complète.
- **Tri des colonnes** — Triez les tableaux d'entités par colonne, y compris les tableaux d'entités liées.

#### Éditeur de métadonnées assistant

- **Onglet Éditeur de métadonnées** — Documentez les classes de données, attributs, méthodes, singletons et méthodes de catalogue pour l’assistant IA ; ouvrir depuis Outils, la palette de commandes ou la barre d’outils de l’assistant.
- **Génération de descriptions par IA** — Générez des descriptions champ par champ ou en lot pour toutes les entrées manquantes ; génération optionnelle de schéma JSON pour les paramètres de méthode.
- **Indicateurs de descriptions manquantes** — Mettez en évidence les éléments sans documentation ; filtrez la barre latérale pour n’afficher que les entrées manquantes.
- **Éditeur JSON** — Modifiez l’objet métadonnées complet directement ; exportez le schéma en fichier JSON.

#### Assistant IA

- **Panneau assistant** — Panneau de chat IA avec des outils pour interroger les données, naviguer entre les onglets, exécuter des commandes et contrôler l’interface.
- **Outils configurables** — Activez ou désactivez les espaces de noms et les outils individuels de l’assistant dans Paramètres.
- **Mode plein écran** — Agrandissez le panneau assistant pour remplir l’écran ; appuyez sur Échap pour quitter.
- **Copier la trace** — Copiez la trace d’activité de l’assistant dans le presse-papiers depuis le panneau d’activité.
- **Diagrammes Mermaid** — Rendu et gestion d’erreurs améliorés pour les graphiques Mermaid dans les réponses de l’assistant.

#### Opérations sur les données

- **Création/mise à jour d’entités en lot** — Créez ou mettez à jour plusieurs entités en un appel via l’API et les outils datastore de l’assistant.

#### Générateur de schéma JSON

- **Onglet Générateur de schéma** — Éditeur visuel pour construire des schémas JSON ; ouvrir depuis le menu Outils dans le pied de page.
- **Éditeur d’objets** — Développer ou réduire les objets imbriqués et configurer les attributs du schéma.

#### Éditeur de code

- **Éditeur Monaco** — Éditeurs de code et JSON avec complétion de schéma dans toute l’application.
- **Préférences de l’éditeur** — Configurez la taille de police, le retour à la ligne et la barre d’outils dans Paramètres ; s’applique aux formulaires d’entités, au générateur de schéma et aux autres éditeurs.

#### Requêtes et ensembles d’entités

- **Assistance du langage ORDA** — Complétion de code, informations au survol et aide à la signature pour les expressions de requête ORDA, avec résolution des types à partir du catalogue.
- **Opérations sur les sélections d'entités** — Combinez des sélections d'entités (`AND` / `OR` / `EXCEPT` / `INTERSECT`) et libérez des sélections d'entités via l'API et les outils de l'assistant.
- **Liaison d’ensemble d’entités** — Liez les onglets de classes de données à des ID d’ensemble d’entités serveur existants ; chargez, copiez et modifiez les ID dans le générateur de requêtes.
- **Mise en cache des ensembles** — Les ensembles d’entités côté serveur sont mis en cache et libérés à la fermeture des onglets.
- **Paramètres de filtre** — Définissez des paramètres de filtre typés pour les expressions de filtre paramétrées dans le générateur de requêtes.

#### Profils et apparence

- **Changement rapide de profil** — Changez de profil depuis le pied de page sans ouvrir Paramètres ; l’icône et la couleur du profil sont affichées dans la barre de statut.
- **Apparence par profil** — Personnalisez chaque profil avec une icône et une couleur.
- **Thème Qodly** — Nouveau thème Qodly en modes clair et sombre (typographie Roboto, accent violet).

#### Graphe de structure

- **Signatures de méthodes** — Signatures de méthodes mises en évidence dans le graphe de structure.
- **Indicateurs d’attributs** — Attributs exposés et poignées de relation visuellement mis en évidence sur les nœuds de classes de données.
- **Navigation stable** — Les clics répétés sur une classe de données ne vident plus le graphe ; la fenêtre d’affichage est validée et la sélection des nœuds est conservée.
- **Ajuster à la vue** — Recentrez et zoomez le graphe de structure pour afficher tous les nœuds visibles.

#### Authentification et localisation

- **Connexion par clé d’accès** — Connectez-vous avec une clé d’accès REST lorsque le serveur exige une authentification.
- **Internationalisation** — Traductions étendues pour l’interface de l’assistant, le générateur de requêtes et d’autres composants.

### Corrections

- **État des onglets** — L'état par onglet reste cohérent lors du changement d'onglet (synchronisation de l'onglet actif) ; l’ID de l’onglet actif est validé avant la fermeture des onglets ou la définition des ID d’ensemble d’entités.
- **Raccourcis de profil** — Les raccourcis sont fusionnés avec les valeurs par défaut au chargement des profils, évitant qu’une liste vide n’efface les raccourcis configurés.
- **Fenêtre du graphe de structure** — Le panoramique/zoom programmatique ne corrompt plus l’état de la fenêtre enregistré.
- **Édition en vue liste** — Édition en ligne désactivée en vue liste pour éviter les modifications accidentelles.
- **Ordre d'activation des onglets** — La fermeture d'un onglet active désormais l'onglet le plus récemment utilisé au lieu de l'onglet adjacent.

---

## 1.1.x

### Aperçu

La version `1.1.x` propose un 4D REST Explorer amélioré pour parcourir les classes de données et les entités, avec gestion des profils, barre de recherche globale, modes rapides de la palette de commandes, améliorations des raccourcis clavier, sélection de langue et un ensemble de fonctionnalités centrées sur la consultation et l’édition des données.

### Fonctionnalités

#### Accueil et navigation

- **Écran d’accueil** — Résumé de votre base : statistiques, nombre d’entités et graphiques (`bar` et `pie`)
- **Barre de recherche globale** — Barre de recherche dans l’en-tête. Cliquez ou donnez le focus pour ouvrir la palette de commandes.
- **Palette de commandes** — Ouvrir des entités par ID, ouvrir une classe de données ou rechercher des classes depuis un seul endroit
- **Commandes récentes** — Les commandes récemment utilisées apparaissent en haut de la palette avec une icône horloge. L’historique est enregistré par profil.
- **Modes rapides** — Depuis la recherche de la palette, taper `:` pour aller à une entité par index, `>` pour choisir une classe (vue structure), `/` pour ouvrir les données d’une classe, ou `@` pour changer d’onglet.
- **Raccourcis clavier** — Raccourcis personnalisés pour les actions courantes (`palette de commandes`, `paramètres`, `thème`, `structure`, etc.)
- **Interface à onglets** — Épingler des onglets, fermer les autres ou les réorganiser par glisser-déposer
- **Onglet Notes de version** — Ouvrir les notes de version depuis la barre de statut (pied de page). Le contenu s’affiche dans un onglet dédié
- **Langue** — Choisir la langue de l’app (anglais, français, espagnol) depuis la barre de statut (pied de page). Les notes de version et l’interface suivent la langue sélectionnée.

#### Classe de données et entités

- **Navigateur de classes** — Travaillez avec plusieurs classes de données dans des onglets et basculez entre disposition cartes et tableau
- **Constructeur de requêtes** — Filtre, tri, sélection de champs et limite. Panneau de requête repliable
- **Liste d’entités** — Liste paginée dans un panneau redimensionnable avec badges du nombre d’entités
- **Visionneuse d’entité** — Consultez le `JSON` de l’entité et créez, modifiez ou supprimez des entités (sauf si le mode lecture seule est activé)
- **Aller à l’entité** — Ouvrir une entité par ID depuis la palette de commandes

#### Structure et visualisation

- **Graphe de structure** — Diagramme des classes de données et de leurs liens. Mettre en surbrillance une classe depuis le menu contextuel de l’onglet
- **Apparence des classes** — Couleurs et icônes par classe dans Paramètres

#### Profils et paramètres

- **Gestion des profils** — Créez, renommez, dupliquez et supprimez des profils dans Paramètres. Chaque profil a son propre thème, raccourcis, largeur de la barre latérale et autres préférences.
- **Import / export** — Exportez tous les paramètres ou des profils sélectionnés vers un fichier JSON, et importez des paramètres ou profils depuis un fichier (avec la possibilité de choisir quels profils importer).

#### Paramètres et apparence

- **Apparence** — Plusieurs thèmes de couleurs (`Slate`, `Tangerine`, `Violet Bloom`, `Graphite`, `Aurora`, etc.)
- **Mode clair / sombre** — Suivre le système ou basculer manuellement
- **Vues par défaut** — Choisir la disposition par défaut (`cartes` ou `tableau`) et la taille de page pour les nouveaux onglets de classe
- **Raccourcis clavier** — Activer ou désactiver les raccourcis et consulter la liste complète dans Paramètres
- **Apparence des classes** — Définir couleurs et icônes pour chaque classe dans la barre latérale et les onglets

#### Raccourcis clavier

- **Fenêtre des raccourcis** — La section « Affichage » est maintenant affichée en deux colonnes pour une disposition plus compacte.
- **Enregistrer en accord** — L’option « Enregistrer en accord (séquence de deux touches) » est maintenant dans la fenêtre d’enregistrement de raccourci, pour choisir le mode accord lors de l’enregistrement.
- **Affichage des raccourcis** — Les boutons de raccourci dans Paramètres utilisent un style plus léger, avec bordure uniquement (sans fond) pour les touches.

#### Sécurité et modes

- **Mode lecture seule** — Interrupteur dans l’en-tête pour désactiver création/édition/suppression pour une navigation sûre
- **Mode édition** — Créer, modifier et supprimer des entités lorsqu’il est activé

### Technique

- **API REST 4D** — Communication avec votre serveur 4D en REST et prise en charge des paramètres de requête standard
- **État persistant** — Onglets, largeur de la barre latérale et paramètres stockés par base (`BASEID`)
