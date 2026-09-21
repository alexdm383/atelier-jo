const bcrypt = require('bcrypt');

const TOURS = 12; // coût du hachage — 12 est un bon compromis sécurité/temps de réponse en 2026

async function hacher(motDePasseClair) {
  return bcrypt.hash(motDePasseClair, TOURS);
}

async function verifier(motDePasseClair, hache) {
  return bcrypt.compare(motDePasseClair, hache);
}

module.exports = { hacher, verifier };
