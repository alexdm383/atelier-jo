// Usage : node scripts/creer-admin.js "Nom complet" email@archives.cm motdepasse
//
// Pourquoi un script séparé plutôt qu'une auto-inscription : un système où
// n'importe qui peut créer un compte admin depuis le formulaire de connexion
// n'a pas de sécurité du tout. Seul quelqu'un ayant un accès direct au serveur
// peut créer le premier compte ; ensuite, l'admin crée les autres comptes
// depuis l'interface (à construire — même patron que ce script).
require('dotenv').config();
const db = require('../src/db');
const { hacher } = require('../src/auth/hash');

async function main() {
  const [nom, email, motDePasse] = process.argv.slice(2);
  if (!nom || !email || !motDePasse) {
    console.error('Usage : node scripts/creer-admin.js "Nom complet" email@archives.cm motdepasse');
    process.exit(1);
  }
  if (motDePasse.length < 10) {
    console.error('Mot de passe trop court : 10 caractères minimum.');
    process.exit(1);
  }

  const hache = await hacher(motDePasse);
  try {
    db.prepare('INSERT INTO comptes (nom, email, mot_de_passe_hache, role) VALUES (?, ?, ?, ?)')
      .run(nom, email, hache, 'admin');
    console.log(`Compte administrateur créé : ${email}`);
  } catch (e) {
    if (String(e).includes('UNIQUE')) console.error(`Un compte existe déjà avec l'email ${email}.`);
    else throw e;
  }
}

main();
