const { verifierJeton } = require('./jwt');

// Lit le cookie de session et pose req.user = {id, nom, role}, ou null.
// Ne bloque jamais — c'est authentifier() ou autoriser() qui bloquent.
function lireUtilisateur(req) {
  const jeton = req.cookies && req.cookies.session;
  if (!jeton) return null;
  try {
    const charge = verifierJeton(jeton);
    return { id: charge.id, nom: charge.nom, role: charge.role };
  } catch (e) {
    return null; // jeton absent, expiré ou falsifié : traité comme anonyme
  }
}

// À utiliser sur les routes du catalogue public : n'exige rien, mais expose
// req.user si une session valide existe (pour distinguer agent interne / visiteur
// dans la même route, ex. filtrer les notices non publiées).
function authentifierOptionnel(req, res, next) {
  req.user = lireUtilisateur(req);
  next();
}

// À utiliser sur toute route réservée aux agents internes : bloque si pas de
// session valide.
function authentifier(req, res, next) {
  req.user = lireUtilisateur(req);
  if (!req.user) return res.status(401).json({ erreur: 'Authentification requise.' });
  next();
}

// À chaîner après authentifier(). Exemple : autoriser('controleur','admin')
function autoriser(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erreur: 'Authentification requise.' });
    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({
        erreur: `Action réservée à : ${rolesAutorises.join(', ')}.`
      });
    }
    next();
  };
}

module.exports = { authentifier, authentifierOptionnel, autoriser };
