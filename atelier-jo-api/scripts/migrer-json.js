// Usage : node scripts/migrer-json.js chemin/vers/atelier-jo-2026xxxx-xxxx.json admin@archives.cm
//
// Reprend un export JSON produit par le bouton "Enregistrer le travail" du
// prototype (structure {config, notices, queue, achats, ...}) et insère
// chaque notice dans la base. Le deuxième argument est l'email d'un compte
// déjà créé (via creer-admin.js) : les notices reprises n'ont pas d'auteur
// individuel traçable dans l'ancien format, on les rattache à ce compte, et
// on le note explicitement dans motif_controle pour que ce soit visible.
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const db = require('../src/db');

const STATUTS_CONNUS = new Set(['brouillon', 'a_valider', 'validee']);

function main() {
  const [cheminJson, emailResponsable] = process.argv.slice(2);
  if (!cheminJson || !emailResponsable) {
    console.error('Usage : node scripts/migrer-json.js chemin/export.json email@archives.cm');
    process.exit(1);
  }

  const responsable = db.prepare('SELECT id FROM comptes WHERE email = ?').get(emailResponsable);
  if (!responsable) {
    console.error(`Aucun compte avec l'email ${emailResponsable}. Créez-le d'abord avec creer-admin.js.`);
    process.exit(1);
  }

  const brut = JSON.parse(fs.readFileSync(cheminJson, 'utf8'));
  const notices = brut.notices || [];
  if (!notices.length) {
    console.log('Aucune notice trouvée dans ce fichier.');
    return;
  }

  const inserer = db.prepare(`
    INSERT INTO notices (id, statut, type, numero, intitule_fr, date_signature, auteur_id, donnees, motif_controle)
    VALUES (@id, @statut, @type, @numero, @intitule_fr, @date_signature, @auteur_id, @donnees, @motif_controle)
    ON CONFLICT(id) DO NOTHING
  `);

  let repris = 0, ignores = 0;
  const transaction = db.transaction((liste) => {
    for (const n of liste) {
      // Une notice sans statut, dans l'ancien format, était déjà visible dans le
      // catalogue public (voir le commentaire d'origine dans atelier-jo-complet.html) :
      // on la reprend donc comme 'validee', pas comme 'brouillon'.
      const statut = STATUTS_CONNUS.has(n.statut) ? n.statut : 'validee';
      const donnees = { ...n };
      delete donnees.statut; delete donnees.id;

      inserer.run({
        id: n.id || ('N' + crypto.randomUUID()),
        statut,
        type: n.type || null,
        numero: n.numero || null,
        intitule_fr: n.intitule_fr || null,
        date_signature: n.date_signature || null,
        auteur_id: responsable.id,
        donnees: JSON.stringify(donnees),
        motif_controle: 'Reprise automatique depuis un export JSON du prototype — auteur d\'origine non traçable.',
      });
      repris++;
    }
  });
  transaction(notices);

  console.log(`${repris} notice(s) reprise(s) dans la base (rattachées à ${emailResponsable}).`);
  if (ignores) console.log(`${ignores} ignorée(s).`);
}

main();
