const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET absent ou trop court (32 caractères minimum) dans .env. " +
    "Générez-en un avec : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

const DUREE = '12h'; // une session expire en fin de journée de travail

function signer(charge) {
  return jwt.sign(charge, SECRET, { expiresIn: DUREE });
}

function verifierJeton(jeton) {
  return jwt.verify(jeton, SECRET); // lève une exception si invalide/expiré
}

module.exports = { signer, verifierJeton };
