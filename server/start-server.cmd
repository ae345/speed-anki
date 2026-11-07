@echo off
rem speed-anki sync server. Double-click: starts the server if it is not running, then opens the app on this PC.
cd /d "%~dp0"
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 18787 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  wscript "%~dp0start-hidden.vbs"
  timeout /t 3 >nul
)
start "" http://localhost:18787/
