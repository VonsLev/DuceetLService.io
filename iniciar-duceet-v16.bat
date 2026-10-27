@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Instala Node.js 18 o superior desde https://nodejs.org/ & pause & exit /b 1)
echo Iniciando DUCEET v16 con indice academico persistente...
node duceet-tracker-server-v16.js
pause
