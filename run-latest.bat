@echo off
cd /d "%~dp0"
echo Installing dependencies (rebuilds native modules for Electron)...
call npm install
if errorlevel 1 goto fail
echo Starting OmniPlay in dev mode with the latest code...
call npm run dev
goto end
:fail
echo npm install failed. Scroll up for the error.
:end
pause
