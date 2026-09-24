const express = require('express');
const db = require('../db');
const { hacher, verifier } = require('../auth/hash');
const { signer } = require('../auth/jwt');
const { authentifier } = require('../auth/middleware');

const router = express.Router();

const OPTIONS_COOKIE = {
  httpOnly: true,      // inaccessible à un script — résiste au vol de jeton par XSS
  sameSite: 'lax',     // suffisant en réseau local à origine unique
  secure: process.env.COOKIE_SECURE === 'true', // true seulement si servi en HTTPS
  maxAge: 12 * 60 * 60 * 1000,
};

router.post('/connexion', async (req, res) => {
  const { email, mot_de_passe } = req.body || {};
  if (!email || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Email et mot de passe requis.' });
  }

  const compte = db.prepare('SELECT * FROM comptes WHERE email = ? AND actif = 1').get(email);
  // Message volontairement identique dans les deux cas (compte absent / mot de passe
  // faux) : ne pas révéler si un email existe dans la base.
  const echec = () => res.status(401).json({ erreur: 'Identifiants incorrects.' });

  if (!compte) return echec();
  const valide = await verifier(mot_de_passe, compte.mot_de_passe_hache);
  if (!valide) return echec();

  const jeton = signer({ id: compte.id, nom: compte.nom, role: compte.role });
  res.cookie('session', jeton, OPTIONS_COOKIE);
  res.json({ id: compte.id, nom: compte.nom, role: compte.role });
});

// Ouvert à tous, sans authentifier() : c'est la seule façon dont un visiteur
// devient un rôle interne si on n'y prend pas garde — le rôle est donc FORCÉ
// à 'chercheur' ici, quoi que le corps de la requête contienne. N'accepte
// jamais un rôle envoyé par le client sur cette route.
router.post('/inscription', async (req, res) => {
  const { nom, email, mot_de_passe } = req.body || {};
  if (!nom || !email || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Nom, email et mot de passe sont requis.' });
  }
  if (mot_de_passe.length < 10) {
    return res.status(400).json({ erreur: 'Le mot de passe doit compter au moins 10 caractères.' });
  }

  const hache = await hacher(mot_de_passe);
  let compte;
  try {
    const resultat = db.prepare(
      "INSERT INTO comptes (nom, email, mot_de_passe_hache, role) VALUES (?, ?, ?, 'chercheur')"
    ).run(nom, email, hache);
    compte = db.prepare('SELECT * FROM comptes WHERE id = ?').get(resultat.lastInsertRowid);
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erreur: `Un compte existe déjà avec l'email ${email}.` });
    }
    throw e;
  }

  // Connecte automatiquement après inscription, comme /connexion.
  const jeton = signer({ id: compte.id, nom: compte.nom, role: compte.role });
  res.cookie('session', jeton, OPTIONS_COOKIE);
  res.status(201).json({ id: compte.id, nom: compte.nom, role: compte.role });
});

router.post('/deconnexion', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

router.get('/moi', authentifier, (req, res) => {
  // req.user (issu du jeton signé à la connexion) n'a que {id,nom,role} : theme_stage
  // peut changer sans qu'un nouveau jeton soit émis, donc lu frais en base ici plutôt
  // qu'ajouté au jeton — id/nom/role renvoyés restent exactement ceux du jeton, inchangés.
  const ligne = db.prepare('SELECT theme_stage FROM comptes WHERE id = ?').get(req.user.id);
  res.json({ ...req.user, theme_stage: (ligne && ligne.theme_stage) || null });
});

module.exports = router;
