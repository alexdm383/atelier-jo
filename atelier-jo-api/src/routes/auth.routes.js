const express = require('express');
const db = require('../db');
const { verifier } = require('../auth/hash');
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

router.post('/deconnexion', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

router.get('/moi', authentifier, (req, res) => {
  res.json(req.user);
});

module.exports = router;
