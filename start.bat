@echo off
rem Git Branch Tool (Windows): double-click this file.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
where git >nul 2>nul || (echo git is required: https://git-scm.com & pause & exit /b 1)
node server.js --open
pause
