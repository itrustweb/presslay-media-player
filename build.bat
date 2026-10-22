@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 goto fail
call npm run dist
if errorlevel 1 goto fail
echo.
echo Done. Your installer is in the dist folder.
pause
exit /b 0
:fail
echo.
echo Build failed. Make sure Node.js LTS is installed from https://nodejs.org
pause
exit /b 1
