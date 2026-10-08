// =====================================================================
// RA · Habitación de demostración
// Sustituye cámara y sensores cuando no hay teléfono (escritorio, pruebas).
// Renderiza una habitación con Three.js usando la MISMA cámara del motor, de
// modo que OpenCV analiza una imagen con geometría conocida. Arrastrar con el
// dedo/mouse simula girar el teléfono.
// =====================================================================
import * as V from './vision.js';

export function createDemoSource(THREE, opts = {}) {
  const truth = { rho: opts.rho ?? 2.4, thetaDeg: opts.thetaDeg ?? -84, h: opts.h ?? 1.4 };
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeeeeec);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 2.2));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.4); sun.position.set(2, 4, 3); scene.add(sun);

  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  // Piso: baldosas de 60 cm con fragüe.
  const floorTex = tex(512, 512, (g, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 196 + ((i * 7 + j * 13) % 5) * 5; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4); }
    g.fillStyle = '#8d877c'; for (let i = 0; i <= 4; i++) { g.fillRect(i * w / 4 - 2, 0, 4, h); g.fillRect(0, i * h / 4 - 2, w, 4); }
  });
  floorTex.repeat.set(20 / 2.4, 20 / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // Muro: plano vertical sobre la línea (θ, ρ) con zócalo y una puerta.
  const line = { theta: truth.thetaDeg * Math.PI / 180, rho: truth.rho };
  const wall = new THREE.Group(); wall.matrixAutoUpdate = false; wall.matrix.fromArray(V.wallMatrix(line, 0, 0, 0)); scene.add(wall);
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.95 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), paint); plane.position.set(0, 1.3, 0); wall.add(plane);
  const base = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.015), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); base.position.set(0, 0.04, 0.0075); wall.add(base);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }), doorMat = new THREE.MeshStandardMaterial({ color: 0x8a6646, roughness: 0.7 });
  for (const x of [-0.95, -0.05]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.05, 0.02), frameMat); f.position.set(x, 1.025, 0.01); wall.add(f); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.07, 0.02), frameMat); top.position.set(-0.5, 2.05, 0.01); wall.add(top);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.83, 2.01), doorMat); door.position.set(-0.5, 1.005, 0.003); wall.add(door);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshStandardMaterial({ color: 0x5b6b73 })); pic.position.set(0.9, 1.55, 0.004); wall.add(pic);
  // Pared lateral (esquina) a la derecha.
  const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: 0.95 }));
  const sideLine = { theta: line.theta + Math.PI / 2, rho: 1.6 }, sideGroup = new THREE.Group(); sideGroup.matrixAutoUpdate = false; sideGroup.matrix.fromArray(V.wallMatrix(sideLine, 0, 0, 0)); side.position.set(0, 1.3, 0); sideGroup.add(side); scene.add(sideGroup);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  let yaw = 0, pitch = 22, t0 = performance.now();
  return {
    element: canvas, truth, isDemo: true,
    get videoWidth() { return canvas.width; }, get videoHeight() { return canvas.height; },
    // Orientación simulada: arrastre + leve vaivén de mano.
    orientation() {
      const t = (performance.now() - t0) / 1000;
      return V.quatFromDeviceOrientation(yaw + Math.sin(t * 0.6) * 0.6, 90 - pitch + Math.sin(t * 0.9) * 0.4, Math.sin(t * 0.7) * 0.5, 0);
    },
    setPose(y, p) { yaw = y; pitch = p; }, // para pruebas automáticas
    pointer(type, dx, dy) {
      if (type === 'move') { yaw = Math.max(-40, Math.min(40, yaw + dx * 0.12)); pitch = Math.max(3, Math.min(70, pitch + dy * 0.12)); }
    },
    render(cam) {
      if (canvas.width !== cam.width || canvas.height !== cam.height) { renderer.setSize(cam.width, cam.height, false); }
      camera.fov = V.verticalFov(cam); camera.aspect = cam.width / cam.height; camera.updateProjectionMatrix();
      camera.position.set(0, truth.h, 0); camera.quaternion.set(...cam.q);
      renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); scene.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); }
  };
}
