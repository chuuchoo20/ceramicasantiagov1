# Texturas reales de terminación

El simulador usa una foto real por terminación. Esa foto se aplica en todos
los productos que ofrecen la terminación: pieza 3D, muralla, RA y GLB
descargado. Las terminaciones sin foto muestran un relieve generado por
código.

## Estado actual

| Terminación | Carpeta | Lado real de la foto (`sizeM`) | Giro | Productos |
|---|---|---|---|---|
| Rústico | `assets/textures/rustico/` | 10 cm | — | Enchape Santiago; ladrillos Princesa Santiago (S7, S9, S11), Santiagote, Thermo Murotón y Mitad; quiebravistas Santiago, Pitelli e Italia; Adoquín Princesa y Baldosín |
| Liso | `assets/textures/liso/` | 12 cm | — | Los de Rústico, más los ladrillos Megabloque y Ducto |
| Ranurado | `assets/textures/ranurado/` | 12 cm (16 ranuras, paso ≈ 7,5 mm) | 90°, las ranuras siguen el largo de la pieza | Ladrillos Princesa Santiago, Santiagote, Fiscal Princesa, Thermo Murotón y Mitad; quiebravista Foratone |
| Rasguñado | — | relieve generado | | Enchape Santiago |
| Nueva York | — | relieve generado | | Enchape Nueva York |

El lado real de cada foto (`sizeM`) es una estimación hecha a partir del grano
y de las ranuras. Si conoces la medida real, corrige el valor en
`CONFIG.textures` dentro de `index.html`.

## Cómo funciona

- **UV en metros.** Cada pieza se construye con coordenadas de textura en
  metros (`pieceGeometry`):
  - en el frente, largo × alto;
  - en el canto, largo × espesor;
  - en la cabeza, espesor × alto.

  Así la foto se ve a su tamaño real en piezas de cualquier medida y en
  cualquier traba (sardinel, espiga). Las caras del corte de la muralla
  también tienen sus coordenadas en metros.
- **Sin repeticiones visibles.** Cada pieza toma un recorte distinto de la
  foto. Las fotos se preparan para repetirse sin costuras.
- **Color.**
  - El color base de la foto (`base: 'Natural'`) la muestra tal cual.
  - Con otro color del catálogo, la foto se tiñe en espacio lineal: se
    multiplica por el color elegido dividido por el color medio de la foto.
    Así conserva el grano y el tono queda como el elegido.
  - El teñido queda guardado en la textura, de modo que el GLB sigue siendo
    válido.
- **Carga diferida.** La foto se descarga solo cuando se elige su terminación.
  Mientras carga, o si no se puede cargar (por ejemplo, al abrir `index.html`
  sin servidor), se ve el relieve generado.

## Perfil de color de las fotos

Las fotos de producto vienen de Photoshop en **ProPhoto RGB**, un espacio de
color más amplio que el de una pantalla normal. El navegador lee ese perfil y
las muestra bien. Paint y la mayoría de los motores 3D no lo leen: ahí se ven
apagadas, «color cartón». Por eso `scripts/texturas.py` convierte cada foto a
sRGB con su perfil antes de procesarla. Si preparas texturas a mano, exporta en
**sRGB**: en Photoshop, *Edición → Convertir en perfil → sRGB IEC61966-2.1*.

## Sumar una textura nueva

1. **Foto.**
   - De frente, con luz pareja y difusa, sin sombras ni brillos y enfocada.
   - Solo la superficie de la pieza: sin juntas ni bordes.
   - Cuadrada, idealmente de 1200 px o más.
   - Anota cuántos centímetros cubre.
2. **Prepararla.** Requiere `pip install numpy scipy pillow`.

   ```bash
   python3 scripts/texturas.py foto.png rasgunado --relieve 2.4 --suavizado 1.2
   # con ranuras verticales en la foto:
   python3 scripts/texturas.py foto.png ranurado --ranuras --relieve 3.5 --suavizado 2
   ```

   El script hace lo siguiente:
   - quita el gradiente de luz;
   - vuelve la foto repetible sin costuras (con ranuras, sin duplicarlas);
   - escribe `color.jpg`, `normal.jpg` y `thumb.jpg` en
     `assets/textures/<nombre>/`;
   - imprime la línea para `CONFIG.textures` con el color medio (`mean`).
3. **Registrarla.** Pega esa línea en `CONFIG.textures` de `index.html` con el
   nombre exacto de la terminación como clave, por ejemplo `'Rasguñado'`.
   - Ajusta `sizeM` (el lado real de la foto, en metros).
   - Ajusta `rotate`: `Math.PI/2` si el dibujo de la foto va en vertical y en
     la pieza debe ir a lo largo.
4. **Color propio (opcional).** Si hay una foto propia de un color, por
   ejemplo Rústico Chocolate, regístrala con la clave
   `'Rústico/Chocolate'`. Tiene prioridad sobre `'Rústico'` y no se tiñe
   cuando `base` es ese color.
5. **Publicar.** `npm run build` copia `assets/textures/` a `dist/`. Luego
   publica como siempre con `publicar.bat`.

## Pendiente de confirmar

- **Productos de cada foto.** No sabemos de qué producto es cada foto. Hoy se
  aplican a todos los productos con esa terminación.
- **Tono de Natural.** Las fotos son de un terracota más claro (por ejemplo,
  Rústico #de8569) que la muestra Natural del catálogo (#ae593b). Hay dos
  opciones:
  - mantener la foto tal cual, que es lo actual;
  - teñir también Natural; para eso se cambia `base` a otro color.
- **Escala real.** Falta la medida real que cubre cada foto (`sizeM`).
