# Atelier du Journal officiel — back-end

Testé : connexion, refus de rôle (403), circuit de validation complet,
visibilité publique limitée aux notices validées. Voir ADR-0004 pour le
contexte de cette décision.

## Mise en route

```bash
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # coller le résultat dans JWT_SECRET
```

`atelier-jo-complet.html` doit être servi depuis `public/index.html`. Le serveur
s'en charge tout seul au premier démarrage : si `public/index.html` est absent, il
copie automatiquement le fichier trouvé à la racine du dépôt (voir `server.js`) et
l'indique dans les logs. Ce n'est donc à faire à la main que si le fichier source
n'est pas au bon endroit (autre disposition de dossiers) :
```bash
cp /chemin/vers/atelier-jo-complet.html public/index.html
```

Créer le premier compte administrateur :
```bash
npm run creer-admin -- "Nom complet" admin@archives.cm "un mot de passe d'au moins 10 caractères"
```

Reprendre un export JSON existant du prototype (optionnel) :
```bash
npm run migrer-json -- chemin/vers/atelier-jo-2026xxxx.json admin@archives.cm
```

Démarrer :
```bash
npm start
```

Le serveur écoute sur toutes les interfaces (`0.0.0.0:3000` par défaut). Les
autres postes du réseau local s'y connectent via l'adresse IP de la machine
qui l'héberge, ex. `http://192.168.1.42:3000`. Pour trouver cette adresse :
`ipconfig` (Windows) ou `ip addr` (Linux).

## Lecteur PDF vendorisé

`public/pdf.min.js` et `public/pdf.worker.min.js` (pdf.js 3.11.174) sont commités
dans le dépôt, pas téléchargés au démarrage. Choix délibéré : le repli vers le CDN
cdnjs dans `atelier-jo-complet.html` n'existe que pour le cas où ces fichiers
manqueraient, jamais l'inverse — un poste d'archives publiques peut tourner
derrière un pare-feu qui bloque cdnjs sans bloquer l'accès aux autres postes du
réseau local, et un script de mise en place nécessitant une connexion au premier
démarrage réintroduirait exactement la dépendance réseau que la vendorisation
est censée éliminer. Le serveur avertit clairement au démarrage si l'un des deux
fichiers est absent de `public/` (voir `server.js`) plutôt que de laisser
`atelier-jo-complet.html` retomber sur le CDN sans le dire.

À mettre à jour en cas de changement de version de pdf.js : remplacer les deux
fichiers dans `public/`, et la ligne `pdf.js/3.11.174/` dans
`atelier-jo-complet.html` (script et repli CDN).

## Moteur OCR (Tesseract.js) vendorisé

Même principe que pour pdf.js, mais en deux temps :

- `public/tesseract.min.js` (Tesseract.js 5.1.1) est commité et chargé en local
  d'abord, avec un repli vers le CDN cdnjs si absent — exactement le même patron
  de balise `<script>` que `pdf.min.js`.
- Le worker (`public/tesseract-worker.min.js`), le composant WebAssembly
  (`public/tesseract-core.wasm.js`) et les données de langue français+anglais
  (`public/fra.traineddata.gz`, `public/eng.traineddata.gz`) sont des fichiers
  séparés, demandés seulement au premier lancement d'une reconnaissance OCR — pas
  au chargement de la page. `atelier-jo-complet.html` vérifie leur présence
  locale par une requête `HEAD` avant de les utiliser
  (`fichiersOcrLocauxDisponibles()`) ; s'ils manquent, Tesseract.js retombe sur
  son propre CDN par défaut (jsdelivr) pour ces fichiers précis — un repli déjà
  intégré à la bibliothèque, pas construit ici.

**Limite connue** : contrairement à `pdf.min.js`, il n'y a pas de bascule
automatique fichier-par-fichier vers un CDN si un seul des cinq fichiers
Tesseract venait à manquer alors que les autres sont présents — un scénario
improbable puisqu'ils sont vendorisés ensemble, mais possible (suppression
manuelle partielle, erreur de déploiement). Dans ce cas, l'échec remonte un
message clair invitant à utiliser « Reconnaître le texte — sans réseau » à la
place, plutôt qu'une erreur JavaScript brute — mais l'OCR reste indisponible
tant que les cinq fichiers ne sont pas tous réunis. Documenté ici plutôt que
laissé sans mention.

Le serveur avertit clairement au démarrage si l'un de ces cinq fichiers est
absent de `public/` (voir `server.js`).

## Démarrage sur poste Windows

`demarrer-serveur.bat`, dans ce dossier, joue pour ce serveur le rôle que
jouait `demarrer-atelier.bat` pour l'ancienne version hors ligne : double-clic,
message clair si Node.js n'est pas installé (avec le lien pour l'installer),
installation des dépendances au premier lancement si besoin, message clair si
`.env` n'a pas encore été préparé (voir « Mise en route » ci-dessus — ce
fichier contient la clé de session, il ne se génère pas tout seul), puis
démarrage du serveur sans jamais fermer la fenêtre pendant qu'il tourne.

Pour un poste qui doit rester serveur en continu (allumé en permanence,
accessible aux autres postes du réseau local), le faire démarrer tout seul à
l'allumage :

1. Ouvrir le dossier de démarrage de Windows : touche <kbd>Windows</kbd> + <kbd>R</kbd>,
   taper `shell:startup`, Entrée. (Pour que ça démarre même sans session
   ouverte sur ce compte, utiliser plutôt `shell:common startup` — droits
   administrateur requis pour y écrire.)
2. Dans ce dossier, créer un raccourci vers `demarrer-serveur.bat` (clic droit
   sur le fichier → Envoyer vers → Bureau, créer un raccourci, puis déplacer ce
   raccourci dans le dossier de démarrage — ou glisser-déposer directement en
   maintenant <kbd>Alt</kbd> pour forcer la création d'un raccourci plutôt
   qu'un déplacement).
3. Redémarrer le poste pour vérifier : une fenêtre de terminal doit s'ouvrir
   toute seule et le navigateur doit afficher le catalogue.

Le compte administrateur (voir « Mise en route ») doit avoir été créé au moins
une fois avant de compter sur ce démarrage automatique — ce n'est pas une
étape que `demarrer-serveur.bat` refait ou vérifie à chaque lancement.

## Ce qui reste à faire

Le patron (routes + middleware `authentifier`/`autoriser`) est posé avec
`notices`. À répliquer à l'identique pour :

- **`versements`** — création par tout agent interne ; pas de circuit de
  validation nécessaire a priori (à confirmer).
- **`commandes`** — création accessible sans session (rôle "public", capture
  du contact au moment de la commande, comme dans le prototype) ; validation
  réservée à `admin` (et au directeur si un rôle distinct est finalement
  retenu pour lui).
- **Gestion des comptes** (`POST /api/comptes`) — réservée à `admin`, pour
  créer les comptes opérateur/contrôleur/stagiaire depuis l'interface plutôt
  qu'en ligne de commande à chaque fois.
- **Export/import global** (`GET/POST /api/donnees`) — réservé à `admin`,
  reprend la logique de l'onglet Données du prototype mais en repassant par
  les mêmes contrôles de rôle que le reste de l'API.

Le fichier `atelier-jo-complet.html` doit ensuite être modifié pour que
`save()`/`load()` et les actions de validation appellent ces routes (`fetch`
avec `credentials:'include'` pour que le cookie de session parte avec chaque
requête) au lieu de lire/écrire `DB` directement en mémoire — c'est la partie
« socle commun » dont on a parlé, indépendante du choix d'hébergement.
