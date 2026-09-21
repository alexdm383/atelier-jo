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
