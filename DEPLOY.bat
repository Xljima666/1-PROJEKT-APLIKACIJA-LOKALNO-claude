@echo off
setlocal enabledelayedexpansion

REM ========================================
REM GeoTerrainInfo - Deploy helper for Vercel
REM ========================================

cd /d "D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"

echo.
echo ========================================
echo     GeoTerrainInfo - Vercel Deploy
echo ========================================
echo.

REM Provjera da smo u git repou
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [GRESKA] Ovaj folder nije git repository.
    echo Provjeri putanju u DEPLOY.bat
    echo.
    pause
    exit /b 1
)

echo [1/5] Git status:
git status --short
echo.

set /p PORUKA=Upisi commit poruku (Enter za "update"): 
if "%PORUKA%"=="" set PORUKA=update

echo.
echo [2/5] Dodajem sve promjene...
git add .

echo.
echo [3/5] Provjeravam ima li promjena za commit...
git diff --cached --quiet
if not errorlevel 1 (
    echo [4/5] Commitam promjene...
    git commit -m "%PORUKA%"
    if errorlevel 1 (
        echo.
        echo [GRESKA] Commit nije uspio.
        pause
        exit /b 1
    )
) else (
    echo Nema novih promjena za commit.
)

echo.
echo [5/5] Saljem na origin/main...
git push origin main
if errorlevel 1 (
    echo.
    echo [GRESKA] Git push nije uspio.
    pause
    exit /b 1
)

echo.
echo ========================================
echo GOTOVO
echo Vercel ce sada automatski napraviti deploy.
echo.
echo Provjeri:
echo - Vercel Dashboard
echo - https://geoterrainfo.com
echo ========================================
echo.
pause