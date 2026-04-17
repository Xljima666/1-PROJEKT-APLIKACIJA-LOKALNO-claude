@echo off
setlocal
title GeoTerra Agent Server
chcp 65001 >nul 2>&1

REM =============================================
REM  LOKALNE POSTAVKE
REM =============================================
set "AGENT_WORKSPACE=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"
set "AGENT_READ_ROOT=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"
set "AGENT_WRITE_ROOT=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude"
set "AGENT_API_KEY=promijeni-me-na-siguran-kljuc-123"

REM SDGE
set "SDGE_USERNAME=geo97825632376"
set "SDGE_PASSWORD=GeoterrA2008"

REM OSS
set "OSS_USERNAME=darpet"
set "OSS_PASSWORD=GeoterrA20089"

REM GEMINI (za Stellan brain - embeddings, learning, reflection)
set "GEMINI_API_KEY=AIzaSyCQpVFc0B9TucdNKkij5YsCtwst-zgFGyE"

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
set "AGENT_DIR=D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\3 AGENT"
if not exist "%AGENT_DIR%\agent_server.py" (
    echo [GRESKA] agent_server.py nije pronadjen:
    echo %AGENT_DIR%\agent_server.py
    pause
    exit /b 1
)

REM =============================================
REM  NGROK
REM =============================================
where ngrok >nul 2>&1
if %errorlevel%==0 (
    echo Pokrecem ngrok...
    start "GeoTerra ngrok" cmd /k "ngrok http 8432 --url=madlyn-bromidic-anna.ngrok-free.dev"
    echo Cekam 4 sekunde da ngrok bude spreman...
    timeout /t 4 /nobreak >nul
) else (
    echo [INFO] ngrok nije pronadjen u PATH-u. Server ce se svejedno pokrenuti lokalno.
)

REM =============================================
REM  AGENT SERVER
REM =============================================
cd /d "%AGENT_DIR%"

echo.
echo ========================================
echo   GeoTerra Agent Server v1.2
echo   Folder: %AGENT_DIR%
echo   Port: 8432
echo ========================================
echo.

REM Bitno: pokreci direktno file, ne uvicorn modul,
REM da se uvijek digne tocno ovaj agent_server.py
"%PYTHON_PATH%" "%AGENT_DIR%\agent_server.py"

if %errorlevel% neq 0 (
    echo.
    echo [GRESKA] Server se nije pokrenuo. Provjeri log iznad.
)

pause
endlocal
