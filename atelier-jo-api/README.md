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

Placer `atelier-jo-complet.html` (la version corrigée) dans `public/`, renommé `index.html` :
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
