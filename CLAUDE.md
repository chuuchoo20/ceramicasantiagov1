# CLAUDE.md — Simulador Cerámica Santiago

Estudio de revestimientos (piezas 3D, muralla y realidad aumentada) para insertar
bajo el header de ceramicasantiago.cl. Responder siempre en español.

## Reglas de este proyecto

- Repositorio: https://github.com/chuuchoo20/ceramicasantiagov1 (rama `main`, remoto `origin`).
  Hacer `git push` solo cuando el usuario lo pida; los commits quedan locales hasta entonces.
- **No publicar en Firebase** (`publicar.bat` / `npm run deploy`) sin confirmación.
- Cambios quirúrgicos: el proyecto está casi listo, se ajustan detalles.
- Respetar el sistema de diseño de ceramicasantiago.cl (tokens en `:root` de `index.html`):
  rojo `--red #d51314`, gris carbón `--ink #1f1f1f`, títulos en mayúsculas,
  pestañas subrayadas, tarjetas blancas, botones píldora. Iconos: Phosphor (CDN).
- Verificar cada cambio visual en la vista previa a 375 × 812 (celular) y sin
  errores de consola.

## Dónde está cada cosa

- **`index.html` es la app real**: todo el HTML, CSS (`<style>`, l. ~10–210) y JS
  (`<script type="module">`, l. ~315–1229) en un archivo. Sin bundler.
  - `CONFIG` (colores, texturas, patrones, límites) y `CATALOG` (productos, formatos,
    variantes) al inicio del módulo.
  - Geometría de muralla: `buildLayout`, `createCutWall` (CSG con three-bvh-csg).
  - Estado: `APP_STATE`, `change()`, historial `commit()`/`travel()`, `persist()` en localStorage.
  - Medidas: ancho × alto son siempre el rectángulo que encierra el contorno
    (`fitFrameToPolygon`, llamado desde `movePin`); `syncSize` actualiza los campos.
  - UI: `renderCatalog`, `renderProductControls`, `syncUI`, `renderNext` (botón rojo
    del paso siguiente), `selectSection` (Objetos · Muralla · RA), `createControls`.
  - Layout: en escritorio (≥ 960 px) visor a la izquierda y un solo panel a la derecha
    (pestañas, opciones con scroll, botón fijo); el botón ⇄ (`#swap-side`) los invierte.
  - Exportación GLB: `getExport`, `download`, `validateGLB`.
- **`ra/`**: RA propia con OpenCV.js; `index.html` carga `ra/session.js` y
  `ra/tutorial.js` solo al abrir la cámara. Detalle en `docs/RA-OPENCV.md`.
- **`src/`**: versión modular anterior. `index.html` no la usa; el build la copia
  igual y algunos tests (`geometry`, `share`) la prueban.
- **`assets/textures/`**: fotos reales (liso, ranurado, rústico). Ver `docs/TEXTURAS.md`.
- **Datos de producto**: `docs/CATALOGO.md`. Referencias visuales: `documentos/`
  (no se publica).
- El README mezcla novedades actuales (arriba) con historia de versiones previas
  (model-viewer, versión modular): lo vigente es la sección «Novedades».

## Comandos

```
npm ci              # dependencias (solo para tests, build y deploy)
npm start           # servidor en http://localhost:4173 (.claude/launch.json → "simulador")
npm test            # 54 pruebas; requiere la carpeta tmp/ (está en .gitignore)
npm run test:ra     # 20 pruebas de RA
npm run build       # genera dist/ con lista explícita de archivos públicos
```

Three.js 0.180.0, three-bvh-csg y three-mesh-bvh se cargan por CDN (importmap en
`index.html`); las versiones npm son solo para pruebas. Si se cambia una versión,
cambiarla en ambos lados.

## Publicación

- Firebase Hosting, carpeta `dist/`. Proyecto actual `ceramicasar-5ca08`
  (https://ceramicasar-5ca08.web.app); anterior `ceramicasantiago-61f9d`.
- WordPress: `ceramica-simulador.php` inserta un iframe con `[ceramica_simulador]`
  (ver `docs/WORDPRESS.md`).
- Pendiente: validar la RA en teléfonos reales con HTTPS; el escritorio no la prueba.

## Herramientas recomendadas

- Cambios de detalle: edición directa + vista previa celular; para rediseñar una
  sección entera, `/impeccable` (no mezclar con frontend-design / taste-skill / ui-ux-pro-max).
- Lista de cambios del usuario → `superpowers:writing-plans`; antes de cerrar →
  `superpowers:verification-before-completion`; al cerrar un grupo → `/code-review`.
- Three.js, texturas, CSG → `3d-web-experience` + context7 para documentación.
- Errores (sobre todo RA) → `superpowers:systematic-debugging` o agente `debugger`.
- Rendimiento móvil → chrome-devtools (Lighthouse). Accesibilidad → `design:accessibility-review`.
- Comparar con imágenes de referencia → agente `ui-ux-designer`.
