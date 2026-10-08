# Validación del prototipo

Fecha: 23 de septiembre de 2026.

## Actualización Firebase y QR

Firebase CLI instalado localmente, login confirmado y destino `ceramicasantiago-61f9d` seleccionado por el usuario. Build de publicación con lista explícita de archivos públicos y generador QR empaquetado. `npm test` ahora contiene 14 pruebas aprobadas: se agregaron pruebas de ida/vuelta del enlace compartido, compresión de valores por defecto, límites de configuración externa y rechazo de enlaces rotos. La validación física de AR sigue pendiente.

Deploy completado en https://ceramicasantiago-61f9d.web.app. Se verificaron el sitio HTTPS, QR público y reapertura de un enlace de Enchape Importado Marfil Rasguñado con las selecciones correctas y acceso automático al modo «En tu espacio». Se publicaron 8 archivos de aplicación; documentos originales y herramientas locales quedaron fuera.

## Comprobado

- `node --check src/app.js` y `node --check src/geometry.js`: sintaxis válida.
- `npm test`: 10 pruebas aprobadas. Cobertura: correspondencia de esquinas y rectas en homografía; rechazo de cuadriláteros cruzados/degenerados/cóncavos; recorte de piezas cuyo centro queda fuera; no solapamiento y respeto de abertura en los cinco patrones; área neta; política de piezas completas; doce combinaciones de catálogo.
- Navegador local: carga de Three.js, vista 3D, controles y reinicio de vista.
- Enchape importado Marfil: formato 24 × 6 × 1,3 cm y terminación Rasguñado; filtrado de colores por línea.
- Ladrillo ranurado: edición real con teclado de largo a 36 cm y actualización de dimensión visible.
- Foto: carga local de PNG de referencia, confirmación de procesamiento local; montaje con cuatro puntos; movimiento de esquina por teclado.
- Muro: espiga, forma inclinada y abertura central representadas sobre ambiente ilustrativo.
- Exportación GLB: el resultado del muro en espiga con abertura abrió correctamente en model-viewer. Se verificó que el hueco, patrón y remate sobreviven a la conversión de instancias.
- AR no disponible en escritorio: mensaje de compatibilidad y visor 3D alternativo, sin fingir sesión de cámara.
- Vista adaptable a 390 × 844: controles legibles, sin desbordamiento horizontal (scrollWidth = clientWidth).
- Acción PNG: generación de Blob sin error de canvas. El evento de descarga no se recibió en la automatización del navegador integrado; pendiente comprobar el archivo guardado en Chrome/Safari. No se considera una descarga en disco verificada.

La consola mostró una advertencia de múltiples copias de Three.js al cargar model-viewer, que incluye su propio motor. Se carga solo al entrar en AR; no hubo errores de consola en los flujos inspeccionados.

## Pendiente para producción

- Prueba física de cámara, detección de pared, escala métrica y salida/retorno en Android WebXR e iOS Quick Look. La revisión de escritorio no valida AR física ni generación USDZ en iOS.
- Confirmar descarga de PNG/GLB/JSON en los navegadores finales.
- Prueba de plugin y shortcode en WordPress HTTPS real. No se ejecutó PHP ni se modificó el sitio de producción.
- Carga prolongada, fotos grandes y orientación EXIF en dispositivos de memoria limitada.
- Revisión con productos reales, color/material, catálogo de ladrillos y cubicación comercial si se incorpora.
- Revisión de accesibilidad con lector de pantalla y dispositivos táctiles reales.

## Actualización 7 de octubre de 2026: RA con OpenCV y editor móvil

Comprobado:

- `npm run test:ra`: 11 pruebas de geometría aprobadas.
- Pipeline de OpenCV nativo sobre 8 habitaciones sintéticas: distancia al muro con error ≤ 0,24 %, orientación ≤ 0,3°, ángulo piso–muro observable con error ≤ 1,4°. Ver `docs/RA-OPENCV.md`.
- Navegador real (panel de Chrome) con Three.js 0.180 y OpenCV.js 4.10 desde CDN, sin errores de consola:
  - estudio completo a 390 × 844 sin desbordamiento horizontal;
  - CSG, cálculo 237 + 12 = 249 unidades;
  - producto, color, terminación con disponibilidad, traba, cantería, mortero, pasos de ±10 cm, valor con coma («2,35»), deshacer/rehacer, vista pieza/muralla, ladrillo y contorno;
  - GLB exportado con mapa normal de la terminación (1 malla);
  - RA en modo demostración: detección estable 2,36–2,41 m (real 2,40 m), zócalo 8–9 cm, muro virtual a < 1 cm del encuentro, medición 0,90 m / 2,05 m exacta, calibración, edición sobre la cámara sincronizada con el estudio, foto, modo manual y cierre limpio.

Corregido durante la prueba: el módulo de OpenCV.js trae su propio `.then()` y colgaba la página si se resolvía una promesa con él. Ahora la carga devuelve `{ cv }`.

Pendiente: prueba física en teléfonos Android e iPhone por HTTPS; `tests/single-file.test.mjs` debe ejecutarse con `npm ci` (no se pudo instalar dependencias en el entorno de desarrollo de esta sesión).

## Interfaz Objetos · Muralla · RA (7 de octubre de 2026)

Se validó en el navegador del escritorio, con viewport de 375 × 812 y de 1366 × 800, usando el mismo `index.html` (hash SHA-256 verificado).

- **Primera pantalla.** Abre en Objetos, con el catálogo por familias y todos los desplegables cerrados. Al abrir un desplegable se cierran los demás.
- **Productos.** Enchape Santiago Nacional/Importado: 24 × 5,5 y 24 × 6 cm en el visor. Una combinación de color fuera del manual se marca como referencial. Thermo Murotón en pieza: 0,44 × 0,094 × 0,14 m, con GLB de pieza exportado.
- **Muralla.** Princesa Santiagote 7 con cantería de 15 mm da 141 u en 3,84 m². Enchape Santiago Nacional con 10 mm da 249 u, el mismo valor de las pruebas del motor. El GLB de la muralla se exporta con `CSG_INTERSECTION`.
- **Sin muralla.** Ladrillo Mitad y Ducto quedan como solo pieza. En Muralla aparece el motivo y el botón para elegir otro producto.
- **RA.** El botón «Ver en mi pared» abre `ra/session.js`, que en esta prueba no estaba disponible: el error se informa y el estudio sigue funcionando. La RA con OpenCV se validó antes; su interfaz con la página no cambió, salvo que ya no ofrece el visor nativo.
- **Motor.** Se ejecutó la porción `CONFIG…restore()` en Node: claves de color, formatos, canterías y 249 u. También se verificó que todos los productos del catálogo normalizan su estado y que los rendimientos coinciden con la geometría.
- **Pendiente.** `npm test` completo, porque el contenedor no tiene acceso a npm, y la prueba física en teléfonos.

## Detector de pared y seguimiento estable (8 de octubre de 2026)

- **Pruebas.** `npm run test:ra`: 19 de 19. Habitaciones sintéticas con OpenCV nativo: 8 de 8, y el detector de pared queda dentro de su incertidumbre en todos los casos.
- **Navegador con cámara sintética** (arnés de prueba: video 3D de un muro de ladrillo y sensores con 80 ms de desfase):
  - El muro se detectó a 2,41 m (real 2,40 m), con orientación −96,01° (real −96°), confirmado con 51 líneas.
  - Con la muralla fijada, durante 4 s, la distancia varió 2,2 mm y la orientación 0,026°.
  - El desfase entre la orientación usada y la del video bajó de 0,18° a 0,09°.
- **Interfaz.** El desplegable abierto muestra un fondo tintado y un filete rojo. Se eliminaron «Probar sin cámara», `?ra-demo` y `ra/demo-scene.js`.
- **Pendiente.** La prueba física en teléfonos: tiritón percibido, `captureTime` del video y RelativeOrientationSensor en Android.

## «Medir y colocar» y paso a paso (8 de octubre de 2026)

Se probó en el navegador con cámara sintética: muro de ladrillo a 2,40 m y −96°.

- **Medición.** Tras «Fijar pared» se abre sola la medición, con el «Paso 2 de 4» ilustrado. Tres toques sobre la pared real entregaron 1,60 × 1,20 m (real 1,60 × 1,20 m).
- **Colocación.** Al tocar «Colocar mi muralla aquí», las esquinas de la muralla virtual quedan a 0,6–1,0 px de los puntos tocados. La página recalculó 125 u.
- **Barra.** El orden es Medir y colocar (en rojo), Diseño, Comparar y Foto.
- **Paso a paso.** Se ve en la tarjeta inicial de la cámara y en el desplegable de la sección RA: 5 pasos.
- **Color.** Enchape Santiago (Siena) → Nueva York (Envejecido · Nueva York) → Santiago queda en Natural · Rasguñado.
- **Pruebas.** `tests/ra-tutorial.test.mjs` revisa los 5 dibujos (SVG bien formado, numerado y con texto alternativo).

## Texturas reales: Rústico, Liso y Ranurado (8 de octubre de 2026)

- **Fotos.** Se procesaron con `scripts/texturas.py`:
  - sin gradiente de luz;
  - repetibles sin costuras, revisadas en mosaicos de 3 × 2;
  - en Ranurado, recortadas a 8 periodos de ranura;
  - con mapa normal y miniatura.
- **Navegador.** Se probó con texturas de prueba en lugar de las fotos:
  - **Carga.** Cada textura se carga al elegir su terminación. Sin errores.
  - **Botones.** Liso y Rústico muestran miniatura en Enchape Santiago. Rasguñado no tiene.
  - **Ranurado.** En Fiscal Princesa las ranuras quedan horizontales, a lo largo de la pieza (giro 90°, repetición 1/0,12 m).
  - **Color.**
    - Natural usa la foto sin teñir (`material.color` blanco).
    - Siena, Arcilla, Marfil y Envejecido usan una copia teñida (por ejemplo, `rustico/color·#bf9476`). Arcilla Rústico y Arcilla Rasguñado se ven del mismo tono.
    - Marfil Rasguñado, que no tiene foto, sigue con el relieve generado.
  - **Muralla.** 2,4 × 1,6 m, 249 u, corte CSG con UV. Las piezas se ven con recortes distintos.
  - **GLB.** 2 imágenes y `KHR_texture_transform`. No se escribe `baseColorFactor`, que queda en 1, como pide glTF.
- **UV.** Con Three.js 0.180, sobre la porción `CONFIG…restore()`, se verificó lo siguiente:
  - frente 0,29 × 0,071 m, canto 0,29 × 0,14 m y cabeza 0,14 × 0,071 m;
  - recortes distintos por pieza;
  - registro `CONFIG.textures` válido.

  La misma prueba quedó en `tests/single-file.test.mjs`.
- **Pendiente.**
  - Correr `npm test` completo; aquí no hay npm.
  - Ver las fotos reales en el teléfono.
  - Confirmar el tamaño real de cada foto (`sizeM`).

### Corrección de color de las texturas (8 de octubre de 2026)

- **Falla.** En la página y en Paint las texturas se veían «color cartón».
  - Causa: las fotos traen el perfil ProPhoto RGB, que el script de preparación no aplicaba. Brave sí lo aplica y por eso ahí se veían bien.
  - Corrección: `scripts/texturas.py` ahora convierte las fotos a sRGB con su perfil (ImageCms).
- **Color medio nuevo de las fotos.** Rústico #de8569, Liso #d17c5d, Ranurado #d0846d. Antes daban #ab7e5e, #9d7452 y #a07b60.
- **Revisión.** El color de los JPG nuevos coincide con lo que muestra Brave.
