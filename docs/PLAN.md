# Plan del proyecto

## Objetivo y alcance

Insertar una experiencia independiente en la página de Enchape Santiago, compatible con el WordPress existente. El simulador permite elegir una pieza de ladrillo, una pieza de enchape o un muro de enchapes y explorar los mismos parámetros en 3D, sobre foto y en AR.

## Fuentes revisadas

- `documentos/Manual_Enchapes-V040326_c.pdf`, especialmente páginas 5–6 (formatos, patrones y variantes) y 10 (recomendación de cantería).
- Captura de formatos de instalación y captura de la página de inicio: identidad roja, blanca y neutra.
- Tres capturas de `documentos/prototipos`: selección pieza/muro, medidas, panel paramétrico y acción AR. Se consideran referencias de UI, no fichas de producto.
- https://ceramicasantiago.cl/ladrillos/enchape-santiago/ (consultada el 23-09-2026).
- https://modelviewer.dev/examples/augmentedreality/ (requisitos de AR, HTTPS y permisos iframe).
- https://threejs.org/docs/ (render y exportación).

Se excluyó por completo la carpeta de texturas de enchapes.

## Catálogo adoptado

| Línea | Dimensiones, cm | Variantes |
| --- | --- | --- |
| Nacional | 24 × 5,5 × 1,3 | Natural: liso, rasguñado, rústico; Arcilla: liso, rasguñado, rústico; Envejecido: liso, rasguñado; Siena: rústico |
| Importado | 24 × 6 × 1,3 | Chocolate, Marfil y Gris Urbano: rasguñado |
| Ladrillo de prueba | 29 × 11,3 × 14, editable | Macizo o ranurado, tonos de exploración; falta confirmar catálogo oficial |

Las canterías 8/10/12/14 mm están disponibles para exploración. El manual recomienda no exceder 10 mm, aunque incluye rendimientos con juntas superiores. La UI lo informa al elegirlas. El manual contiene “Peso (kg): 1,3 cm” en el importado, dato inconsistente que no se utiliza.

## Flujo del usuario

1. **Entrada.** Desde la ficha de producto, abrir o desplazarse al simulador. Primera vista: muro nacional natural, 2,4 × 1,6 m, media traba, cantería 10 mm. No se solicita cámara ni archivo al entrar.
2. **Objeto.** Elegir ladrillo, enchape o muro. Cada uno expone tipo/línea, color, terminación y dimensiones. El enchape cambia su altura nominal al cambiar de línea; el ladrillo de prueba permite largo, alto y fondo.
3. **Muro.** Elegir patrón, dimensiones reales, junta, tono, forma, abertura y política de cortes. Cantidad y área se recalculan. La abertura se centra y se limita al espacio disponible.
4. **Sobre foto.** Subir imagen local o usar ambiente ilustrativo. Mover las esquinas 1–4 en orden. Se conserva el contenido al cambiar de modo; cambiar de objeto restablece el encuadre de colocación. La cara frontal se adapta mediante una homografía; las medidas físicas vienen de los campos, no de la foto.
5. **AR.** Preparar el GLB de la selección actual; mostrar el visor. En dispositivo compatible, pulsar su botón de colocación. El ladrillo se coloca en suelo; enchape y muro solicitan pared. El soporte real depende del sistema. En escritorio se mantiene una vista 3D con explicación.
6. **Salida.** Guardar imagen, GLB o configuración. La futura integración comercial podrá vincular SKU y solicitud de cotización después de confirmar los productos.

## Correcciones al prompt original

- Un Raycaster a Z=0 y un test del centro no producen perspectiva ni cortes correctos. Se usa una homografía para foto y recorte geométrico real para muros. El mismo trazado alimenta ambas vistas.
- Un único InstancedMesh no representa por sí solo cortes oblicuos y vanos. Las piezas completas comparten BoxGeometry/material; los fragmentos se extruyen y agrupan. No se mantiene un objeto 3D por cada enchape completo.
- El patrón espiga tiene una retícula propia con rectángulos ortogonales girados 45°. Se comprueba que no se solapen.
- La exportación convierte instancias a mallas convencionales, conservando los colores por vértice. Así el GLB no exige extensiones de instanciamiento al visor nativo.
- No se dispara AR tras una operación asíncrona sin gesto adicional: preparar y colocar son pasos separados. No se ofrece Scene Viewer con un blob local.
- No se mezclan todos los colores con todas las líneas. El catálogo representa las 12 combinaciones documentadas.
- Se mantiene una página única sin bundler, pero se separan estilos, catálogo y motor para revisión y pruebas.

## Etapas siguientes y criterios de aceptación

### 1. Prototipo local — implementado

Objetos, controles, foto, cuatro puntos, patrones y archivos exportables. Pruebas geométricas y revisión visual en navegador. Los acabados se identifican como de prueba.

### 2. Contenido real

Recibir fichas de ladrillos y lista de SKU; vincular modelos y mapas PBR según `assets/README.md`. Validar unidades, proporciones, UV, combinaciones y apariencia. Implementar textura fotográfica en el compositor de foto, que hoy usa rellenos procedurales. Sustituir la marca tipográfica de referencia por logo oficial autorizado.

### 3. Piloto WordPress HTTPS

Instalar el plugin en staging y añadir el shortcode. Probar Safari iOS/Quick Look y Chrome Android/WebXR físicamente. Verificar permiso iframe, escala con cinta métrica, colocación vertical, retorno de AR, orientación de cámara/foto y rendimiento móvil. Verificar que el simulador no cambia el selector ni carrito de WooCommerce.

### 4. Producción

Hospedar dependencias/versiones aprobadas si se requiere evitar CDN, optimizar activos, definir caché y políticas CSP. Si se necesita Scene Viewer, implementar almacenamiento temporal de GLB mediante HTTPS con validación, límites, limpieza y sin incluir fotos. Añadir reapertura de configuraciones y enlace de cotización con SKU confirmado; acordar antes eventos de analítica y consentimiento. Publicar después de validar con el equipo.

## Límites del prototipo

Una superficie por foto; abertura rectangular central; muro rectangular o con remate inclinado; sin L/curvas, esquinas tridimensionales, oclusión automática, estimación de medidas por IA ni cubicación comercial. Los límites de UI son 6 × 4 m y 12.000 piezas para acotar memoria. El QR de transferencia se incorporó al publicar en Firebase: comparte y recupera parámetros, no fotografías. `localhost` de un computador no es accesible desde el teléfono; usar la URL pública de Hosting. Consultar `docs/FIREBASE.md`.
