require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json({ limit: '15mb' })); // le bordereau PDF joint passe en base64 dans le JSON
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/notices', require('./routes/notices.routes'));
// Monté avant comptes.routes.js (réservé admin) : /api/comptes/moi/theme-stage est
// la seule route de ce préfixe accessible à un compte non-admin (le sien uniquement).
app.use('/api/comptes', require('./routes/comptes-moi.routes'));
app.use('/api/comptes', require('./routes/comptes.routes'));
app.use('/api/versements', require('./routes/versements.routes'));
// Pas de préfixe commun unique (POST /api/commandes, GET /api/mes-commandes,
// etc.) : le routeur définit ses chemins complets sous /api directement.
app.use('/api', require('./routes/commandes.routes'));

// Sert atelier-jo-complet.html (à placer dans public/) sur la même origine
// que l'API : c'est ce qui évite le blocage "contenu mixte" du navigateur.
//
// Synchronisé automatiquement ici plutôt que depuis le script de démarrage
// .bat : ça s'applique quel que soit la façon dont le serveur est lancé (le
// .bat, npm start, un gestionnaire de processus...), alors qu'un .bat ne
// protège que ce chemin de lancement précis.
//
// "Absent" seul ne suffit pas comme condition : une fois la première copie
// faite, une modification ultérieure de atelier-jo-complet.html ne serait
// plus jamais reprise, silencieusement. On compare donc le CONTENU des deux
// fichiers à chaque démarrage :
//   - contenu identique            → rien à faire, rien à dire.
//   - contenu différent, source plus récente (mtime)
//                                   → la source a été mise à jour depuis la
//                                     dernière copie : on recopie, et on le dit.
//   - contenu différent, source pas plus récente
//                                   → public/index.html a probablement été
//                                     modifié directement (pas via cette copie) :
//                                     on ne l'écrase jamais, mais on avertit
//                                     clairement au lieu de rester silencieux.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_DEST = path.join(PUBLIC_DIR, 'index.html');
function synchroniserFrontend() {
  const SOURCE = path.join(__dirname, '..', '..', 'atelier-jo-complet.html');
  if (!fs.existsSync(SOURCE)) {
    if (!fs.existsSync(INDEX_DEST)) {
      console.warn(
        `ATTENTION : public/index.html est absent et ${SOURCE} est introuvable. ` +
        'Le serveur démarre quand même mais ne sert aucune page pour le moment — ' +
        "placez atelier-jo-complet.html à la racine du dépôt, ou copiez-le vous-même vers public/index.html."
      );
    }
    return; // rien à comparer sans source : on laisse public/index.html tel quel, silencieusement.
  }

  if (!fs.existsSync(INDEX_DEST)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.copyFileSync(SOURCE, INDEX_DEST);
    console.log(`public/index.html absent : copié automatiquement depuis ${SOURCE}.`);
    return;
  }

  const contenuSource = fs.readFileSync(SOURCE);
  const contenuDest = fs.readFileSync(INDEX_DEST);
  if (contenuSource.equals(contenuDest)) return; // déjà synchronisé, rien à signaler.

  const mtimeSource = fs.statSync(SOURCE).mtimeMs;
  const mtimeDest = fs.statSync(INDEX_DEST).mtimeMs;
  if (mtimeSource > mtimeDest) {
    fs.copyFileSync(SOURCE, INDEX_DEST);
    console.log(`public/index.html mis à jour automatiquement : ${SOURCE} a été modifié depuis la dernière copie.`);
  } else {
    console.warn(
      `ATTENTION : public/index.html diffère de ${SOURCE} mais n'est pas plus ancien que lui — ` +
      'il a probablement été modifié directement plutôt que régénéré depuis la source. ' +
      'Laissé tel quel pour ne pas écraser ce changement ; supprimez-le vous-même si vous voulez ' +
      'qu\'il soit resynchronisé automatiquement au prochain démarrage.'
    );
  }
}
synchroniserFrontend();

// pdf.min.js et pdf.worker.min.js sont vendorisés (commités dans public/, voir README) pour que la
// lecture des PDF marche même derrière un pare-feu qui bloquerait cdnjs — le CDN ne doit servir que
// de repli si ces fichiers sont absents, jamais l'inverse (voir atelier-jo-complet.html). Ce repli
// silencieux a longtemps été le cas réel en pratique : averti clairement ici pour que ça ne se
// reproduise plus sans que personne ne le remarque.
['pdf.min.js', 'pdf.worker.min.js'].forEach((nom) => {
  if (!fs.existsSync(path.join(PUBLIC_DIR, nom))) {
    console.warn(
      `ATTENTION : public/${nom} est absent. La lecture des PDF dépendra du CDN cdnjs à chaque ` +
      'chargement de page, silencieusement pour l\'utilisateur — ce qui échouera derrière un ' +
      "pare-feu qui bloque ce domaine. Voir README.md pour vendoriser ce fichier."
    );
  }
});

// Même principe pour l'OCR (voir README.md) : tesseract.min.js a un repli CDN comme pdf.min.js,
// mais le worker, le composant WebAssembly et les données de langue fra+eng sont vérifiés
// séparément par le frontend lui-même à l'exécution (fichiersOcrLocauxDisponibles()) — avertir
// ici seulement sur leur absence au démarrage, pour que ce ne soit jamais découvert en silence.
['tesseract.min.js', 'tesseract-worker.min.js', 'tesseract-core.wasm.js', 'fra.traineddata.gz', 'eng.traineddata.gz'].forEach((nom) => {
  if (!fs.existsSync(path.join(PUBLIC_DIR, nom))) {
    console.warn(
      `ATTENTION : public/${nom} est absent. La reconnaissance OCR dépendra d'un CDN externe (et de ` +
      'ses propres à-coups) à chaque utilisation, silencieusement pour l\'utilisateur, avec un message ' +
      "d'erreur seulement si ce CDN est injoignable. Voir README.md pour vendoriser ce fichier."
    );
  }
});

app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Atelier du Journal officiel — serveur démarré sur http://0.0.0.0:${PORT}`);
  console.log('Accessible depuis les autres postes du réseau local à l\'adresse IP de cette machine.');
});
