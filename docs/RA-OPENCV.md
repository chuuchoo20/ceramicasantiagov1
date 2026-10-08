# «Ver en mi pared»: realidad aumentada con OpenCV

Fecha: 7 de octubre de 2026.

## Qué hace

Al abrir la cámara se muestra un paso a paso ilustrado (5 dibujos de línea, estilo instructivo de armado; `ra/tutorial.js`). El mismo paso a paso está en la sección RA de la página, en el desplegable «Paso a paso: medir y colocar».

1. El usuario entra a la sección **RA** y toca **Ver en mi pared**, que es la única RA de la página.
2. **Paso 1:** apunta a la unión del piso con la pared y toca **Fijar pared**. La línea detectada se dibuja con su distancia.
3. **Pasos 2 a 4, «Medir y colocar»:** es la acción principal y se abre sola al fijar la pared. El usuario toca un extremo del muro a ras de piso, luego el otro extremo y luego la altura a revestir. Mientras mide, se oculta la muralla virtual para ver la pared real. Al tercer toque aparece una vista previa punteada y las medidas.
4. Al tocar **Colocar mi muralla aquí**, la muralla toma ese ancho y alto, y el cálculo de unidades de la página se actualiza. Queda centrada entre los dos extremos tocados y apoyada en el piso.
5. Después, la barra muestra **Medir y colocar** primero, en rojo, para volver a medir cuando se quiera. Siguen **Diseño** (color, traba, medidas), **Comparar** (mantener presionado) y **Foto**.

En pantalla se muestra una sola instrucción a la vez, con el dibujo del paso. Si OpenCV no carga o no encuentra la línea, **Marcar la línea a mano** permite ubicarla con dos puntos. «Usar mis medidas» salta la medición y conserva las medidas del diseño.

## Cómo funciona

| Paso | Archivo | Técnica |
| --- | --- | --- |
| Vertical y orientación | `ra/session.js`, `ra/vision.js` | `DeviceOrientationEvent` → cuaternión de cámara (misma convención que Three.js). Se suaviza con slerp. |
| Bordes y segmentos | `ra/detector.js` | OpenCV.js: escala de grises → Gauss 5×5 → Canny con umbral adaptativo (percentil 90 del gradiente) → `HoughLinesP`. Análisis a 400 px de ancho, unos 22–40 ms por cuadro en el navegador de escritorio. |
| Contraste de región | `ra/detector.js` | Para cada segmento se compara el color medio a ambos lados, cerca y lejos de la línea (se usa el menor) y la densidad de bordes. Un encuentro piso–muro separa dos materiales; una junta de baldosa o de mortero no. |
| Encuentro piso–muro | `ra/vision.js` → `findWallBase` | Cada segmento bajo el horizonte se proyecta al piso (y = 0) usando la altura del teléfono. Luego se agrupan en una **transformada de Hough métrica (θ, ρ)**, donde ρ es la distancia desde los pies del usuario hasta la línea. Puntaje: longitud × contraste² × aristas verticales que nacen en la línea × cobertura × cercanía a la mira × continuidad con el cuadro anterior. |
| Zócalo | `ra/vision.js` | Si hay dos paralelas cuya diferencia equivale a 3–18 cm de altura, se elige la inferior y se recuerda la altura del zócalo. |
| Ángulo piso–muro (90°) | `ra/vision.js` → `squareness` | Las aristas verticales del muro (marcos, esquinas) definen planos de interpretación. Con RANSAC sobre pares se obtiene la dirección vertical real del muro y se compara con el piso. Solo se informa si es observable (incertidumbre ≤ 1,2°). Si no, se asume a plomo. |
| Focal | `ra/vision.js` → `estimateFocal` | Se refina con el punto de fuga vertical cuando el teléfono está inclinado. Se parte de 26 mm equivalentes. |
| Detector de pared | `ra/vision.js` → `wallOrientation`, `fuseOrientation` | Segundo detector que trabaja junto al encuentro. Toda línea 3D horizontal tiene dirección n × arriba (n es la normal de su plano de interpretación). Las hiladas, juntas, cantos de zócalo, dinteles y repisas del muro dan su orientación sin mirar el piso. Se fusiona con la del encuentro, ponderada por la incertidumbre de cada uno. Si discrepan, manda el encuentro. No entrega distancia, porque una sola cámara no ve escala. |
| Seguimiento | `ra/tracking.js`, `ra/session.js` | Cada cuadro se dibuja con la orientación del instante en que la cámara lo **capturó** (`requestVideoFrameCallback`). Antes se usaba la más reciente, que va 50–120 ms adelante del video. Se aplica un filtro One Euro al sensor y se usa RelativeOrientationSensor en Android cuando existe. Con la muralla fijada se re-detecta cada 150 ms. Se toma la mediana de las últimas detecciones, con zona muerta, y la corrección se aplica de forma continua. Si el piso sale del cuadro, el detector de pared sigue corrigiendo la orientación. |
| Proyección | `ra/vision.js` → `wallMatrix` | La malla CSG del estudio y su plano de cantería se colocan con la base sobre el encuentro y la cara hacia el usuario, en una cámara Three.js con los mismos intrínsecos que el video. |
| Escala | `ra/vision.js` → `calibratedHeight` | Todas las medidas son proporcionales a la altura del teléfono (1,40 m por defecto). **Calibrar** con una medida conocida corrige esa altura. |

OpenCV.js (~9 MB sin comprimir, ~3 MB transferidos) se descarga **solo** al abrir la RA. Se intenta en este orden: `assets/vendor/opencv.js` (copia local recomendada para producción), docs.opencv.org y jsDelivr.

## Precisión medida

**Habitaciones sintéticas con OpenCV nativo** (mismo pipeline, `tests/ra_pipeline.py`; 8 casos: baldosas, madera, cemento, muro de ladrillo existente, zócalo, poca luz, muros desplomados, esquina):

- Distancia al muro: error ≤ 0,24 % en los 8 casos.
- Orientación del muro: ≤ 0,3°.
- Ángulo piso–muro cuando hay dos aristas verticales separadas: 90,1° (real 90°), 94,4° (real 93°), 88,9° (real 88°). Con una sola arista o ninguna se informa «no observable» en vez de un valor dudoso.

**Navegador real con OpenCV.js** (escena sintética de la versión anterior, pared a 2,40 m con zócalo de 8 cm):

- 40 de 40 cuadros entre 2,36 y 2,41 m mientras se gira el teléfono. El zócalo se detectó con 8–9 cm.
- La base del muro virtual queda a 0,3–0,7 cm del encuentro real.
- La medición de dos marcos de puerta separados por 0,90 m y de un dintel a 2,05 m entregó 0,90 m y 2,05 m.

**Detector de pared** (mismas 8 habitaciones, partiendo de una orientación con 3° de error):

- Muro de ladrillo: 110 líneas, error 0,07°. Poca luz: 5 líneas, −0,10°.
- Muros lisos pintados: pocas líneas o ninguna. En ese caso manda el encuentro piso–muro. Este detector ayuda en muros con textura, zócalos, marcos y muebles.

**Tiritón** (`node tests/ra-jitter.mjs`): simulación con temblor de la mano, deriva de ±1 cm, ruido del sensor, video con 90 ms de latencia y 10 % de detecciones erróneas.

| Ruido del sensor | Antes: tiritón / error p95 | Ahora: tiritón / error p95 |
| --- | --- | --- |
| 0,03° | 1,63 px / 10,3 px | 1,23 px / 6,4 px |
| 0,1° | 1,91 px / 10,3 px | 1,45 px / 6,5 px |
| 0,2° | 2,62 px / 10,4 px | 2,07 px / 7,1 px |

**Navegador real con cámara sintética.** Un arnés de prueba reemplaza la cámara por un video 3D de un muro de ladrillo y emite sensores con 80 ms de desfase. Es solo para pruebas y no está en la página.

- Pared a 2,41 m (real 2,40 m) y orientación −96,01° (real −96°). El muro se confirmó con 51 líneas.
- Con la muralla fijada, durante 4 s, la distancia varió 2,2 mm (desviación) y la orientación 0,026°.
- El desfase entre la orientación usada y la del video bajó de 0,18° a 0,09°.

## Límites conocidos (decirlo al cliente)

- **La escala depende de la altura del teléfono.** Un error de 10 cm en esa altura (de 1,40 m) produce un 7 % de error. Calibrar con una huincha lo elimina.
- **El ángulo hacia el usuario** (desplome) solo es observable con dos aristas verticales separadas en la imagen. El ángulo a lo largo del muro siempre lo entregan los sensores.
- Si el zócalo es del mismo tono que el piso, en ángulos rasantes puede fijarse su borde superior (+6 % en distancia). Conviene «Marcar la línea a mano» o calibrar.
- Sin SLAM: si el usuario camina varios metros, la pared se re-ancla con la detección, pero el desplazamiento a lo largo del muro no es observable. Se arrastra con el dedo. El tiritón que queda viene del movimiento de la mano: el navegador no sabe cuánto se desplazó el teléfono, solo cuánto giró. Eliminarlo del todo requiere seguimiento 6DoF (ARCore en Android con WebXR, ARKit en iPhone).
- El detector de pared necesita líneas horizontales en el muro. En un muro liso pintado no aporta nada.
- Requiere HTTPS, cámara y sensores de movimiento. En iPhone se pide el permiso de movimiento al tocar «Activar cámara». En un iframe de WordPress, el `allow` debe incluir `camera; accelerometer; gyroscope` (ya actualizado en `ceramica-simulador.php`).
- No hay oclusión: muebles delante de la pared quedan detrás del render.

## Probar

- `?ra-debug` dibuja todos los segmentos de OpenCV (rojo = contraste de región alto).
- `npm run test:ra`: 19 pruebas.
  - Geometría: proyección, detección, zócalo, ángulos, focal, medición, calibración y pose.
  - Detector de pared y fusión.
  - Sensor por cuaternión.
  - Seguimiento: buffer de orientación, One Euro, anclaje y simulación de tiritón.
- `node tests/ra-jitter.mjs`: tabla del tiritón, antes y después.
- Validación con OpenCV nativo (requiere Python con `opencv-python` y `numpy`):

  ```powershell
  node tests/ra-synthetic.mjs cases > tmp/ra-cases.json
  python tests/ra_pipeline.py tmp/ra-cases.json tmp/ra-segments.json tmp/ra-renders
  node tests/ra-synthetic.mjs evaluate tmp/ra-cases.json tmp/ra-segments.json
  ```

## Pendiente de validación física

- Probar en Android (Chrome) e iPhone (Safari) reales por HTTPS. Verificar distancia contra una huincha a 1,5 m, 2,5 m y 4 m, con y sin zócalo, y con piso de baldosa, madera y cerámica brillante.
- Medir el rendimiento en un teléfono de gama media. La frecuencia de detección se adapta sola (≤ 40 % del tiempo en visión).
- Alojar `opencv.js` en el mismo hosting (`assets/vendor/`) para no depender de terceros.
