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
CREATE TABLE IF NOT EXISTS comptes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                 TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  mot_de_passe_hache  TEXT NOT NULL,
  role                TEXT NOT NULL CHECK(role IN ('admin','controleur','operateur','stagiaire')),
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
`);

module.exports = db;
