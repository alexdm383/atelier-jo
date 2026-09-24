// Usage :
//   node envoyer-identifiants.js comptes-a-creer-MOTS-DE-PASSE.csv --apercu
//   node envoyer-identifiants.js comptes-a-creer-MOTS-DE-PASSE.csv --un-seul destinataire@example.com
//   node envoyer-identifiants.js comptes-a-creer-MOTS-DE-PASSE.csv --envoyer
//
// Lit le CSV produit par creer-comptes-en-masse.js (colonnes : nom,email,role,
// mot_de_passe,statut) et envoie à chacun un email avec ses identifiants, via le
// SMTP iCloud (smtp.mail.me.com, mot de passe d'application — voir .env).
//
// Seules les lignes de statut "créé" sont envoyées : une ligne "déjà existant"
// n'a pas de mot de passe réel à communiquer (celui affiché n'est qu'un texte
// explicatif, jamais un vrai mot de passe), une ligne "échec : ..." ne correspond
// à aucun compte réellement créé. Les deux sont ignorées silencieusement en
// --apercu/--envoyer (mais comptées séparément dans le résumé), jamais envoyées.
//
// --apercu   : n'envoie rien. Affiche le sujet, le corps du premier email éligible,
//              et le nombre total qui serait envoyé.
// --un-seul  : envoie UN SEUL email, avec le contenu réel du premier destinataire
//              éligible, mais adressé à l'email fourni en argument (pas au vrai
//              destinataire) — pour vérifier le format et la délivrabilité sans
//              risquer d'écrire à une vraie personne pendant un test.
// --envoyer  : envoie à tous les destinataires éligibles, un par un, avec une
//              courte pause entre chaque envoi. Continue même si un envoi échoue ;
//              rapporte à la fin le nombre envoyé/échoué et le détail des échecs.

require('dotenv').config();
const fs = require('fs');
const nodemailer = require('nodemailer');

const LIBELLES_ROLE = {
  admin: 'Administrateur',
  controleur: 'Opérateur — contrôleur qualité',
  operateur: 'Opérateur',
  stagiaire: 'Stagiaire',
};

// Parseur minimal mais correct pour le format précis écrit par
// creer-comptes-en-masse.js : chaque champ entre guillemets, guillemet interne
// doublé ("" pour un "), champs séparés par une virgule hors guillemets.
function parseCSV(texte) {
  const lignes = [];
  let ligne = [], champ = '', dansGuillemets = false;
  const s = texte.replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dansGuillemets) {
      if (c === '"' && s[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') { dansGuillemets = false; }
      else { champ += c; }
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === ',') {
      ligne.push(champ); champ = '';
    } else if (c === '\n') {
      ligne.push(champ); champ = '';
      if (ligne.length > 1 || ligne[0] !== '') lignes.push(ligne);
      ligne = [];
    } else {
      champ += c;
    }
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }

  const entetes = lignes[0];
  return lignes.slice(1).map(l => {
    const obj = {};
    entetes.forEach((e, i) => obj[e] = l[i] || '');
    return obj;
  });
}

function sujetEtCorps(compte, lienAtelier) {
  const role = LIBELLES_ROLE[compte.role] || compte.role;
  const sujet = 'Vos identifiants — Atelier du Journal officiel';
  const corps = `Bonjour ${compte.nom},

Un compte vous a été créé sur l'Atelier du Journal officiel des Archives Nationales du Cameroun, avec le rôle ${role}.

Adresse   : ${lienAtelier}
Identifiant (email) : ${compte.email}
Mot de passe : ${compte.mot_de_passe}

Conservez ce mot de passe de façon confidentielle et ne le partagez avec personne. En cas de problème de connexion, contactez l'administrateur.

Archives Nationales du Cameroun`;
  return { sujet, corps };
}

function creerTransport() {
  const { ICLOUD_EMAIL, ICLOUD_MOT_DE_PASSE_APPLICATION } = process.env;
  if (!ICLOUD_EMAIL || !ICLOUD_MOT_DE_PASSE_APPLICATION) {
    throw new Error("ICLOUD_EMAIL et/ou ICLOUD_MOT_DE_PASSE_APPLICATION manquent dans .env.");
  }
  return nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false, // STARTTLS
    auth: { user: ICLOUD_EMAIL, pass: ICLOUD_MOT_DE_PASSE_APPLICATION },
  });
}

const attendre = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [cheminCsv, mode, arg] = process.argv.slice(2);
  if (!cheminCsv || !['--apercu', '--un-seul', '--envoyer'].includes(mode)) {
    console.error('Usage :');
    console.error('  node envoyer-identifiants.js fichier.csv --apercu');
    console.error('  node envoyer-identifiants.js fichier.csv --un-seul destinataire@example.com');
    console.error('  node envoyer-identifiants.js fichier.csv --envoyer');
    process.exit(1);
  }
  if (mode === '--un-seul' && !arg) {
    console.error('--un-seul requiert une adresse email en argument.');
    process.exit(1);
  }

  const lienAtelier = process.env.LIEN_ATELIER || '[adresse du serveur à compléter]';
  const comptes = parseCSV(fs.readFileSync(cheminCsv, 'utf8'));
  const eligibles = comptes.filter(c => c.statut === 'créé' && c.mot_de_passe);
  const dejaExistants = comptes.filter(c => c.statut === 'déjà existant').length;
  const echecs = comptes.filter(c => c.statut.startsWith('échec')).length;

  console.log(`${comptes.length} ligne(s) lues depuis ${cheminCsv}.`);
  console.log(`  ${eligibles.length} éligible(s) à l'envoi (statut "créé").`);
  console.log(`  ${dejaExistants} déjà existant(s) — ignoré(s), pas de mot de passe réel à envoyer.`);
  console.log(`  ${echecs} échec(s) à la création — ignoré(s), aucun compte réel derrière.\n`);

  if (!eligibles.length) {
    console.log('Aucun destinataire éligible. Rien à faire.');
    return;
  }

  if (mode === '--apercu') {
    const { sujet, corps } = sujetEtCorps(eligibles[0], lienAtelier);
    console.log(`LIEN_ATELIER utilisé : ${lienAtelier}\n`);
    console.log(`Exemple — destinataire réel : ${eligibles[0].nom} <${eligibles[0].email}>\n`);
    console.log(`Sujet : ${sujet}\n`);
    console.log('Corps :');
    console.log('--------------------------------------------------------------');
    console.log(corps);
    console.log('--------------------------------------------------------------\n');
    console.log(`${eligibles.length} email(s) seraient envoyés au total (aucun envoi réel en mode --apercu).`);
    return;
  }

  const transport = creerTransport();
  const { ICLOUD_EMAIL } = process.env;

  if (mode === '--un-seul') {
    const modele = eligibles[0];
    const { sujet, corps } = sujetEtCorps(modele, lienAtelier);
    console.log(`Envoi d'un seul email de test à ${arg} (contenu réel de ${modele.nom} <${modele.email}>, destinataire remplacé)...`);
    try {
      const info = await transport.sendMail({ from: ICLOUD_EMAIL, to: arg, subject: `[TEST] ${sujet}`, text: corps });
      console.log(`Envoyé. Identifiant du message : ${info.messageId}`);
    } catch (e) {
      console.error(`ÉCHEC — ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // --envoyer
  console.log(`Envoi réel à ${eligibles.length} destinataire(s)...\n`);
  let envoyes = 0;
  const echecsEnvoi = [];
  for (const compte of eligibles) {
    const { sujet, corps } = sujetEtCorps(compte, lienAtelier);
    process.stdout.write(`${compte.email.padEnd(40)} ... `);
    try {
      await transport.sendMail({ from: ICLOUD_EMAIL, to: compte.email, subject: sujet, text: corps });
      console.log('envoyé.');
      envoyes++;
    } catch (e) {
      console.log(`ÉCHEC — ${e.message}`);
      echecsEnvoi.push({ email: compte.email, erreur: e.message });
    }
    await attendre(500); // ménage le service SMTP, évite un blocage pour envoi trop rapide.
  }

  console.log(`\n${envoyes} envoyé(s), ${echecsEnvoi.length} échec(s) sur ${eligibles.length} tenté(s).`);
  if (echecsEnvoi.length) {
    console.log('\nÉchecs :');
    echecsEnvoi.forEach(e => console.log(`  ${e.email} — ${e.erreur}`));
  }
}

main().catch(e => { console.error('\nErreur :', e.message); process.exit(1); });
