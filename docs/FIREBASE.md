# Publicación en Firebase Hosting

Proyecto actual: `ceramicasar-5ca08`.
Dirección: https://ceramicasar-5ca08.web.app

La versión anterior sigue en `ceramicasantiago-61f9d` (https://ceramicasantiago-61f9d.web.app). En `.firebaserc` quedó como alias `anterior`; para publicar ahí: `npx firebase deploy --only hosting --project anterior`.

## Publicar con un doble clic (Windows)

Ejecutar `publicar.bat` en la carpeta del proyecto. El archivo:

1. comprueba Node.js e instala las dependencias la primera vez;
2. descarga OpenCV.js a `assets/vendor/` una sola vez, para que la RA no dependa de terceros;
3. ejecuta las pruebas y pregunta antes de publicar si alguna falla;
4. inicia sesión en Firebase si hace falta (se abre el navegador);
5. construye `dist` y publica Hosting.

Al terminar, muestra la dirección y un QR para el celular, y abre la página en el PC.

## Instalación y login

Firebase CLI se instala como dependencia de desarrollo del proyecto. No requiere instalación global. Las versiones se fijan en `package-lock.json`.

```powershell
npm ci
npx firebase login
```

Completar la autorización oficial de Google. Si Firebase entrega un código, ejecutar `npx firebase login CODIGO` en la terminal; no guardar códigos ni tokens en el repositorio.

## Build y publicación

```powershell
npm test
npm run build
npm run deploy
```

`npm run deploy` ejecuta únicamente Hosting. Su paso predeploy vuelve a construir `dist`. El build limpia esa carpeta y copia solo `index.html`, `src/` y los assets públicos. No publica documentos originales, manuales PDF, el plugin PHP, credenciales, pruebas ni herramientas locales.

No se configura Firestore, Storage, Functions, Analytics ni facturación. El simulador sigue procesando las fotos dentro del navegador. Las dependencias Three.js/model-viewer y fuentes siguen descargándose desde sus CDN; el generador QR se incorpora al build.

## QR y teléfono

1. Abrir la dirección HTTPS en el computador.
2. Elegir objeto, acabado y medidas.
3. Pulsar **Abrir en celular (QR)**.
4. Escanear el QR con la cámara del teléfono o copiar el enlace.
5. El teléfono reconstruye la configuración y abre la vista «En tu espacio».
6. Cuando el modelo esté preparado, pulsar **Colocar en mi espacio** en un dispositivo compatible y conceder cámara si se solicita.

El QR transporta parámetros en el fragmento de la URL, no fotografías ni modelos binarios. El dispositivo reconstruye el GLB localmente. Quick Look y WebXR siguen dependiendo del soporte real del dispositivo. Scene Viewer continúa excluido porque el GLB generado es un blob local, no un archivo HTTPS alojado.

La URL publicada funciona entre dispositivos. `localhost` solo sirve para pruebas en el mismo computador.

## WordPress

El sitio Firebase puede abrirse desde un botón de la ficha de producto. Para probar un iframe remoto, usar la URL HTTPS e incluir `allow="xr-spatial-tracking; fullscreen"`; validar políticas del sitio y funcionamiento en Safari/Chrome. Una apertura directa del simulador simplifica la prueba inicial de AR.

## Futuras actualizaciones

Editar los archivos fuente y repetir `npm test` y `npm run deploy`. Firebase conserva versiones de Hosting y permite volver a una anterior desde su consola. `firebase.json` no fija `hosting.site`: se publica en el sitio predeterminado del proyecto elegido. No cambiar `.firebaserc` sin confirmar el destino.
