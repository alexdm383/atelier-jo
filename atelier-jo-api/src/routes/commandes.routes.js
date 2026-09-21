const express = require('express');
const db = require('../db');
const { authentifier, autoriser } = require('../auth/middleware');

const router = express.Router();

// L'identité de l'acheteur n'est jamais dupliquée dans commandes : une seule
// jointure sur comptes au moment de l'affichage, jamais désynchronisée.
function versVue(ligne) {
  const compte = db.prepare('SELECT nom, email FROM comptes WHERE id = ?').get(ligne.compte_id);
  return {
    id: ligne.id,
    compte_id: ligne.compte_id,
    acheteur_nom: compte ? compte.nom : null,
    acheteur_email: compte ? compte.email : null,
    actes_ids: JSON.parse(ligne.actes_ids),
    offre: ligne.offre,
    statut: ligne.statut,
    motif_refus: ligne.motif_refus,
    validateur_id: ligne.validateur_id,
    date_validation: ligne.date_validation,
    cree_le: ligne.cree_le,
    modifie_le: ligne.modifie_le,
  };
}

// Un agent interne n'a pas à commander via cette route.
router.post('/commandes', authentifier, autoriser('chercheur'), (req, res) => {
  const { actes_ids, offre } = req.body || {};
  if (!Array.isArray(actes_ids) || !actes_ids.length) {
    return res.status(400).json({ erreur: 'actes_ids doit être une liste non vide.' });
  }

  // Chaque acte doit exister ET être validée — une commande ne peut jamais
  // porter sur un brouillon ou une fiche en attente de contrôle.
  const verifierActe = db.prepare("SELECT id FROM notices WHERE id = ? AND statut = 'validee'");
  const invalides = actes_ids.filter((id) => !verifierActe.get(id));
  if (invalides.length) {
    return res.status(400).json({
      erreur: `Ces actes n'existent pas ou ne sont pas validés : ${invalides.join(', ')}.`,
    });
  }

  const resultat = db.prepare(`
    INSERT INTO commandes (compte_id, actes_ids, offre) VALUES (?, ?, ?)
  `).run(req.user.id, JSON.stringify(actes_ids), offre || null);

  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ?').get(resultat.lastInsertRowid);
  res.status(201).json(versVue(ligne));
});

// Ne renvoie que les commandes du compte connecté — jamais par un paramètre
// d'URL contenant l'email en clair, uniquement via la session.
router.get('/mes-commandes', authentifier, autoriser('chercheur'), (req, res) => {
  const lignes = db.prepare('SELECT * FROM commandes WHERE compte_id = ? ORDER BY cree_le DESC').all(req.user.id);
  res.json(lignes.map(versVue));
});

router.get('/commandes', authentifier, autoriser('admin'), (req, res) => {
  const lignes = db.prepare('SELECT * FROM commandes ORDER BY cree_le DESC').all();
  res.json(lignes.map(versVue));
});

router.post('/commandes/:id/valider', authentifier, autoriser('admin'), (req, res) => {
  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Commande introuvable.' });
  if (ligne.statut !== 'en_attente') {
    return res.status(409).json({ erreur: `Impossible : la commande est actuellement "${ligne.statut}".` });
  }
  db.prepare(`
    UPDATE commandes SET statut='validee', validateur_id=?, date_validation=datetime('now'), modifie_le=datetime('now')
    WHERE id=?
  `).run(req.user.id, req.params.id);
  res.json(versVue(db.prepare('SELECT * FROM commandes WHERE id = ?').get(req.params.id)));
});

router.post('/commandes/:id/refuser', authentifier, autoriser('admin'), (req, res) => {
  const { motif } = req.body || {};
  if (!motif || !motif.trim()) return res.status(400).json({ erreur: 'Un motif est requis pour refuser une commande.' });

  const ligne = db.prepare('SELECT * FROM commandes WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Commande introuvable.' });
  if (ligne.statut !== 'en_attente') {
    return res.status(409).json({ erreur: `Impossible : la commande est actuellement "${ligne.statut}".` });
  }
  db.prepare(`
    UPDATE commandes SET statut='refusee', motif_refus=?, validateur_id=?, date_validation=datetime('now'), modifie_le=datetime('now')
    WHERE id=?
  `).run(motif.trim(), req.user.id, req.params.id);
  res.json(versVue(db.prepare('SELECT * FROM commandes WHERE id = ?').get(req.params.id)));
});

module.exports = router;
