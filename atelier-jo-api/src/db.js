// ══════════════════════════════════════════════════════════════════
// Connexion et schéma SQLite.
//
// Choix assumé (voir ADR-0004) : la notice complète est stockée en JSON
// dans la colonne `donnees`, pas éclatée champ par champ. Le modèle FIDS
// du prototype évolue au gré des besoins archivistiques ; l'éclater en
// colonnes obligerait à une migration de schéma à chaque ajout de champ.
// Les colonnes indexées ci-dessous ne dupliquent que ce dont on a besoin
// pour filtrer/trier sans désérialiser le JSON de chaque ligne.
// ══════════════════════════════════════════════════════════════════
const path = require('path');
const Database = require('better-sqlite3');

const CHEMIN_DB = process.env.CHEMIN_DB || path.join(__dirname, '..', 'atelier-jo.db');
const db = new Database(CHEMIN_DB);

// WAL : plusieurs lecteurs simultanés sans bloquer les écritures — largement
// suffisant pour un usage à quelques agents, pas besoin de PostgreSQL ici.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- 'chercheur' ajouté à la étape 3 (comptes publics) : SQLite ne permet pas
-- d'altérer une contrainte CHECK en place, donc CREATE TABLE IF NOT EXISTS ne
-- suffit pas seul pour un fichier .db déjà créé avec l'ancienne contrainte —
-- un tel fichier doit être supprimé et recréé (pas de préservation de
-- données nécessaire, rien n'est en production à ce stade).
CREATE TABLE IF NOT EXISTS comptes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                 TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  mot_de_passe_hache  TEXT NOT NULL,
  role                TEXT NOT NULL CHECK(role IN ('admin','controleur','operateur','stagiaire','chercheur')),
  actif               INTEGER NOT NULL DEFAULT 1,
  cree_le             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notices (
  id               TEXT PRIMARY KEY,
  statut           TEXT NOT NULL DEFAULT 'brouillon'
                     CHECK(statut IN ('brouillon','a_valider','validee')),
  type             TEXT,
  numero           TEXT,
  intitule_fr      TEXT,
  date_signature   TEXT,
  auteur_id        INTEGER REFERENCES comptes(id),
  controleur_id    INTEGER REFERENCES comptes(id),
  date_soumission  TEXT,
  date_controle    TEXT,
  motif_controle   TEXT,
  donnees          TEXT NOT NULL,          -- JSON complet de la notice (champs FIDS)
  cree_le          TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notices_statut ON notices(statut);
CREATE INDEX IF NOT EXISTS idx_notices_auteur ON notices(auteur_id);

CREATE TABLE IF NOT EXISTS versements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cree_par       INTEGER REFERENCES comptes(id),
  operateur      TEXT,
  materiel       TEXT,
  serie          TEXT,
  numero_jo      TEXT,
  cote           TEXT,
  prescriptions  TEXT,                    -- JSON
  bordereau_pdf  TEXT,                    -- JSON {nom,taille,dataUrl} ou NULL
  lot            TEXT,                    -- JSON : métadonnées des fichiers du lot (rang/nom/taille/empreinte), jamais leur contenu binaire
  cree_le        TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_versements_cree_par ON versements(cree_par);

-- Pas de colonnes contact/nom en dur ici : l'identité de l'acheteur se lit
-- par jointure sur comptes (nom, email) au moment de l'affichage — une seule
-- source de vérité, jamais désynchronisée si le compte change de nom.
CREATE TABLE IF NOT EXISTS commandes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  compte_id      INTEGER NOT NULL REFERENCES comptes(id),
  actes_ids      TEXT NOT NULL,             -- JSON : liste d'ids de notices
  offre          TEXT,
  statut         TEXT NOT NULL DEFAULT 'en_attente'
                   CHECK(statut IN ('en_attente','validee','refusee')),
  motif_refus    TEXT,
  validateur_id  INTEGER REFERENCES comptes(id),
  date_validation TEXT,
  cree_le        TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commandes_compte ON commandes(compte_id);
`);

module.exports = db;
