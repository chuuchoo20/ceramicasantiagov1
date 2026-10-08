# Integración con WordPress

El proyecto se entrega localmente. No se instaló ni publicó en ceramicasantiago.cl.

## Opción recomendada: plugin con iframe

El paquete `output/ceramica-simulador-wordpress.zip` contiene únicamente la aplicación y el adaptador. Puede instalarse en staging desde Plugins → Añadir plugin → Subir plugin. Los pasos siguientes describen la instalación manual equivalente.

1. En staging, crear `wp-content/plugins/ceramica-simulador/`.
2. Copiar dentro `ceramica-simulador.php`, `index.html`, `src/` y `assets/`. No subir `documentos/`, pruebas, `tmp/`, servidor local ni documentos internos.
3. Activar **Simulador Cerámica Santiago (prototipo)** en WordPress.
4. Insertar `[ceramica_simulador]` en un bloque Shortcode de una página de prueba. Después de validar, ubicarlo en la ficha de Enchape Santiago mediante el editor o el template del producto que utilice el sitio.
5. Ajustar la altura del iframe a la maquetación elegida; el ejemplo utiliza 1100 px y permite desplazamiento interno en móvil.

La aplicación queda aislada del CSS de Bootstrap, jQuery, Slider Revolution y demás plugins. No se modifica WooCommerce ni se añaden productos al carrito. Una futura conexión con las variaciones debe mapear el SKU aprobado a `src/catalog.js`, con mensajes `postMessage` de origen validado si se conserva el iframe.

## Requisitos

- HTTPS público válido tanto para la página como para el iframe; mismo origen recomendado.
- Atributo `allow="xr-spatial-tracking; fullscreen"` incluido en el shortcode. Una cabecera `Permissions-Policy` de Nginx/WordPress que deniegue XR o cámara puede prevalecer: verificar configuración existente en staging.
- Servir JavaScript como `text/javascript` y GLB como `model/gltf-binary`.
- Permitir el CDN de jsDelivr, fuentes Google y modelos blob en la política CSP que tenga el sitio. Ajustar sobre la política existente, sin desactivarla globalmente. Alternativamente, alojar localmente dependencias revisadas.
- Excluir el HTML del simulador de transformaciones que reordenen import maps o combinen sus módulos. La página contenedora puede conservar su optimización habitual.

## Prueba AR

Chrome Android con soporte AR: WebXR. Safari iOS compatible: Quick Look, USDZ generado por model-viewer. No asumir que un iPhone o Android particular lo soporta sin comprobarlo. El botón nativo se muestra según capacidad. En escritorio solo se puede verificar carga y exploración del GLB, no su anclaje físico.

Si se exige Scene Viewer, incorporar primero un endpoint HTTPS que aloje la exportación. Las URLs blob locales no pueden ser descargadas por una aplicación nativa externa. No se incluyen endpoints ni acceso al almacenamiento de producción en este prototipo.

## Alternativa sin plugin

Hospedar `index.html`, `src/` y `assets/` bajo una ruta HTTPS del mismo sitio e insertar un iframe equivalente. No pegar el documento completo dentro de un bloque HTML de WordPress: sus scripts/import maps pueden filtrarse o ejecutarse en orden incorrecto.
