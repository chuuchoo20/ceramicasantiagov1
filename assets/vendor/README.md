# OpenCV.js local (recomendado en producción)

La RA intenta cargar primero `assets/vendor/opencv.js`. Si no existe, usa
docs.opencv.org y luego jsDelivr. Para no depender de terceros, descarga una
sola vez OpenCV.js 4.10 y guárdalo aquí con ese nombre:

    https://docs.opencv.org/4.10.0/opencv.js

`npm run build` copia esta carpeta a `dist/assets/vendor/` (este README no se publica).
Configura caché larga para el archivo; firebase.json ya la define (30 días).
