@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_npm

if not exist "demo\node_modules\vite\bin\vite.js" (
  echo Installing demo dependencies...
  call npm --prefix demo ci
  if errorlevel 1 goto startup_failed
)

echo Starting Sarra Avatar Studio...
call npm --prefix demo run dev -- --open
if errorlevel 1 goto startup_failed
exit /b 0

:missing_node
echo Node.js is required. Install Node.js 20 or newer, then run start.bat again.
pause
exit /b 1

:missing_npm
echo npm was not found. Reinstall Node.js with npm, then run start.bat again.
pause
exit /b 1

:startup_failed
echo Sarra Avatar Studio failed to start.
pause
exit /b 1
