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
app.use('/api/comptes', require('./routes/comptes.routes'));
app.use('/api/versements', require('./routes/versements.routes'));
// Pas de préfixe commun unique (POST /api/commandes, GET /api/mes-commandes,
// etc.) : le routeur définit ses chemins complets sous /api directement.
app.use('/api', require('./routes/commandes.routes'));

// Sert atelier-jo-complet.html (à placer dans public/) sur la même origine
// que l'API : c'est ce qui évite le blocage "contenu mixte" du navigateur.
//
// Copié automatiquement ici plutôt que depuis le script de démarrage .bat :
// cette copie s'applique quel que soit la façon dont le serveur est lancé
// (le .bat, npm start, un gestionnaire de processus...), alors qu'un .bat
// ne protège que ce chemin de lancement précis. Seulement si absent — un
// public/index.html déjà présent (personnalisé, ou déjà copié) n'est jamais écrasé.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_DEST = path.join(PUBLIC_DIR, 'index.html');
if (!fs.existsSync(INDEX_DEST)) {
  const SOURCE = path.join(__dirname, '..', '..', 'atelier-jo-complet.html');
  if (fs.existsSync(SOURCE)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.copyFileSync(SOURCE, INDEX_DEST);
    console.log(`public/index.html absent : copié automatiquement depuis ${SOURCE}.`);
  } else {
    console.warn(
      `ATTENTION : public/index.html est absent et ${SOURCE} est introuvable. ` +
      'Le serveur démarre quand même mais ne sert aucune page pour le moment — ' +
      "placez atelier-jo-complet.html à la racine du dépôt, ou copiez-le vous-même vers public/index.html."
    );
  }
}
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Atelier du Journal officiel — serveur démarré sur http://0.0.0.0:${PORT}`);
  console.log('Accessible depuis les autres postes du réseau local à l\'adresse IP de cette machine.');
});
