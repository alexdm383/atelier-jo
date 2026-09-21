# Archive — première version, sans serveur

Les trois fichiers de ce dossier sont la toute première version de l'Atelier du
Journal officiel : pensée pour un poste totalement isolé, sans réseau ni
serveur — ouverture par simple double-clic sur `atelier-jo-hors-ligne.html`
(ou via `demarrer-atelier.bat`, qui ne fait que servir ce fichier statique par
un petit serveur Python local pour contourner les restrictions du navigateur
en `file://`), avec `partager-sur-reseau-local.bat` pour l'exposer aux autres
postes du même réseau.

## Pourquoi archivés et non supprimés

Traçabilité, et parce qu'un contexte futur pourrait légitimement exiger un
fonctionnement sans aucun serveur (poste isolé, absence durable de réseau,
démonstration hors ligne). Le code reste disponible pour repartir de cette
base si ce besoin se présente.

## Pourquoi ils ne sont plus maintenus

Aucun des correctifs des deux volets de travail menés sur
`atelier-jo-complet.html` n'a été porté ici :

- **Volet 1** (corrections du prototype seul) : rien n'a été reporté — les
  bugs déjà corrigés côté `atelier-jo-complet.html` (rendu par lots,
  sauvegarde en mode mémoire, bordereau PDF, fiabilité de la lecture PDF,
  vocabulaire, import JSON non validé) sont toujours présents ici tels
  quels.
- **Volet 2** (backend réel) : ces fichiers reposent entièrement sur un
  modèle **sans serveur** — rôles déclaratifs choisis librement sans mot de
  passe, aucune authentification vérifiée, aucune autorisation réelle. C'est
  précisément ce que le volet 2 a remplacé côté `atelier-jo-complet.html` par
  une authentification et des rôles réellement contrôlés côté serveur
  (`atelier-jo-api`).

## À ne pas redéployer tel quel

Ces fichiers **ne doivent pas être remis en service sans reprendre tout le
travail des deux volets depuis le début** — en particulier, ne jamais les
présenter comme équivalents ou interchangeables avec `atelier-jo-complet.html`
servi par `atelier-jo-api` : le premier n'offre aucune sécurité réelle, le
second en offre une, garantie côté serveur.

Le point d'entrée actuel du projet est `atelier-jo-api/demarrer-serveur.bat`
(voir `atelier-jo-api/README.md`).
