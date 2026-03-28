@echo off
setlocal enabledelayedexpansion

REM ========================================
REM GeoTerrainInfo - Supabase Edge Functions Deploy
REM ========================================

cd /d "D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"

echo.
echo ========================================
echo  GeoTerrainInfo - Supabase Deploy
echo ========================================
echo.

REM Lista svih edge funkcija za deploy
set FUNCTIONS=gmail-auth brain-auth fetch-gmail agent-health chat delete-user download-sdge-pdf fill-pdf fill-zahtjev get-vapid-key impersonate-user lookup-oib notify-change sdge-discover sdge-povratnice search-oss search-sdge send-push-notifications signup-with-invitation sync-sdge update-user-credentials validate-invitation

echo [1/4] Popravljam migration history...
echo.

REM Dohvati listu migracija koje treba popraviti
for /f "tokens=*" %%a in ('npx supabase db pull 2^>^&1 ^| findstr "supabase migration repair"') do (
    REM Izvuci timestamp iz linije
    for /f "tokens=6" %%t in ("%%a") do (
        echo   Repair: %%t
        npx supabase migration repair --status applied %%t >nul 2>&1
    )
)
echo   Migration repair gotov.
echo.

echo [2/4] Koje funkcije zelite deployati?
echo.
echo   1) SVE funkcije (kompletni deploy)
echo   2) Samo Google funkcije (gmail-auth, brain-auth, fetch-gmail)
echo   3) Odaberi pojedinacno
echo   4) Samo jedna funkcija (upisi ime)
echo.
set /p IZBOR=Odaberi (1-4): 

if "%IZBOR%"=="1" (
    set DEPLOY_LIST=%FUNCTIONS%
) else if "%IZBOR%"=="2" (
    set DEPLOY_LIST=gmail-auth brain-auth fetch-gmail
) else if "%IZBOR%"=="3" (
    echo.
    echo Dostupne funkcije:
    set /a NUM=0
    for %%f in (%FUNCTIONS%) do (
        set /a NUM+=1
        echo   !NUM!. %%f
    )
    echo.
    echo Upisi imena funkcija odvojene razmakom:
    set /p DEPLOY_LIST=Funkcije: 
) else if "%IZBOR%"=="4" (
    set /p DEPLOY_LIST=Ime funkcije: 
) else (
    echo Nepoznat izbor, deployam sve...
    set DEPLOY_LIST=%FUNCTIONS%
)

echo.
echo [3/4] Deployam edge funkcije...
echo.

set /a USPJEH=0
set /a GRESKA=0
set NEUSPJELE=

for %%f in (%DEPLOY_LIST%) do (
    echo   Deploying: %%f ...
    npx supabase functions deploy %%f --no-verify-jwt >nul 2>&1
    if errorlevel 1 (
        echo   [GRESKA] %%f deploy NIJE uspio!
        set /a GRESKA+=1
        set "NEUSPJELE=!NEUSPJELE! %%f"
    ) else (
        echo   [OK] %%f uspjesno deployano
        set /a USPJEH+=1
    )
)

echo.
echo [4/4] Git commit i push promjena...
echo.
set /p COMMIT=Zelite commitati promjene? (D/N): 
if /i "%COMMIT%"=="D" (
    set /p PORUKA=Commit poruka (Enter za "supabase functions update"): 
    if "!PORUKA!"=="" set PORUKA=supabase functions update
    git add .
    git diff --cached --quiet
    if errorlevel 1 (
        git commit -m "!PORUKA!"
        git push origin main
        echo   Git push zavrsen.
    ) else (
        echo   Nema promjena za commit.
    )
) else (
    echo   Preskocen git commit.
)

echo.
echo ========================================
echo REZULTAT
echo ========================================
echo   Uspjesno: %USPJEH%
echo   Neuspjelo: %GRESKA%
if not "%NEUSPJELE%"=="" (
    echo   Neuspjele funkcije:%NEUSPJELE%
)
echo.
echo Provjeri na: https://geoterrainfo.com/settings
echo ========================================
echo.
pause
