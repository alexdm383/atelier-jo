@echo off
rem =====================================================================
rem  Atelier du Journal officiel — Archives Nationales du Cameroun
rem  Ouvre l'atelier dans le navigateur, servi par un petit serveur local.
rem
rem  Pourquoi : ouvert par double-clic, le navigateur bride certaines
rem  fonctions (lecture des PDF, désignation d'un dossier). Servi par
rem  cette page, tout fonctionne normalement.
rem
rem  Usage : placer ce fichier dans le meme dossier que
rem  atelier-jo-hors-ligne.html, pdf.min.js, pdf.worker.min.js,
rem  tesseract.min.js, tesseract-worker.min.js, tesseract-core.wasm.js,
rem  fra.traineddata.gz et eng.traineddata.gz (necessaires a l'OCR),
rem  puis double-cliquer dessus.
rem =====================================================================

cd /d "%~dp0"
title Atelier du Journal officiel - serveur local

if not exist "atelier-jo-hors-ligne.html" (
  echo.
  echo   ERREUR : atelier-jo-hors-ligne.html est introuvable.
  echo   Placez ce fichier dans le meme dossier que l'atelier.
  echo.
  pause
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 goto lancer

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py"
  goto lancer2
)

echo.
echo   Python n'est pas installe sur ce poste.
echo.
echo   Deux solutions :
echo     1. Installer Python depuis https://www.python.org/downloads/
echo        (cocher "Add Python to PATH" pendant l'installation)
echo     2. Ou utiliser l'atelier par double-clic, en collant le texte
echo        des numeros dans le champ "Texte deja transcrit".
echo.
pause
exit /b

:lancer
set "PY=python"
:lancer2

echo.
echo   Serveur local demarre.
echo   L'atelier s'ouvre dans votre navigateur.
echo.
echo   NE FERMEZ PAS CETTE FENETRE pendant que vous travaillez.
echo   Pour arreter : fermez cette fenetre ou appuyez sur Ctrl+C.
echo.

start "" "http://localhost:8765/atelier-jo-hors-ligne.html"
%PY% -m http.server 8765
