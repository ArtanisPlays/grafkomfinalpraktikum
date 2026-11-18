import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Kerangka bersama untuk semua demo eksplorasi:
 * renderer + scene + kamera perspektif + OrbitControls + label judul.
 */
export function setup({ title, note = "", camPos = [6, 4, 8], target = [0, 1, 0], background = 0x1a1f2b, shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(...camPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.update();

  const label = document.createElement("div");
  label.className = "label";
  label.innerHTML = `<b>${title}</b>${note ? `<br>${note}` : ""}`;
  document.body.appendChild(label);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, label };
}

/** Render loop; menandai window.__READY__ setelah beberapa frame (dipakai untuk screenshot otomatis). */
export function loop({ renderer, scene, camera, controls }, onFrame = () => {}) {
  const clock = new THREE.Clock();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    onFrame(clock.elapsedTime, dt);
    controls.update();
    renderer.render(scene, camera);
    if (++frames === 30) window.__READY__ = true;
  });
}

/** Lantai abu-abu yang menerima bayangan. */
export function floor(scene, size = 30, color = 0x8a8f99) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export const PAGE_STYLE = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: #111; font-family: system-ui, sans-serif; }
  .label { position: fixed; left: 16px; top: 14px; color: #f2f4f8; background: rgba(10, 14, 22, 0.72);
           padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.45; max-width: 520px; }
  .label b { font-size: 16px; }
`;
