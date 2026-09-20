@echo off
rem =====================================================================
rem  Atelier du Journal officiel — Archives Nationales du Cameroun
rem  Mise a disposition sur le RESEAU LOCAL
rem
rem  Ce poste sert l'atelier aux autres postes de la salle.
rem  Les collegues ouvrent simplement l'adresse affichee ci-dessous.
rem
rem  ATTENTION : chaque poste garde SON PROPRE catalogue.
rem  Le partage porte sur l'application, pas sur les donnees.
rem  Pour reunir le travail de plusieurs agents : chacun exporte son
rem  fichier JSON depuis l'onglet Donnees, et l'un d'eux les importe.
rem
rem  Usage : placer dans le meme dossier que atelier-jo-hors-ligne.html
rem  et tous ses fichiers compagnons (pdf.min.js, pdf.worker.min.js,
rem  tesseract.min.js, tesseract-worker.min.js, tesseract-core.wasm.js,
rem  fra.traineddata.gz, eng.traineddata.gz), puis double-cliquer.
rem =====================================================================

cd /d "%~dp0"
title Atelier du Journal officiel - service sur le reseau local

if not exist "atelier-jo-hors-ligne.html" (
  echo.
  echo   ERREUR : atelier-jo-hors-ligne.html est introuvable.
  echo   Placez ce fichier dans le meme dossier que l'atelier.
  echo.
  pause
  exit /b
)

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py"

if not defined PY (
  echo.
  echo   Python n'est pas installe sur ce poste.
  echo   Installez-le depuis https://www.python.org/downloads/
  echo   en cochant "Add Python to PATH" pendant l'installation.
  echo.
  pause
  exit /b
)

echo.
echo   ===================================================================
echo    ATELIER DU JOURNAL OFFICIEL - service sur le reseau local
echo   ===================================================================
echo.
echo    Adresses a communiquer aux autres postes :
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do (
    echo        http://%%b:8765/atelier-jo-hors-ligne.html
  )
)

echo.
echo    Sur ce poste  :  http://localhost:8765/atelier-jo-hors-ligne.html
echo.
echo   -------------------------------------------------------------------
echo    RAPPEL : chaque poste conserve son propre catalogue.
echo    Pour reunir le travail : exporter le JSON depuis l'onglet
echo    Donnees, puis l'importer sur le poste qui centralise.
echo   -------------------------------------------------------------------
echo.
echo    NE FERMEZ PAS CETTE FENETRE pendant la seance.
echo    Pour arreter le service : fermez cette fenetre ou Ctrl+C.
echo.
echo    Si les autres postes n'arrivent pas a se connecter, autorisez
echo    Python dans le pare-feu Windows lorsque la fenetre le demande.
echo.

start "" "http://localhost:8765/atelier-jo-hors-ligne.html"
%PY% -m http.server 8765 --bind 0.0.0.0
