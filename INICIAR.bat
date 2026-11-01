@echo off
title Sistema Escolar - Prof. Facundo Casciano
chcp 65001 > nul
echo ============================================================
echo   SISTEMA DE GESTION ESCOLAR - TUPROFEWEB
echo   Prof. Facundo Casciano
echo ============================================================
echo.
echo Abriendo el navegador en http://localhost:3000 ...
timeout /t 2 /nobreak > nul
start http://localhost:3000
echo.
echo Servidor iniciado. No cierres esta ventana mientras uses el sistema.
echo.
node server.js
pause
