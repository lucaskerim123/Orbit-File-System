@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title OrbitFS Remote Desktop Commander Menu
color 0A

:menu
cls
echo ============================================================
echo   OrbitFS Remote Desktop Commander
echo ============================================================
echo.
echo   1. Install / repair background task
echo   2. Start now
echo   3. Stop
echo   4. Restart
echo   5. Show status
echo   6. Show logs
echo   7. Uninstall background task
echo   8. Open log folder
echo   9. Exit
echo.
set /p choice=Pick a number then press ENTER: 

if "%choice%"=="1" goto install
if "%choice%"=="2" goto start
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto restart
if "%choice%"=="5" goto status
if "%choice%"=="6" goto logs
if "%choice%"=="7" goto uninstall
if "%choice%"=="8" goto openlogs
if "%choice%"=="9" exit /b 0
goto menu

:admincheck
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo Administrator permission is needed. A new admin window will open.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  echo.
  echo Press any key to close this non-admin window.
  pause >nul
  exit /b
)
exit /b 0

:runps
call :admincheck
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\remote-desktop-commander-task.ps1" -Action %1
echo.
echo Finished. Press any key to return to the menu.
pause >nul
goto menu

:install
call :runps install

:start
call :runps start

:stop
call :runps stop

:restart
call :runps restart

:status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\remote-desktop-commander-task.ps1" -Action status
echo.
echo Press any key to return to the menu.
pause >nul
goto menu

:uninstall
call :runps uninstall

:logs
cls
echo ============================================================
echo   Remote Desktop Commander logs
echo ============================================================
echo.
set "LOGDIR=%~dp0runtime\remote-desktop-commander-task\logs"
if not exist "%LOGDIR%" (
  echo No log folder yet.
  echo Run option 1 first.
  echo.
  pause
  goto menu
)
echo LOG:
echo ------------------------------------------------------------
powershell.exe -NoProfile -Command "if (Test-Path '%LOGDIR%\remote-desktop-commander.log') { Get-Content '%LOGDIR%\remote-desktop-commander.log' -Tail 80 } else { 'No normal log yet.' }"
echo.
echo ERROR LOG:
echo ------------------------------------------------------------
powershell.exe -NoProfile -Command "if (Test-Path '%LOGDIR%\remote-desktop-commander.err.log') { Get-Content '%LOGDIR%\remote-desktop-commander.err.log' -Tail 80 } else { 'No error log yet.' }"
echo.
echo Press any key to return to the menu.
pause >nul
goto menu

:openlogs
set "LOGDIR=%~dp0runtime\remote-desktop-commander-task\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
explorer "%LOGDIR%"
goto menu
