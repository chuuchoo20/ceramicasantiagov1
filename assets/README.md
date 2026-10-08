# Incorporar materiales reales

Estas carpetas están preparadas para contenido futuro. No se leyó ni se copió la carpeta `documentos/texturas_enchapes`.

- `models/`: GLB de ladrillos o piezas individuales. Una unidad = un metro; frente hacia +Z, alto en Y y largo en X. Origen centrado. Confirmar medidas y escala antes de reemplazar geometrías.
- `textures/`: conjuntos PBR por variante (basecolor, normal, roughness; opcional AO). Imágenes sin iluminación horneada. Convención sugerida: `nacional-natural-liso/basecolor.webp`. Máximo inicial sugerido 1024–2048 px.
- `environments/`: ambiente SVG ilustrativo incluido; futuras fotografías de ejemplo con licencia y sin datos personales.

`src/catalog.js` contiene `CONFIG.paths`, dimensiones, combinaciones y colores de prueba. `src/app.js`, función `buildThree`, contiene los puntos de inyección.

## Texturas

Usar `THREE.TextureLoader` desde `CONFIG.paths.textures`. Basecolor en `THREE.SRGBColorSpace`; normal/roughness en espacio lineal. Conservar UV por pieza. La vista sobre foto dibuja polígonos: para PBR fotográfico se deberá reemplazar el relleno por un compositor con textura y homografía; no basta con cargar la textura en Three.js. Mantener el mismo catálogo para ambas vistas.

## Modelos

Usar `GLTFLoader` de la misma versión que Three.js. Para una pieza, normalizar transformaciones y centrarla antes de sustituir la caja. Un GLB con varios materiales/submallas exige un `InstancedMesh` por geometría/material para muros. No reemplazar ciegamente `BoxGeometry` por el grupo GLTF completo. Los bordes cortados y vanos necesitan geometría recortada compatible; el prototipo extruye polígonos recortados. Una malla escaneada exige una estrategia adicional de corte/UV.

## Catálogo de ladrillos pendiente

Entregar SKU, nombre, largo/alto/fondo, colores permitidos, terminación, geometría GLB y peso si se mostrarán cantidades/pesos. Las capturas de prototipo son referencias de interacción y no una ficha técnica. El ladrillo actual usa dimensiones editables de prueba 29 × 11,3 × 14 cm.

## AR

El prototipo convierte las instancias en mallas ordinarias al exportar GLB, para evitar depender de extensiones de instanciamiento en visores nativos. Quick Look obtiene USDZ mediante model-viewer; validar acabados en iOS real. Scene Viewer queda excluido mientras los GLB sean URLs blob locales: requiere un archivo accesible al visor externo mediante HTTPS. Añadirlo únicamente cuando exista alojamiento de modelos/exportaciones y una política de retención.
