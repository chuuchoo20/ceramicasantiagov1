# Estudio de revestimientos · Cerámica Santiago

## Novedades (octubre 2026): Objetos · Muralla · RA

- **Tres secciones** arriba, con el sistema de diseño de ceramicasantiago.cl
  (rojo de marca, gris carbón, títulos en mayúsculas, pestañas subrayadas,
  tarjetas blancas, botones píldora). La página **no trae encabezado propio**:
  se inserta bajo el header del sitio.
  - **Objetos (piezas 3D)** · menú inferior *Productos*. Es la primera pantalla:
    catálogo por familia (Enchapes, Ladrillos, Quiebravistas, Pisos) con
    medidas reales de cada formato, color y terminación, ficha técnica y
    descarga GLB de la pieza. Datos en [docs/CATALOGO.md](docs/CATALOGO.md).
  - **Muralla** · menú inferior *Diseño* (traba, cantería, color de cantería) y
    *Medidas* (ancho y alto, contorno de 4 puntos, cálculo de unidades).
  - **RA** · menú inferior *Tu espacio*: «Ver en mi pared» (OpenCV), sobre una
    foto, descarga y enlace.
- **Carga cognitiva baja.** Todo lo personalizable parte cerrado en
  desplegables (uno abierto a la vez) que muestran el valor elegido. Un botón
  rojo en el menú inferior lleva al paso siguiente: *Crear muralla → Ver en RA
  → Ver en mi pared*.
- **Una sola RA: «Ver en mi pared».** Se eliminaron el visor nativo
  (model-viewer, WebXR / Quick Look) y los botones Pieza/Muralla del visor.
  Las secciones antiguas de este README que hablan de model-viewer quedan como
  historial.
- **RA propia con OpenCV.js** (`ra/`): unión piso–pared, distancia, ángulo
  piso–muro (≈ 90°), zócalo, proyección 1:1, medición y calibración. Detalle en
  [docs/RA-OPENCV.md](docs/RA-OPENCV.md).
- Se arman en muralla los enchapes y los ladrillos Princesa Santiago,
  Santiagote, Fiscal, Thermo Murotón y Megabloque. Mitad y Ducto (alcance),
  quiebravistas (falta el modelo con aberturas) y pisos (constructor de pisos
  pendiente) se muestran como pieza individual, con el motivo en pantalla.
- **RA guiada por «Medir y colocar».** Al fijar la pared, el primer paso es medirla con 3 toques (extremo, extremo, altura). La muralla queda con esas medidas y en ese lugar exacto. Hay un paso a paso ilustrado, estilo instructivo de armado, en la cámara y en la sección RA (`ra/tutorial.js`). El botón «Medir y colocar» va primero y en rojo.
- **Color por producto.** Al cambiar de producto se vuelve a su color y terminación por defecto: Enchape Santiago vuelve a Natural · Rasguñado después de pasar por Nueva York.
- **Texturas reales.** Rústico, Liso y Ranurado usan fotos de las piezas
  (`assets/textures/`) en todos los productos que ofrecen esa terminación:
  piezas 3D, muralla, RA y GLB. Cada pieza muestra la textura a su tamaño real
  y con un recorte distinto. El color Natural muestra la foto tal cual; los
  demás colores la tiñen. Los botones de terminación muestran una miniatura.
  Rasguñado y Nueva York siguen con relieve generado hasta tener su foto.
  Para sumar texturas: [docs/TEXTURAS.md](docs/TEXTURAS.md).
- **RA más estable.** Un segundo detector reconoce la pared por sus líneas horizontales y trabaja junto al encuentro piso–muro. El dibujo se sincroniza con cada cuadro del video. El tiritón simulado bajó cerca de 25 % y el desfase al mover el teléfono cerca de 40 %. Se eliminó «Probar sin cámara».

`index.html` sigue siendo la página única del estudio. Los módulos de RA (`ra/`)
se cargan solo al abrir la cámara; `npm run build` los copia a `dist/`.

## Trabajar desde otro computador

Instala Git y Node.js 22 o superior. Clona el repositorio una sola vez en cada computador:

```powershell
git clone https://github.com/NicolasArancibia/Ceramica-3D.git
cd Ceramica-3D
npm ci
npm start
```

Abre `http://localhost:4173`. Para detener el servidor, presiona `Ctrl+C`.

Antes de empezar una sesión, con tus cambios anteriores ya guardados y subidos:

```powershell
git pull --ff-only
npm ci
```

Al terminar, guarda los archivos y sube tus cambios:

```powershell
git add .
git commit -m "Describe los cambios realizados"
git push
```

Sube los cambios antes de cambiar de computador. GitHub sincroniza los archivos
incluidos en los commits; las dependencias, los archivos temporales y los datos
guardados en el navegador no se sincronizan. Para subir cambios, autentícate
con una cuenta que tenga acceso al repositorio cuando Git lo solicite.

## Versión vigente: simulador paramétrico en un único archivo

`index.html` contiene todo el HTML, CSS y JavaScript del simulador. No importa
archivos de `src/`, no necesita assets locales y **no requiere bundler ni build**.
Three.js 0.180.0, sus addons, model-viewer 4.1.0, three-bvh-csg 0.0.17 y
three-mesh-bvh 0.9.1 se importan mediante CDN.

Para abrirlo, ejecuta `node server.mjs` y visita `http://localhost:4173`.
Se necesita conexión a internet para las dependencias CDN. Para usar AR en un
teléfono, sirve el mismo archivo mediante HTTPS.

Incluye los siete colores, los dos formatos y las cuatro canterías solicitadas,
cinco trabas, cotas unitarias, fotografía local, cuatro puntos de recorte y
persistencia del contorno/configuración en localStorage. El ladrillo es una
referencia editable: no se proporcionaron dimensiones de catálogo para él.
La foto no se almacena entre recargas. El montaje es frontal, sin estimación
automática de perspectiva o medidas. Los ladrillos se cortan físicamente a ras
del contorno. Se conservan las canterías, incluidos sus encuentros con el borde.

El generador extiende el patrón más de dos largos de pieza fuera de la caja del
polígono, combina los ladrillos con `mergeGeometries` y calcula una intersección
CSG con un prisma `Shape`/`ExtrudeGeometry`. La malla resultante incluye las caras
de corte. Se compactan los buffers al drawRange real para no exportar sobrantes.
No se usa un filtro de piezas completas ni clipping visual del material.

El origen de instalación es el Punto 4 en coordenadas del mundo. La primera
pieza de una traba horizontal se centra en `(P4.x + ancho/2, P4.y + alto/2)`;
en Sardinel se intercambian ancho y alto. En un rectángulo con base horizontal
y lado izquierdo vertical, la primera pieza queda entera. Las hiladas con
desfase y la Espiga mantienen los cortes propios del patrón. Si la base o el
lado izquierdo son diagonales, el CSG también debe cortar allí. El Punto 4
tiene prioridad sobre el mínimo de la caja delimitadora cuando no coinciden.

Después del CSG se reconstruyen las normales. Antes de exportar se validan las
posiciones y los índices, se reparan UVs ausentes/inválidas, se clona únicamente
la malla con un MeshStandardMaterial válido y se actualiza su matriz mundial.
El GLB binario se comprueba antes de crear su URL: una malla, atributos y material
PBR presentes. Un Blob vacío produce un mensaje de consola y un error visible;
el visor se pone explícitamente en `display: block` antes de cargar el modelo.

La descarga y AR reciben el mismo GLB estándar de una única malla CSG. No se
exportan el muro excedido, el cortador, las cotas ni la foto. Quick Look recibe
además un USDZ de esa misma malla. Scene Viewer requiere
publicar el GLB en una URL HTTPS pública mediante `CONFIG.publishGLB`;
sin backend se usan WebXR y Quick Look. La colocación física debe validarse en
dispositivos compatibles. Los comentarios `TODO: CARGAR TEXTURAS AQUI` y
`TODO: CARGAR MODELOS AQUI` describen la
integración futura de modelos y texturas.

Presupuesto: `base = ceil(áreaPolígono / ((anchoPieza + junta) * (altoPieza + junta)))`;
`total = base + ceil(base * 0.05)`. Ejemplo: 2,4 × 1,6 m, Nacional y junta de
10 mm → 237 + 12 = 249 unidades. Es una estimación por superficie, no el conteo
de fragmentos ni una optimización del aprovechamiento de los cortes.

Validación del código integrado: `npm ci` y `node --test tests/single-file.test.mjs`. RA: `npm run test:ra`.
Las dependencias npm de Three/CSG son solo para pruebas; el HTML usa las CDN.
Se compara la superficie frontal, el área de las caras de corte y el volumen CSG
con un recorte 2D independiente para 80 combinaciones de patrón, formato, junta
y contorno; además se prueba un contorno cóncavo y el marco máximo de 6 × 4 m.
El cambio de color reutiliza la geometría; mover puntos agrupa eventos por frame.
Los muros grandes pueden tardar varios segundos en recalcular su CSG.
El botón de AR abre ahora un editor en model-viewer con color, formato,
traba, cantería, medidas del marco y dimensiones del ladrillo. Incluye deshacer
(20 cambios), validación de medidas y sincronización con el estudio. El color
actualiza el material sin recargar; la composición regenera el GLB conservando
el polígono y las medidas de cada pieza. Conviene comprobar la colocación
después de regenerar la geometría.

En Android con WebXR, pulsa «Entrar y editar en AR»: el panel permanece sobre
la cámara. Los toques del panel no se transmiten al objeto. Quick Look y Scene
Viewer son visores externos: en ellos se edita antes de abrir AR y se vuelve al
editor para cambiar el diseño. La interfaz identifica esta diferencia y nunca
cambia silenciosamente de WebXR a un visor externo. Sin AR se conserva el editor
3D. No se implementa seguimiento de cámara alternativo para iPhone.

Validación física pendiente: HTTPS en teléfono con ARCore/Chrome, colocación en
muro/suelo, edición durante la sesión, seguimiento perdido/recuperado y salida;
iPhone/Safari, editar → Quick Look → volver → editar → reabrir con USDZ actualizado.

Validación binaria, foto y model-viewer: abrir
`http://localhost:4173/tests/browser-single-file.html` (modifica una configuración
de prueba en el mismo almacenamiento local). El resto de los tests de `npm test`
corresponde a la versión modular anterior.

---

## Documentación histórica de la versión modular anterior

Las funciones y pasos siguientes describen la versión previa; no se necesitan
para ejecutar el nuevo `index.html`. La publicación Firebase existente todavía
corresponde a esa versión: esta actualización no ha sido desplegada.

Prototipo local sin bundler, con Three.js y model-viewer mediante CDN de versiones fijas. Incluye un adaptador WordPress opcional. No modifica la web existente ni necesita sus credenciales.

## Probar

Versión publicada: https://ceramicasantiago-61f9d.web.app · [Guía de Firebase y QR](docs/FIREBASE.md).

```powershell
npm ci
npm run build
npm start
```

Abrir http://localhost:4173. Mantener la terminal abierta. El build prepara el generador QR local. Se necesita conexión para descargar Three.js, model-viewer y fuentes. No abrir `index.html` como `file://`: los módulos necesitan HTTP.

```powershell
npm test
```

## Lo implementado

- Tres modelos: ladrillo de prueba macizo/ranurado, enchape individual, muro de enchapes.
- Dos formatos nominales de enchape; 12 combinaciones válidas de color/terminación del manual. El ladrillo permite dimensiones editables; sus colores son exploratorios.
- Vista 3D con giro y zoom. Instancias para piezas completas; polígonos extruidos y agrupados para cortes.
- Muro con ancho/alto, cinco patrones, canterías de 8/10/12/14 mm, tono de junta, remate rectangular/inclinado, abertura central, recorte o piezas completas, desplazamiento de patrón.
- Fotografía JPG/PNG/WebP local (hasta 20 MB), reducida a máximo 2400 px; ambiente ilustrativo incluido. Cuatro puntos arrastrables o accesibles con flechas, homografía proyectiva, bloqueo de cruces, intensidad y comparación con original.
- Descarga de PNG, GLB a escala y configuración JSON. La configuración es un registro exportado; esta versión no incluye importación ni almacenamiento persistente. La imagen no contiene los botones de edición.
- Visor AR bajo demanda con WebXR y Quick Look. GLB convertido a mallas ordinarias para compatibilidad. El visor muestra el botón de colocación cuando el dispositivo lo permite. Escritorio conserva vista 3D.
- QR y enlace compartible con los parámetros actuales. El teléfono reconstruye el modelo y abre la vista AR; la fotografía no se comparte.
- Interfaz adaptable; procesamiento de fotos en navegador. No hay analítica ni subida de fotografías.

## Archivos

| Archivo | Función |
| --- | --- |
| `index.html` | Entrada y estructura accesible |
| `src/styles.css` | UI y adaptación a móvil |
| `src/catalog.js` | Catálogo, dimensiones, estado inicial y rutas |
| `src/geometry.js` | Patrones, recorte y homografía, sin dependencia de WebGL |
| `src/app.js` | Render, controles, fotos, exportación y AR |
| `assets/README.md` | Contrato de incorporación de GLB y texturas PBR |
| `docs/PLAN.md` | Flujo, decisiones y etapas hacia producción |
| `docs/WORDPRESS.md` | Instalación e inserción en WordPress |
| `docs/VALIDACION.md` | Verificaciones y límites pendientes |
| `ceramica-simulador.php` | Plugin con shortcode opcional |

Se separaron archivos para que el prototipo sea mantenible y comprobable; sigue siendo una página única y no requiere compilación. No se exploró `documentos/texturas_enchapes`.

## Alcance real

Los acabados son aproximaciones procedurales, no fotografías del producto. El montaje muestra la cara frontal de las piezas; no reconstruye una habitación 3D, no detecta oclusiones ni mide la pared desde una foto. Una abertura central puede representar una ventana, pero no hay segmentación automática de muebles. La AR muestra el modelo a escala real sin transferir la foto ni sus cuatro puntos.

Las cantidades indican piezas presentes en el diseño, incluyendo recortes; no optimizan el reaprovechamiento ni calculan merma, adhesivo o compra. No se muestra peso por la inconsistencia del manual en la fila del importado. Nueva York aparece en el manual, pero es un producto separado de Enchape Santiago y queda fuera de este catálogo inicial.

La AR física, Safari iOS, Chrome Android y el shortcode deben validarse en un staging HTTPS antes de publicar. Scene Viewer está excluido hasta contar con una URL HTTPS para los GLB, porque una URL blob del navegador no es una URL pública descargable por la aplicación nativa.
