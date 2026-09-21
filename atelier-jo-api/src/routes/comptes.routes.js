const express = require('express');
const db = require('../db');
const { hacher } = require('../auth/hash');
const { authentifier, autoriser } = require('../auth/middleware');

const router = express.Router();

const ROLES_VALIDES = ['admin', 'controleur', 'operateur', 'stagiaire'];

// Tout l'onglet est réservé à l'admin : pas de route de gestion des comptes
// accessible à un autre rôle, y compris en lecture seule.
router.use(authentifier, autoriser('admin'));

function versVue(ligne) {
  // Ne renvoie jamais mot_de_passe_hache, même à l'admin.
  return {
    id: ligne.id,
    nom: ligne.nom,
    email: ligne.email,
    role: ligne.role,
    actif: ligne.actif,
    cree_le: ligne.cree_le,
  };
}

router.get('/', (req, res) => {
  const lignes = db.prepare('SELECT * FROM comptes ORDER BY cree_le DESC').all();
  res.json(lignes.map(versVue));
});

router.post('/', async (req, res) => {
  const { nom, email, mot_de_passe, role } = req.body || {};
  if (!nom || !email || !mot_de_passe || !role) {
    return res.status(400).json({ erreur: 'Nom, email, mot de passe et rôle sont requis.' });
  }
  if (!ROLES_VALIDES.includes(role)) {
    return res.status(400).json({ erreur: `Rôle invalide. Rôles acceptés : ${ROLES_VALIDES.join(', ')}.` });
  }
  if (mot_de_passe.length < 10) {
    return res.status(400).json({ erreur: 'Le mot de passe doit compter au moins 10 caractères.' });
  }

  const hache = await hacher(mot_de_passe);
  try {
    const resultat = db.prepare(
      'INSERT INTO comptes (nom, email, mot_de_passe_hache, role) VALUES (?, ?, ?, ?)'
    ).run(nom, email, hache, role);
    const ligne = db.prepare('SELECT * FROM comptes WHERE id = ?').get(resultat.lastInsertRowid);
    res.status(201).json(versVue(ligne));
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erreur: `Un compte existe déjà avec l'email ${email}.` });
    }
    throw e;
  }
});

router.patch('/:id/desactiver', (req, res) => {
  const id = Number(req.params.id);
  // Sinon un admin isolé pourrait se verrouiller lui-même hors du système.
  if (id === req.user.id) {
    return res.status(403).json({ erreur: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }
  const resultat = db.prepare('UPDATE comptes SET actif = 0 WHERE id = ?').run(id);
  if (resultat.changes === 0) return res.status(404).json({ erreur: 'Compte introuvable.' });
  res.json(versVue(db.prepare('SELECT * FROM comptes WHERE id = ?').get(id)));
});

router.patch('/:id/reactiver', (req, res) => {
  const id = Number(req.params.id);
  const resultat = db.prepare('UPDATE comptes SET actif = 1 WHERE id = ?').run(id);
  if (resultat.changes === 0) return res.status(404).json({ erreur: 'Compte introuvable.' });
  res.json(versVue(db.prepare('SELECT * FROM comptes WHERE id = ?').get(id)));
});

module.exports = router;
