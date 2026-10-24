@echo off
chcp 65001 > nul
title Publicar Actualización en la Nube (Vercel)

echo =================================================================
echo   PUBLICADOR AUTOMÁTICO EN LA NUBE - AMAZONAS COVEPA
echo =================================================================
echo.
echo 1. Preparando archivos modificados...
git add .

echo.
set /p msg="Escribe qué cambiaste (o presiona ENTER para continuar): "
if "%msg%"=="" set msg=Actualizacion del sistema Amazonas-COVEPA

echo.
echo 2. Guardando cambios...
git commit -m "%msg%"

echo.
echo 3. Enviando a GitHub y Vercel...
git push origin main

echo.
echo =================================================================
echo  🎉 ¡TODO LISTO!
echo  Tus cambios ya se subieron a GitHub.
echo  Vercel los detecta solo y en ~45 segundos tu link publico
echo  tendra la nueva version en vivo.
echo =================================================================
echo.
pause
