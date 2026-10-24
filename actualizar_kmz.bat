@echo off
chcp 65001 > nul
title Actualizar Archivos KMZ - COVEPA Amazonas

echo =================================================================
echo   ACTUALIZADOR DE ARCHIVOS KMZ - COVEPA AMAZONAS
echo =================================================================
echo.
echo Consultando datos actualizados y generando nuevos archivos KMZ...
echo.

python generar_kmz.py

echo.
echo =================================================================
echo  Proceso finalizado. Puedes abrir los archivos en Google Earth o
echo  descargarlos directamente desde la plataforma web.
echo =================================================================
echo.
pause
