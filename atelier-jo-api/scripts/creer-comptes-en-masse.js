// Usage :
//   node scripts/creer-comptes-en-masse.js comptes-a-creer.csv \
//        http://localhost:3000 admin@archivesnationales.cm "mot de passe admin"
//
// Lit un CSV (colonnes : nom,email,role), se connecte au serveur avec un compte
// admin déjà existant, puis crée chaque compte manquant via POST /api/comptes —
// jamais en écrivant directement dans la base : on passe par les mêmes
// vérifications que n'importe quel appel de l'interface (rôle valide, mot de
// passe suffisant, email déjà pris détecté proprement).
//
// Un mot de passe aléatoire et UNIQUE est généré pour chaque personne — jamais
// le même pour tout le monde. Le résultat (nom, email, rôle, mot de passe en
// clair) est écrit dans un second fichier, comptes-crees-MOTS-DE-PASSE.csv,
// à distribuer individuellement et en toute confidentialité, PUIS À SUPPRIMER
// de ce poste une fois la distribution faite — ne jamais le laisser traîner,
// ne jamais le committer dans un dépôt Git.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function motDePasseAleatoire() {
  // 12 caractères, alphabet sans caractères ambigus (pas de 0/O, 1/l/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomFillSync(new Uint8Array(12)))
    .map(o => alphabet[o % alphabet.length])
    .join('');
}

function parseCSV(texte) {
  const lignes = texte.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entetes = lignes[0].split(',');
  return lignes.slice(1).map(l => {
    const valeurs = l.split(',');
    const obj = {};
    entetes.forEach((e, i) => obj[e.trim()] = (valeurs[i] || '').trim());
    return obj;
  });
}

async function connexionAdmin(base, email, motDePasse) {
  const r = await fetch(`${base}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, mot_de_passe: motDePasse }),
  });
  if (!r.ok) {
    const corps = await r.json().catch(() => ({}));
    throw new Error(`Connexion admin refusée (${r.status}) : ${corps.erreur || 'raison inconnue'}`);
  }
  const cookie = r.headers.get('set-cookie');
  if (!cookie) throw new Error('Connexion acceptée mais aucun cookie de session reçu — vérifiez la configuration du serveur.');
  return cookie.split(';')[0]; // "session=...."
}

async function creerCompte(base, cookie, { nom, email, role, mot_de_passe }) {
  const r = await fetch(`${base}/api/comptes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ nom, email, role, mot_de_passe }),
  });
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, code: r.status, erreur: corps.erreur || 'erreur inconnue' };
  return { ok: true, compte: corps };
}

async function main() {
  const [cheminCsv, base, emailAdmin, motDePasseAdmin] = process.argv.slice(2);
  if (!cheminCsv || !base || !emailAdmin || !motDePasseAdmin) {
    console.error('Usage : node scripts/creer-comptes-en-masse.js comptes.csv http://ADRESSE:PORT admin@... "mot de passe"');
    process.exit(1);
  }

  const lignes = parseCSV(fs.readFileSync(cheminCsv, 'utf8'));
  console.log(`${lignes.length} compte(s) à traiter depuis ${path.basename(cheminCsv)}.\n`);

  console.log('Connexion avec le compte administrateur fourni...');
  const cookie = await connexionAdmin(base, emailAdmin, motDePasseAdmin);
  console.log('Connecté.\n');

  const resultats = [];
  let crees = 0, deja = 0, echecs = 0;

  for (const ligne of lignes) {
    const mdp = motDePasseAleatoire();
    process.stdout.write(`${ligne.email.padEnd(38)} (${ligne.role.padEnd(10)}) ... `);
    const res = await creerCompte(base, cookie, { ...ligne, mot_de_passe: mdp });

    if (res.ok) {
      console.log('créé.');
      crees++;
      resultats.push({ ...ligne, mot_de_passe: mdp, statut: 'créé' });
    } else if (res.code === 409) {
      console.log('déjà existant, ignoré.');
      deja++;
      resultats.push({ ...ligne, mot_de_passe: '(déjà existant — mot de passe inchangé)', statut: 'déjà existant' });
    } else {
      console.log(`ÉCHEC — ${res.erreur}`);
      echecs++;
      resultats.push({ ...ligne, mot_de_passe: '', statut: `échec : ${res.erreur}` });
    }
  }

  const cheminSortie = cheminCsv.replace(/\.csv$/i, '') + '-MOTS-DE-PASSE.csv';
  const entete = 'nom,email,role,mot_de_passe,statut\n';
  const corps = resultats.map(r =>
    [r.nom, r.email, r.role, r.mot_de_passe, r.statut].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  fs.writeFileSync(cheminSortie, entete + corps + '\n');

  console.log(`\n${crees} créé(s), ${deja} déjà existant(s), ${echecs} échec(s).`);
  console.log(`Mots de passe individuels écrits dans : ${cheminSortie}`);
  console.log('\n⚠ Ce fichier contient des mots de passe en clair.');
  console.log('  Distribuez chaque ligne individuellement et confidentiellement,');
  console.log('  puis SUPPRIMEZ ce fichier de ce poste. Ne le committez jamais dans Git.');
}

main().catch(e => { console.error('\nErreur :', e.message); process.exit(1); });
