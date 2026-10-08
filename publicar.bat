@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Publicar simulador Ceramica Santiago en Firebase
cd /d "%~dp0"

set "PROYECTO=ceramicasar-5ca08"
set "URL=https://ceramicasar-5ca08.web.app"

echo.
echo ==============================================================
echo   Publicar el simulador en Firebase Hosting
echo   Proyecto: %PROYECTO%
echo   Destino:  %URL%
echo ==============================================================
echo.

rem --- 1. Node.js -------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instala la version LTS desde https://nodejs.org
  echo         y vuelve a ejecutar este archivo.
  goto :fin_error
)
for /f "delims=" %%v in ('node -v') do echo Node.js %%v

rem --- 2. Dependencias (solo la primera vez o si faltan) ------------
if not exist "node_modules\firebase-tools" (
  echo.
  echo [1/5] Instalando dependencias del proyecto ^(solo la primera vez, puede tardar^)...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias.
    goto :fin_error
  )
) else (
  echo [1/5] Dependencias ya instaladas.
)

rem --- 3. OpenCV.js local (para que la RA no dependa de terceros) --
if not exist "assets\vendor" mkdir "assets\vendor"
if not exist "assets\vendor\opencv.js" (
  echo.
  echo [2/5] Descargando OpenCV.js para la realidad aumentada ^(unos 9 MB, solo una vez^)...
  curl -L --fail --silent --show-error -o "assets\vendor\opencv.js" "https://docs.opencv.org/4.10.0/opencv.js"
  if errorlevel 1 (
    if exist "assets\vendor\opencv.js" del "assets\vendor\opencv.js"
    echo [AVISO] No se pudo descargar OpenCV.js. La RA lo cargara desde internet ^(CDN^).
  )
) else (
  echo [2/5] OpenCV.js local ya existe.
)

rem --- 4. Pruebas ---------------------------------------------------
echo.
echo [3/5] Ejecutando pruebas...
if not exist "tmp" mkdir "tmp"
call npm test
if errorlevel 1 (
  echo.
  echo [AVISO] Alguna prueba fallo. Revisa los mensajes de arriba.
  choice /c SN /m "Publicar de todas formas"
  if errorlevel 2 goto :fin_error
)

rem --- 5. Sesion de Firebase ---------------------------------------
echo.
echo [4/5] Verificando la sesion de Firebase ^(si no has iniciado sesion, se abrira el navegador^)...
call npx firebase login
if errorlevel 1 (
  echo [ERROR] No se pudo iniciar sesion en Firebase.
  goto :fin_error
)

rem --- 6. Build + publicacion (firebase.json ejecuta "npm run build" antes) --
echo.
echo [5/5] Construyendo y publicando...
call npx firebase deploy --only hosting --project %PROYECTO%
if errorlevel 1 (
  echo [ERROR] La publicacion fallo. Revisa los mensajes de arriba.
  echo         Si el error menciona el sitio de Hosting: abre https://console.firebase.google.com/project/%PROYECTO%/hosting
  echo         pulsa "Comenzar" una vez y vuelve a ejecutar este archivo.
  echo         Si dice que no tienes permiso: inicia sesion con la cuenta duena del proyecto ^(npx firebase login --reauth^).
  goto :fin_error
)

echo.
echo ==============================================================
echo   LISTO. El simulador esta publicado en:
echo   %URL%
echo.
echo   En el celular: escanea este QR o abre la direccion.
echo   La RA necesita HTTPS ^(esta direccion ya lo es^) y permisos de camara.
echo   Prueba sin camara en el PC: %URL%/?ra-demo
echo ==============================================================
call npx --no-install qrcode "%URL%" 2>nul
start "" "%URL%"
echo.
pause
exit /b 0

:fin_error
echo.
pause
exit /b 1
