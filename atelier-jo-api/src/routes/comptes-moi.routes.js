const express = require('express');
const db = require('../db');
const { authentifier } = require('../auth/middleware');

const router = express.Router();

// Distinct de comptes.routes.js (réservé entièrement à l'admin, voir son
// router.use(authentifier, autoriser('admin')) en tête de fichier) : cette route
// ne touche jamais que le compte de l'appelant lui-même (req.user.id), jamais un
// autre compte ni un autre champ — pas besoin d'être admin pour ça.
router.patch('/moi/theme-stage', authentifier, (req, res) => {
  if (req.user.role !== 'stagiaire') {
    return res.status(403).json({ erreur: 'Le thème de stage ne concerne que le rôle stagiaire.' });
  }
  const { theme_stage } = req.body || {};
  if (!theme_stage || !String(theme_stage).trim()) {
    return res.status(400).json({ erreur: 'Le thème de stage est requis.' });
  }

  // À usage unique : une fois renseigné, plus jamais écrasé silencieusement depuis
  // cet écran — une correction ultérieure suppose une route admin dédiée, qui
  // n'existe pas encore (hors périmètre de cette passe).
  const compte = db.prepare('SELECT theme_stage FROM comptes WHERE id = ?').get(req.user.id);
  if (compte && compte.theme_stage) {
    return res.status(409).json({
      erreur: 'Le thème de stage a déjà été renseigné et ne peut plus être modifié depuis cet écran.',
    });
  }

  const valeur = String(theme_stage).trim();
  db.prepare('UPDATE comptes SET theme_stage = ? WHERE id = ?').run(valeur, req.user.id);
  res.json({ theme_stage: valeur });
});

module.exports = router;
