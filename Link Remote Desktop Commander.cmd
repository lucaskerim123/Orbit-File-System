@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Link Remote Desktop Commander to this VPS
color 0A

cls
echo ============================================================
echo   Link Remote Desktop Commander to this VPS
echo ============================================================
echo.
echo This is the FIRST-RUN / RELINK step.
echo.
echo It runs exactly:
echo npx @wonderwhy-er/desktop-commander@latest remote
echo.
echo Desktop Commander should print/open an add-device link like:
echo https://mcp.desktopcommander.app/add-device?session_id=...
echo.
echo Use that link to connect this VPS.
echo.
echo After it links successfully, close this window with CTRL+C,
echo then run "Remote Desktop Commander.cmd" and choose option 2
echo to install the background restart task.
echo.
pause

npx @wonderwhy-er/desktop-commander@latest remote

echo.
echo Desktop Commander exited. If it gave an add-device link, use that first.
echo Press any key to close.
pause >nul
