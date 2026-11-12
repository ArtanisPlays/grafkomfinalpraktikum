import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import "./style.css";
import { LAYOUT_SPEC } from "./scene/layoutSpec.js";
import { createMaterials } from "./scene/materials.js";
import { createBuilding } from "./scene/building.js";
import { createFurniture } from "./scene/furniture.js";
import { createStalls } from "./scene/stalls.js";
import { createProps } from "./scene/props.js";
import { createOutdoor } from "./scene/outdoor.js";
import { createDetails } from "./scene/details.js";
import { createStallClutter } from "./scene/stallClutter.js";
import { createPeople } from "./scene/people.js";
import { createSurroundings } from "./scene/surroundings.js";
import { createAtmosphere } from "./scene/atmosphere.js";
import { createFloorReflection } from "./scene/reflection.js";
import { createPipeline, QUALITY_LEVELS, QUALITY_ORDER } from "./scene/pipeline.js";
import { mergeStaticMeshes } from "./scene/optimize.js";
import { updateAnimators } from "./scene/animation.js";

const appEl = document.getElementById("app");
const cameraBarEl = document.getElementById("camera-bar");
const infoEl = document.getElementById("info");
const loadingEl = document.getElementById("loading");
const loadingStepEl = document.getElementById("loading-step");
const timeSliderEl = document.getElementById("time-slider");
const timeLabelEl = document.getElementById("time-label");
const timeChipsEl = document.getElementById("time-chips");
const qualityEl = document.getElementById("quality-select");
const walkBtnEl = document.getElementById("walk-btn");
const walkHintEl = document.getElementById("walk-hint");
const statsEl = document.getElementById("stats");

/* ------------------------------------------------------------------ */
/* Renderer, camera, controls                                          */
/* ------------------------------------------------------------------ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 420);
const initialPreset = LAYOUT_SPEC.cameraPresets[0];
camera.position.set(...initialPreset.position);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Nothing that casts a sun shadow moves, so the 4K shadow map is rendered once per time-of-day change
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false;
appEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...initialPreset.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.6;
controls.maxDistance = 85.0;
controls.maxPolarAngle = Math.PI * 0.497;
controls.zoomSpeed = 0.9;
controls.update();

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

const worldGroup = new THREE.Group();
worldGroup.name = "AsramaCommunalWorld";
scene.add(worldGroup);

let atmosphere = null;
let pipeline = null;
let reflector = null;
let materials = null;
let ready = false;

// Materials whose glow follows the hour (lamp globes, lit windows, signage)
const nightGlows = [];
// Artificial lights: { light, day, night }
const lampLights = [];

function addLamp(x, y, z, { color = 0xffe2b0, day = 0, night = 10, distance = 11, decay = 1.7 } = {}) {
  const light = new THREE.PointLight(color, night, distance, decay);
  light.position.set(x, y, z);
  light.userData.dynamic = true;
  scene.add(light);
  lampLights.push({ light, day, night });
  return light;
}

function setupLampLights() {
  const { stalls, officeRoom } = LAYOUT_SPEC;

  // Fluorescent tubes inside each food stall and the office stay on all day
  for (const booth of stalls.booths) {
    addLamp((booth.minX + booth.maxX) / 2, 2.55, -4.9, { color: 0xfff1d6, day: 5.5, night: 9, distance: 8 });
  }
  addLamp((officeRoom.minX + officeRoom.maxX) / 2, 2.75, -4.3, { color: 0xf4f8ff, day: 5, night: 9, distance: 8 });

  // Pendant rows of the lesehan hall (two lights stand in for each row of five)
  addLamp(-8.5, 4.05, 5.5, { night: 26, distance: 14 });
  addLamp(-1.0, 4.05, 5.5, { night: 26, distance: 14 });
  addLamp(6.5, 4.05, 5.5, { night: 26, distance: 14 });
  addLamp(-6.0, 4.9, 0.8, { night: 24, distance: 14 });
  addLamp(4.0, 4.9, 0.8, { night: 24, distance: 14 });

  // Steel dining wing and the mezzanine deck
  addLamp(18.5, 3.95, -9.0, { night: 26, distance: 14 });
  addLamp(14.0, 3.95, -11.0, { night: 20, distance: 12 });
  addLamp(-1.0, 5.9, -4.2, { night: 16, distance: 13 });
}

function applyAtmosphereState(state) {
  renderer.toneMappingExposure = state.exposure;
  const f = state.lampFactor;
  for (const entry of lampLights) {
    const intensity = entry.day + (entry.night - entry.day) * f;
    entry.light.intensity = intensity;
    entry.light.visible = intensity > 0.02;
  }
  for (const glow of nightGlows) {
    glow.material.emissiveIntensity = glow.day + (glow.night - glow.day) * f;
  }
  renderer.shadowMap.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Camera presets                                                      */
/* ------------------------------------------------------------------ */

let transitionState = null;
const presetButtons = new Map();

function goToPreset(presetIndex) {
  const preset = LAYOUT_SPEC.cameraPresets[presetIndex];
  if (!preset) return;
  if (walk.active) exitWalk();

  transitionState = {
    targetPos: new THREE.Vector3(...preset.position),
    targetLook: new THREE.Vector3(...preset.target)
  };
  for (const [idx, btn] of presetButtons.entries()) {
    btn.classList.toggle("active", idx === presetIndex);
  }
}

LAYOUT_SPEC.cameraPresets.forEach((preset, idx) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = idx === 0 ? "preset-btn active" : "preset-btn";
  btn.textContent = preset.label;
  btn.addEventListener("click", () => goToPreset(idx));
  cameraBarEl.appendChild(btn);
  presetButtons.set(idx, btn);
});

controls.addEventListener("start", () => {
  transitionState = null;
});

/* ------------------------------------------------------------------ */
/* Time of day + quality UI                                            */
/* ------------------------------------------------------------------ */

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hh = m === 60 ? h + 1 : h;
  const mm = m === 60 ? 0 : m;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function setTime(hours, { fromSlider = false } = {}) {
  const clamped = Math.min(21, Math.max(5.5, hours));
  if (!fromSlider) timeSliderEl.value = String(clamped);
  timeLabelEl.textContent = formatTime(clamped);
  for (const chip of timeChipsEl.querySelectorAll(".chip")) {
    chip.classList.toggle("active", Math.abs(Number(chip.dataset.time) - clamped) < 0.03);
  }
  if (atmosphere) atmosphere.setTime(clamped);
}

timeSliderEl.addEventListener("input", () => setTime(Number(timeSliderEl.value), { fromSlider: true }));
timeChipsEl.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) setTime(Number(chip.dataset.time));
});

let autoQuality = true;

function setQuality(level, { manual = false } = {}) {
  if (!QUALITY_LEVELS[level]) return;
  if (manual) autoQuality = false;
  qualityEl.value = level;
  if (pipeline) pipeline.setQuality(level);
  fpsWindow.frames = 0;
  fpsWindow.time = 0;
}

qualityEl.addEventListener("change", () => setQuality(qualityEl.value, { manual: true }));

/* ------------------------------------------------------------------ */
/* Walk mode (first person, eye level)                                 */
/* ------------------------------------------------------------------ */

const walk = {
  active: false,
  yaw: 0,
  pitch: 0,
  lift: 0,
  eyeY: 1.6,
  keys: new Set(),
  dragging: false,
  wasLocked: false
};
const _dir = new THREE.Vector3();
const canvas = renderer.domElement;

function groundAt(x, z) {
  const a = LAYOUT_SPEC.wings.mainHall;
  const b = LAYOUT_SPEC.wings.steelWing;
  const insideA = x > a.minX && x < a.maxX && z > a.minZ && z < a.maxZ;
  const insideB = x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
  return insideA || insideB ? LAYOUT_SPEC.floorY : LAYOUT_SPEC.exteriorGroundY;
}

function enterWalk() {
  if (walk.active || !ready) return;
  walk.active = true;
  transitionState = null;
  controls.enabled = false;

  camera.getWorldDirection(_dir);
  const highUp = camera.position.y > 3.2 || Math.abs(camera.position.x) > 30 || Math.abs(camera.position.z) > 24;
  if (highUp) {
    // Drop in at the west end of the lesehan hall, looking down its length
    camera.position.set(-11.2, 1.6, 6.4);
    walk.yaw = -Math.PI / 2 - 0.25;
    walk.pitch = -0.04;
  } else {
    walk.yaw = Math.atan2(-_dir.x, -_dir.z);
    walk.pitch = Math.asin(THREE.MathUtils.clamp(_dir.y, -0.95, 0.95));
  }
  walk.lift = 0;
  walk.eyeY = camera.position.y;
  walk.keys.clear();

  document.body.classList.add("walking");
  walkHintEl.hidden = false;
  walkBtnEl.classList.add("active");
  walkBtnEl.textContent = "Exit walk (F)";
  for (const btn of presetButtons.values()) btn.classList.remove("active");
  requestLock();
}

function exitWalk() {
  if (!walk.active) return;
  walk.active = false;
  walk.dragging = false;
  walk.keys.clear();
  if (document.pointerLockElement === canvas) document.exitPointerLock();

  camera.getWorldDirection(_dir);
  _dir.y = Math.min(_dir.y, -0.08);
  controls.target.copy(camera.position).addScaledVector(_dir.normalize(), 4);
  controls.enabled = true;
  controls.update();

  document.body.classList.remove("walking");
  walkHintEl.hidden = true;
  walkBtnEl.classList.remove("active");
  walkBtnEl.textContent = "Walk mode (F)";
}

function requestLock() {
  try {
    const result = canvas.requestPointerLock?.();
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // Pointer lock unavailable: drag-to-look and the arrow keys still work
  }
}

function updateWalk(dt) {
  const k = walk.keys;
  const turn = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0);
  const tilt = (k.has("ArrowUp") && k.has("Alt") ? 1 : 0) - (k.has("ArrowDown") && k.has("Alt") ? 1 : 0);
  walk.yaw += turn * dt * 1.7;
  walk.pitch = THREE.MathUtils.clamp(walk.pitch + tilt * dt * 1.2, -1.35, 1.35);

  const forward = (k.has("KeyW") || (k.has("ArrowUp") && !k.has("Alt")) ? 1 : 0) - (k.has("KeyS") || (k.has("ArrowDown") && !k.has("Alt")) ? 1 : 0);
  const strafe = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
  const rise = (k.has("KeyE") ? 1 : 0) - (k.has("KeyQ") ? 1 : 0);
  const speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? 5.2 : 2.3) * dt;

  if (forward || strafe) {
    const len = Math.hypot(forward, strafe);
    const fx = -Math.sin(walk.yaw);
    const fz = -Math.cos(walk.yaw);
    camera.position.x += ((fx * forward - fz * strafe) / len) * speed;
    camera.position.z += ((fz * forward + fx * strafe) / len) * speed;
  }
  const world = LAYOUT_SPEC.bounds.world;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, world.minX - 14, world.maxX + 14);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, world.minZ - 10, world.maxZ + 14);

  walk.lift = THREE.MathUtils.clamp(walk.lift + rise * dt * 2.2, -1.0, 9);
  const targetY = groundAt(camera.position.x, camera.position.z) + 1.6 + walk.lift;
  walk.eyeY += (targetY - walk.eyeY) * Math.min(1, dt * 9);
  // A touch of head bob while moving on foot
  const bob = forward || strafe ? Math.sin(performance.now() * 0.011) * 0.014 : 0;
  camera.position.y = walk.eyeY + bob;

  camera.rotation.order = "YXZ";
  camera.rotation.set(walk.pitch, walk.yaw, 0);
}

walkBtnEl.addEventListener("click", () => {
  if (walk.active) exitWalk();
  else enterWalk();
  walkBtnEl.blur();
});

canvas.addEventListener("pointerdown", () => {
  if (!walk.active) return;
  walk.dragging = true;
  if (document.pointerLockElement !== canvas) requestLock();
});
window.addEventListener("pointerup", () => {
  walk.dragging = false;
});
document.addEventListener("mousemove", (event) => {
  if (!walk.active) return;
  if (document.pointerLockElement !== canvas && !walk.dragging) return;
  walk.yaw -= event.movementX * 0.0023;
  walk.pitch = THREE.MathUtils.clamp(walk.pitch - event.movementY * 0.0023, -1.35, 1.35);
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && walk.wasLocked && walk.active) exitWalk();
  walk.wasLocked = locked;
});

window.addEventListener("keydown", (event) => {
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (event.key !== "Escape") return;
  }
  if (event.key === "Alt") walk.keys.add("Alt");

  if (event.code === "KeyF") {
    if (walk.active) exitWalk();
    else enterWalk();
    return;
  }
  if (walk.active) {
    if (event.key === "Escape") {
      exitWalk();
      return;
    }
    walk.keys.add(event.code);
    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
  }

  const num = Number.parseInt(event.key, 10);
  if (num >= 1 && num <= LAYOUT_SPEC.cameraPresets.length) {
    goToPreset(num - 1);
  } else if ((event.key === "r" || event.key === "R") && !walk.active) {
    goToPreset(0);
  } else if (event.key === "n" || event.key === "N") {
    setTime(atmosphere && atmosphere.state.time > 18.2 ? 15.5 : 19.5);
  }
});
window.addEventListener("keyup", (event) => {
  if (event.key === "Alt") walk.keys.delete("Alt");
  walk.keys.delete(event.code);
});
window.addEventListener("blur", () => walk.keys.clear());

/* ------------------------------------------------------------------ */
/* Resize, stats, adaptive quality                                     */
/* ------------------------------------------------------------------ */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (pipeline) pipeline.resize();
  else renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsWindow = { frames: 0, time: 0, fps: 0 };
const frameInfo = { calls: 0, triangles: 0 };

function trackPerformance(dt) {
  if (dt > 0.25) return; // tab was hidden or stalled: not a meaningful sample
  fpsWindow.frames++;
  fpsWindow.time += dt;
  if (fpsWindow.time < 1.5) return;

  fpsWindow.fps = fpsWindow.frames / fpsWindow.time;
  fpsWindow.frames = 0;
  fpsWindow.time = 0;

  const level = pipeline.quality;
  statsEl.textContent =
    `${fpsWindow.fps.toFixed(0)} fps  ·  ${QUALITY_LEVELS[level].label}\n` +
    `${frameInfo.calls} draws  ·  ${(frameInfo.triangles / 1000).toFixed(0)}k tris`;

  // Step down one tier when the machine clearly cannot keep up (until the user picks a tier themselves)
  if (autoQuality && fpsWindow.fps < 21) {
    const next = QUALITY_ORDER[QUALITY_ORDER.indexOf(level) + 1];
    if (next) setQuality(next);
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function step(label) {
  if (loadingStepEl) loadingStepEl.textContent = label;
  await nextFrame();
  await nextFrame();
}

async function boot() {
  await step("Generating procedural textures");
  materials = createMaterials();
  materials.registerNightGlow = (material, day, night) => {
    nightGlows.push({ material, day, night });
    return material;
  };
  materials.registerNightGlow(materials.lampEmissive, 0.04, 3.4);

  await step("Raising the structure");
  worldGroup.add(createBuilding(LAYOUT_SPEC, materials));

  await step("Furnishing the hall and stalls");
  worldGroup.add(createFurniture(LAYOUT_SPEC, materials));
  worldGroup.add(createStalls(LAYOUT_SPEC, materials));
  worldGroup.add(createProps(LAYOUT_SPEC, materials));

  await step("Adding wear, wiring and clutter");
  worldGroup.add(createDetails(LAYOUT_SPEC, materials));
  worldGroup.add(createStallClutter(LAYOUT_SPEC, materials));

  await step("Seating the students");
  worldGroup.add(createPeople(LAYOUT_SPEC, materials));

  await step("Planting the garden and the neighbourhood");
  worldGroup.add(createOutdoor(LAYOUT_SPEC, materials));
  worldGroup.add(createSurroundings(LAYOUT_SPEC, materials));

  await step("Batching geometry");
  const mergeStats = mergeStaticMeshes(worldGroup);

  await step("Lighting the scene");
  setupLampLights();
  atmosphere = createAtmosphere({ scene, renderer });
  atmosphere.onChange(applyAtmosphereState);
  scene.background = null;

  reflector = createFloorReflection(LAYOUT_SPEC, { resolution: 1024 });
  scene.add(reflector);

  // Glass, decals and the sky must not write into the ambient-occlusion G-buffer
  const aoHidden = [atmosphere.sky];
  scene.traverse((obj) => {
    if (obj.isMesh && obj.material && !Array.isArray(obj.material) && (obj.material.transparent || obj.userData.noAO)) {
      aoHidden.push(obj);
    }
  });

  pipeline = createPipeline({ renderer, scene, camera, reflector, aoHidden });
  pipeline.setQuality(qualityEl.value);

  setTime(15.5);
  atmosphere.update(0, camera);
  atmosphere.forceEnvironment();

  window.__SCENE_DEBUG__ = {
    scene,
    camera,
    controls,
    renderer,
    atmosphere,
    pipeline,
    materials,
    mergeStats,
    goToPreset,
    setTime,
    setQuality: (level) => setQuality(level, { manual: true }),
    enterWalk,
    exitWalk,
    presetCount: LAYOUT_SPEC.cameraPresets.length,
    get fps() {
      return fpsWindow.fps;
    },
    get frameInfo() {
      return { ...frameInfo };
    }
  };

  ready = true;
  await step("Ready");
  loadingEl.classList.add("done");
  setTimeout(() => loadingEl.remove(), 900);
  requestAnimationFrame(animate);
}

if (infoEl) {
  infoEl.textContent = "Drag: Orbit · Right-drag: Pan · Scroll: Zoom · 1–9: Views · F: Walk · N: Day/Night";
}

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */

let lastStamp = performance.now();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const rawDt = (now - lastStamp) / 1000;
  lastStamp = now;
  const dt = Math.min(rawDt, 0.1);
  elapsed += dt;

  if (walk.active) {
    updateWalk(dt);
  } else {
    if (transitionState) {
      const k = 1 - Math.pow(0.0009, dt);
      camera.position.lerp(transitionState.targetPos, k);
      controls.target.lerp(transitionState.targetLook, k);
      if (
        camera.position.distanceTo(transitionState.targetPos) < 0.02 &&
        controls.target.distanceTo(transitionState.targetLook) < 0.02
      ) {
        camera.position.copy(transitionState.targetPos);
        controls.target.copy(transitionState.targetLook);
        transitionState = null;
      }
    }
    controls.update();
  }

  updateAnimators(elapsed, dt);
  atmosphere.update(elapsed, camera);

  renderer.info.reset();
  pipeline.render();
  frameInfo.calls = renderer.info.render.calls;
  frameInfo.triangles = renderer.info.render.triangles;

  trackPerformance(rawDt);
}

boot().catch((error) => {
  console.error(error);
  if (loadingStepEl) loadingStepEl.textContent = `Failed to build the scene: ${error.message}`;
});
