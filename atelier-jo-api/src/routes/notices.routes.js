const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authentifier, authentifierOptionnel, autoriser } = require('../auth/middleware');

const router = express.Router();

function versVue(ligne) {
  // Reconstitue l'objet notice complet (champs FIDS) à partir du blob JSON,
  // en réinjectant les colonnes indexées qui font foi (au cas où le JSON stocké
  // serait désynchronisé d'une future modification manuelle en base).
  const donnees = JSON.parse(ligne.donnees);
  return {
    ...donnees,
    id: ligne.id,
    statut: ligne.statut,
    auteur_id: ligne.auteur_id,
    controleur_id: ligne.controleur_id,
    date_soumission: ligne.date_soumission,
    date_controle: ligne.date_controle,
    motif_controle: ligne.motif_controle,
  };
}

// ── Lecture ──────────────────────────────────────────────────────────
// Ouverte à tous (catalogue public), mais le filtre dépend du rôle :
// un visiteur anonyme ou le rôle "chercheur" ne voit que les notices validées ;
// un agent interne authentifié voit tout, y compris les brouillons — c'est
// voulu pour le travail de catalogage, mais ça veut dire que cette route ne
// doit être appelée avec une session que depuis l'espace Administration.
router.get('/', authentifierOptionnel, (req, res) => {
  const estAgentInterne = req.user && req.user.role !== 'chercheur';
  const lignes = estAgentInterne
    ? db.prepare('SELECT * FROM notices ORDER BY modifie_le DESC').all()
    : db.prepare("SELECT * FROM notices WHERE statut = 'validee' ORDER BY modifie_le DESC").all();
  res.json(lignes.map(versVue));
});

router.get('/:id', authentifierOptionnel, (req, res) => {
  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Notice introuvable.' });
  const estAgentInterne = req.user && req.user.role !== 'chercheur';
  if (ligne.statut !== 'validee' && !estAgentInterne) {
    return res.status(404).json({ erreur: 'Notice introuvable.' }); // 404, pas 403 : ne pas révéler qu'elle existe
  }
  res.json(versVue(ligne));
});

// ── Création ─────────────────────────────────────────────────────────
// Toute personne interne peut créer un brouillon ; naît toujours en
// 'brouillon', jamais directement publiable, quoi que le client envoie.
router.post('/', authentifier, autoriser('admin', 'controleur', 'operateur', 'stagiaire'), (req, res) => {
  const id = 'N' + crypto.randomUUID();
  const donnees = { ...req.body }; // les champs FIDS bruts venant du formulaire
  delete donnees.statut; delete donnees.id; // jamais acceptés du client

  db.prepare(`
    INSERT INTO notices (id, statut, type, numero, intitule_fr, date_signature, auteur_id, donnees)
    VALUES (?, 'brouillon', ?, ?, ?, ?, ?, ?)
  `).run(id, donnees.type || null, donnees.numero || null, donnees.intitule_fr || null,
         donnees.date_signature || null, req.user.id, JSON.stringify(donnees));

  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
  res.status(201).json(versVue(ligne));
});

// ── Modification de contenu ──────────────────────────────────────────
// L'auteur peut modifier tant que c'est en 'brouillon'. Une fois 'a_valider'
// ou 'validee', seul l'admin peut encore toucher au contenu (correction
// exceptionnelle tracée) — un opérateur ne doit pas pouvoir modifier en
// douce une notice qu'un contrôleur est en train d'examiner ou a déjà validée.
router.patch('/:id', authentifier, (req, res) => {
  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Notice introuvable.' });

  const estAuteur = ligne.auteur_id === req.user.id;
  const autorise = req.user.role === 'admin' || (estAuteur && ligne.statut === 'brouillon');
  if (!autorise) {
    return res.status(403).json({ erreur: "Cette notice n'est plus modifiable par vous à ce stade." });
  }

  const donnees = { ...JSON.parse(ligne.donnees), ...req.body };
  delete donnees.statut; delete donnees.id;

  db.prepare(`
    UPDATE notices SET type=?, numero=?, intitule_fr=?, date_signature=?, donnees=?, modifie_le=datetime('now')
    WHERE id=?
  `).run(donnees.type || null, donnees.numero || null, donnees.intitule_fr || null,
         donnees.date_signature || null, JSON.stringify(donnees), req.params.id);

  res.json(versVue(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

// ── Circuit de validation ────────────────────────────────────────────

router.post('/:id/soumettre', authentifier, (req, res) => {
  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Notice introuvable.' });
  if (ligne.auteur_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ erreur: "Seul l'auteur peut soumettre cette notice." });
  }
  if (ligne.statut !== 'brouillon') {
    return res.status(409).json({ erreur: `Impossible : la notice est actuellement "${ligne.statut}".` });
  }
  db.prepare(`
    UPDATE notices SET statut='a_valider', date_soumission=datetime('now'), motif_controle=NULL, modifie_le=datetime('now')
    WHERE id=?
  `).run(req.params.id);
  res.json(versVue(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

router.post('/:id/valider', authentifier, autoriser('controleur', 'admin'), (req, res) => {
  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Notice introuvable.' });
  if (ligne.statut !== 'a_valider') {
    return res.status(409).json({ erreur: `Impossible : la notice est actuellement "${ligne.statut}", pas "a_valider".` });
  }
  db.prepare(`
    UPDATE notices SET statut='validee', controleur_id=?, date_controle=datetime('now'), modifie_le=datetime('now')
    WHERE id=?
  `).run(req.user.id, req.params.id);
  res.json(versVue(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

router.post('/:id/rejeter', authentifier, autoriser('controleur', 'admin'), (req, res) => {
  const { motif } = req.body || {};
  if (!motif || !motif.trim()) return res.status(400).json({ erreur: 'Un motif est requis pour rejeter une notice.' });

  const ligne = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Notice introuvable.' });
  if (ligne.statut !== 'a_valider') {
    return res.status(409).json({ erreur: `Impossible : la notice est actuellement "${ligne.statut}", pas "a_valider".` });
  }
  db.prepare(`
    UPDATE notices SET statut='brouillon', controleur_id=?, date_controle=datetime('now'), motif_controle=?, modifie_le=datetime('now')
    WHERE id=?
  `).run(req.user.id, motif.trim(), req.params.id);
  res.json(versVue(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

// ── Suppression ──────────────────────────────────────────────────────
// Réservée à l'admin, et notice par notice : pas de route "tout effacer"
// côté serveur — si elle doit exister, elle s'écrit explicitement et se
// journalise, jamais comme un simple DELETE en boucle exposé au client.
router.delete('/:id', authentifier, autoriser('admin'), (req, res) => {
  const resultat = db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  if (resultat.changes === 0) return res.status(404).json({ erreur: 'Notice introuvable.' });
  res.status(204).end();
});

module.exports = router;
