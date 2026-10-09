@echo off
title Servidor IDE Analizador Sintactico
echo ====================================================
echo   Iniciando Servidor del IDE (Analizador Sintactico)
echo ====================================================
echo.
echo Por favor, NO cierres esta ventana negra. 
echo Si la cierras, el servidor se apagara.
echo.
echo Abriendo el navegador...

:: Abre el navegador predeterminado automaticamente
start http://localhost:8000

:: Levanta el servidor local apuntando a la raiz del proyecto usando Python o abriendo index.html
echo.
echo El servidor esta corriendo en: http://localhost:8000
echo Presiona Ctrl+C para detener el servidor.
echo.

cd %~dp0
python -m http.server 8000
