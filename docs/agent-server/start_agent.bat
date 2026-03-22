@echo off
setlocal

echo ========================================
echo   GeoTerra Agent Server - Start
echo ========================================

set "AGENT_WORKSPACE=D:\Stellan Brain"
set "AGENT_API_KEY=promijeni-me-na-siguran-kljuc-123"

:: Idi u folder gdje je skripta
cd /d "%~dp0"

:: Osiguraj workspace folder
if not exist "%AGENT_WORKSPACE%" mkdir "%AGENT_WORKSPACE%"

echo.
echo Workspace: %AGENT_WORKSPACE%
echo.

:: Instaliraj pakete ako treba
pip install -r requirements.txt -q

:: Pokreni ngrok u drugom CMD prozoru
start "GeoTerra ngrok" cmd /k "ngrok http 8432"

:: Pokreni server u ovom prozoru
python agent_server.py

pause
