@echo off
rem =====================================================================
rem  Atelier du Journal officiel - serveur (Node/Express + SQLite)
rem  Demarre le vrai serveur (authentification et donnees partagees),
rem  au lieu de l'ancien demarrer-atelier.bat qui ouvrait la version
rem  hors ligne servie par un simple serveur de fichiers Python.
rem
rem  Usage : placer ce fichier dans le dossier atelier-jo-api (a cote de
rem  package.json), puis double-cliquer dessus.
rem =====================================================================

cd /d "%~dp0"
title Atelier du Journal officiel - serveur

if not exist "package.json" (
  echo.
  echo   ERREUR : ce fichier doit rester dans le dossier atelier-jo-api,
  echo   a cote de package.json.
  echo.
  pause
  exit /b
)

where node >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo   Node.js n'est pas installe sur ce poste.
  echo.
  echo   Installez-le depuis https://nodejs.org/ ^(version LTS^),
  echo   puis relancez ce fichier.
  echo.
  pause
  exit /b
)

if not exist "node_modules" (
  echo.
  echo   Premiere installation : mise en place des dependances...
  echo   ^(cette etape ne se refait pas aux demarrages suivants^)
  echo.
  call npm install
  if not %errorlevel%==0 (
    echo.
    echo   ERREUR : l'installation des dependances a echoue. Voir le
    echo   detail ci-dessus.
    echo.
    pause
    exit /b
  )
)

if not exist ".env" (
  echo.
  echo   ERREUR : le fichier .env est absent - le serveur ne peut pas
  echo   demarrer sans lui ^(il contient la cle de session, propre a ce
  echo   poste^).
  echo.
  echo   A faire une seule fois, voir README.md, section "Mise en route" :
  echo     1. copier .env.example vers .env
  echo     2. generer une cle avec :
  echo        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  echo        et la coller dans .env, apres JWT_SECRET=
  echo     3. creer le premier compte administrateur avec :
  echo        npm run creer-admin -- "Nom complet" admin@archives.cm "un mot de passe d'au moins 10 caracteres"
  echo.
  pause
  exit /b
)

echo.
echo   Serveur demarre. L'atelier s'ouvre dans votre navigateur.
echo.
echo   Les autres postes du reseau local s'y connectent via l'adresse IP
echo   de cette machine ^(voir README.md pour la retrouver^).
echo.
echo   NE FERMEZ PAS CETTE FENETRE pendant que le serveur doit rester
echo   disponible pour les autres postes.
echo   Pour arreter : fermez cette fenetre ou appuyez sur Ctrl+C.
echo.

start "" "http://localhost:3000/"
call npm start
