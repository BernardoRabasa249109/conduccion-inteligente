@echo off
rem Instala las dependencias y arranca el servidor de desarrollo (requiere Node.js).
cd /d "%~dp0"
call npm install
call npm run dev
pause
