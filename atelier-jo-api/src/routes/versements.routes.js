const express = require('express');
const db = require('../db');
const { authentifier, autoriser } = require('../auth/middleware');

const router = express.Router();

const ROLES_INTERNES = ['admin', 'controleur', 'operateur', 'stagiaire'];

// Limite du bordereau papier scanné joint, appliquée ici côté serveur — un
// client n'est pas digne de confiance pour faire respecter sa propre limite,
// celle-ci n'existait jusqu'ici que dans atelier-jo-complet.html. Même
// valeur que là-bas (10 Mo, en octets réels du fichier une fois décodé).
const LIMITE_BORDEREAU_OCTETS = 10 * 1024 * 1024;

function octets(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// Vérifie et normalise le bordereau_pdf envoyé par le client. Renvoie
// { ok:true, valeur } ou { ok:false, message } — ne fait jamais confiance
// au champ `taille` déclaré par le client : la taille qui compte est celle
// du contenu réellement décodé depuis le dataUrl.
function validerBordereau(bordereau) {
  if (bordereau == null) return { ok: true, valeur: null };
  if (typeof bordereau !== 'object' || !bordereau.dataUrl) {
    return { ok: false, message: 'bordereau_pdf doit être un objet {nom,taille,dataUrl}.' };
  }
  const virgule = bordereau.dataUrl.indexOf(',');
  const base64 = virgule >= 0 ? bordereau.dataUrl.slice(virgule + 1) : bordereau.dataUrl;
  const octetsReels = Buffer.byteLength(base64, 'base64');
  if (octetsReels > LIMITE_BORDEREAU_OCTETS) {
    return {
      ok: false,
      message: `Le bordereau joint fait ${octets(octetsReels)} : la limite est de 10 Mo. Réduisez la résolution du scan ou compressez le PDF avant de le joindre.`,
    };
  }
  return { ok: true, valeur: { nom: bordereau.nom || '', taille: octetsReels, dataUrl: bordereau.dataUrl } };
}

function versVue(ligne) {
  return {
    id: ligne.id,
    cree_par: ligne.cree_par,
    operateur: ligne.operateur,
    materiel: ligne.materiel,
    serie: ligne.serie,
    numero_jo: ligne.numero_jo,
    cote: ligne.cote,
    prescriptions: ligne.prescriptions ? JSON.parse(ligne.prescriptions) : null,
    bordereau_pdf: ligne.bordereau_pdf ? JSON.parse(ligne.bordereau_pdf) : null,
    lot: ligne.lot ? JSON.parse(ligne.lot) : [],
    cree_le: ligne.cree_le,
    modifie_le: ligne.modifie_le,
  };
}

router.use(authentifier, autoriser(...ROLES_INTERNES));

router.get('/', (req, res) => {
  const lignes = db.prepare('SELECT * FROM versements ORDER BY modifie_le DESC').all();
  res.json(lignes.map(versVue));
});

router.get('/:id', (req, res) => {
  const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Versement introuvable.' });
  res.json(versVue(ligne));
});

router.post('/', (req, res) => {
  const { operateur, materiel, serie, numero_jo, cote, prescriptions, bordereau_pdf, lot } = req.body || {};

  const verif = validerBordereau(bordereau_pdf);
  if (!verif.ok) return res.status(400).json({ erreur: verif.message });

  const resultat = db.prepare(`
    INSERT INTO versements (cree_par, operateur, materiel, serie, numero_jo, cote, prescriptions, bordereau_pdf, lot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    operateur || null,
    materiel || null,
    serie || null,
    numero_jo || null,
    cote || null,
    prescriptions ? JSON.stringify(prescriptions) : null,
    verif.valeur ? JSON.stringify(verif.valeur) : null,
    lot ? JSON.stringify(lot) : JSON.stringify([]),
  );

  const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(resultat.lastInsertRowid);
  res.status(201).json(versVue(ligne));
});

// L'auteur (cree_par) ou l'admin uniquement — un autre agent interne ne doit
// pas pouvoir modifier le lot repris par un collègue.
router.patch('/:id', (req, res) => {
  const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(req.params.id);
  if (!ligne) return res.status(404).json({ erreur: 'Versement introuvable.' });

  const estAuteur = ligne.cree_par === req.user.id;
  if (!estAuteur && req.user.role !== 'admin') {
    return res.status(403).json({ erreur: "Ce versement n'est modifiable que par son auteur ou un administrateur." });
  }

  const { operateur, materiel, serie, numero_jo, cote, prescriptions, bordereau_pdf, lot } = req.body || {};

  let bordereauJson = ligne.bordereau_pdf;
  if (bordereau_pdf !== undefined) {
    const verif = validerBordereau(bordereau_pdf);
    if (!verif.ok) return res.status(400).json({ erreur: verif.message });
    bordereauJson = verif.valeur ? JSON.stringify(verif.valeur) : null;
  }

  db.prepare(`
    UPDATE versements SET
      operateur = ?, materiel = ?, serie = ?, numero_jo = ?, cote = ?,
      prescriptions = ?, bordereau_pdf = ?, lot = ?, modifie_le = datetime('now')
    WHERE id = ?
  `).run(
    operateur !== undefined ? operateur : ligne.operateur,
    materiel !== undefined ? materiel : ligne.materiel,
    serie !== undefined ? serie : ligne.serie,
    numero_jo !== undefined ? numero_jo : ligne.numero_jo,
    cote !== undefined ? cote : ligne.cote,
    prescriptions !== undefined ? JSON.stringify(prescriptions) : ligne.prescriptions,
    bordereauJson,
    lot !== undefined ? JSON.stringify(lot) : ligne.lot,
    req.params.id,
  );

  res.json(versVue(db.prepare('SELECT * FROM versements WHERE id = ?').get(req.params.id)));
});

module.exports = router;
