@echo off
setlocal
TITLE GeoTerra Agent Server
chcp 65001 >nul 2>&1

REM =============================================
REM  LOKALNE POSTAVKE
REM =============================================
set "AGENT_WORKSPACE=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT"
set "AGENT_READ_ROOT=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT"
set "AGENT_WRITE_ROOT=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT"
set "AGENT_SERVER_DIR=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\STELLAN-GIT\docs\agent-server"
REM Postavi ove vrijednosti lokalno prije pokretanja ili ih upisi u privatnu kopiju ovog .bat filea.
set "AGENT_API_KEY="
set "FRONTEND_URL=http://localhost:8080/dashboard"

REM SDGE
set "SDGE_USERNAME="
set "SDGE_PASSWORD="

REM OSS
set "OSS_USERNAME="
set "OSS_PASSWORD="

REM GEMINI (za Stellan brain - embeddings, learning, reflection)
set "GEMINI_API_KEY="

REM GROK (za AI polish flowova)
set "GROK_API_KEY="
set "XAI_API_KEY="

REM =============================================
REM  PYTHON
REM =============================================
set "PYTHON_PATH=C:\Users\marko\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PYTHON_PATH%" (
    echo [GRESKA] Python nije pronadjen:
    echo %PYTHON_PATH%
    pause
    exit /b 1
)

REM =============================================
REM  AGENT SERVER FOLDER
REM =============================================
if not exist "%AGENT_SERVER_DIR%\agent_server.py" (
    echo [GRESKA] agent_server.py nije pronadjen:
    echo %AGENT_SERVER_DIR%\agent_server.py
    pause
    exit /b 1
)

REM =============================================
REM  FRONTEND
REM =============================================
if not exist "%AGENT_WORKSPACE%\package.json" (
    echo [GRESKA] package.json nije pronadjen:
    echo %AGENT_WORKSPACE%\package.json
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [GRESKA] npm nije dostupan u PATH-u.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   GeoTerra Agent Server v1.2
echo   Workspace: %AGENT_WORKSPACE%
echo   Server dir: %AGENT_SERVER_DIR%
echo   Port: 8432
echo ========================================
echo.
echo Cloudflare tunnel koristis odvojeno.
echo Ovaj BAT vise NE pokrece ngrok.
echo.
echo [1/3] Pokrecem frontend (npm run dev)...
start "Stellan Frontend" cmd /k "cd /d ""%AGENT_WORKSPACE%"" && npm run dev"

echo [2/3] Cekam kratko da se frontend digne...
timeout /t 4 /nobreak >nul

echo [3/3] Otvaram lokalnu stranicu: %FRONTEND_URL%
start "" "%FRONTEND_URL%"

REM =============================================
REM  AGENT SERVER
REM =============================================
cd /d "%AGENT_SERVER_DIR%"
"%PYTHON_PATH%" "%AGENT_SERVER_DIR%\agent_server.py"

if %errorlevel% neq 0 (
    echo.
    echo [GRESKA] Server se nije pokrenuo. Provjeri log iznad.
)

pause
endlocal
