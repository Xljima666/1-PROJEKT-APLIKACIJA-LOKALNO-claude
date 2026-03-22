@echo off
setlocal
cd /d "D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"

echo ========================================
echo   GeoTerra App - Deploy
echo ========================================
echo.

:: Uzmi commit poruku od korisnika
set /p PORUKA="Opis izmjene (Enter za 'update'): "
if "%PORUKA%"=="" set PORUKA=update

echo.
echo Deployam: %PORUKA%
echo.

git add .
git commit -m "%PORUKA%"
git push

echo.
echo ========================================
echo   GOTOVO! Netlify deployas za ~1 min
echo   https://fastidious-cranachan-22717d.netlify.app
echo ========================================
echo.
pause
