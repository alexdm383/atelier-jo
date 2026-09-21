require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json({ limit: '15mb' })); // le bordereau PDF joint passe en base64 dans le JSON
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/notices', require('./routes/notices.routes'));
app.use('/api/comptes', require('./routes/comptes.routes'));
// TODO, même patron que notices.routes.js :
//   app.use('/api/versements', require('./routes/versements.routes'));
//   app.use('/api/commandes',  require('./routes/commandes.routes'));

// Sert atelier-jo-complet.html (à placer dans public/) sur la même origine
// que l'API : c'est ce qui évite le blocage "contenu mixte" du navigateur.
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Atelier du Journal officiel — serveur démarré sur http://0.0.0.0:${PORT}`);
  console.log('Accessible depuis les autres postes du réseau local à l\'adresse IP de cette machine.');
});
