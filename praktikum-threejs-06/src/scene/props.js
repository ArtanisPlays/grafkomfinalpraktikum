import * as THREE from "three";
import { registerAnimator, markDynamic } from "./animation.js";
import { metricIfFlagged } from "./geomUtils.js";

/**
 * Helper to create a BoxGeometry mesh with shadow defaults.
 */
function makeBox(w, h, d, mat, cast = true, receive = true) {
  const mesh = new THREE.Mesh(metricIfFlagged(new THREE.BoxGeometry(w, h, d), mat), mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Creates the PrintBox Printing Station display screen CanvasTexture.
 */
function createPrintBoxScreenTexture() {
  const w = 512;
  const h = 320;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Bright blue/white advertising screen
  ctx.fillStyle = "#e0f2fe";
  ctx.fillRect(0, 0, w, h);

  // Top blue banner
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#1d4ed8");
  grad.addColorStop(1, "#0284c7");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 108);

  ctx.fillStyle = "#facc15";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("PRINTBOX ONLINE", 18, 28);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText("BUSINESS DEVELOPMENT", 18, 62);
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillStyle = "#fde047";
  ctx.fillText("- ADVERTISING -", 18, 88);

  // Paper count badge in top-right (SISA KERTAS : 119)
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(w - 175, 10, 162, 32);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText("SISA KERTAS : 119", w - 166, 31);

  // Bottom 3 white/yellow info columns
  const cols = [
    { x: 14, w: 210, title: "JOB DESCRIPTION", bg: "#ffffff", head: "#2563eb" },
    { x: 234, w: 128, title: "REQUIREMENTS", bg: "#fef9c3", head: "#ca8a04" },
    { x: 372, w: 126, title: "WHY JOIN US?", bg: "#ffffff", head: "#1d4ed8" }
  ];
  cols.forEach((c) => {
    ctx.fillStyle = c.bg;
    ctx.fillRect(c.x, 122, c.w, 184);
    ctx.fillStyle = c.head;
    ctx.fillRect(c.x, 122, c.w, 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText(c.title, c.x + 8, 139);

    ctx.fillStyle = "#475569";
    for (let line = 0; line < 7; line++) {
      ctx.fillRect(c.x + 10, 160 + line * 18, c.w - 24, 6);
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Creates the PrintBox angled control panel & lower SIDU graphic textures.
 */
function createPrintBoxPanelTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(0, 0, w, h);

  // White instruction box on left
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(20, 16, 250, 145);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText("CARA MENGGUNAKAN", 55, 36);
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("1. Akses Platform Printbox", 30, 62);
  ctx.fillText("2. Upload & Atur Dokumen", 30, 88);
  ctx.fillText("3. Pembayaran QRIS / E-Wallet", 30, 114);
  ctx.fillText("4. Scan QR & Cetak", 30, 140);

  // QR scanner window on right
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(295, 16, 190, 145);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(345, 52, 90, 72);

  // Payment badge strip
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(20, 174, 465, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("CASHLESS PAYMENT  |  QRIS  |  e-Wallet", 42, 214);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPrintBoxLowerTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, w, h);

  // Blue SIDU band
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, 18, w, 130);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("PRINTER INI MENGGUNAKAN", 26, 46);
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillText("SIDU", 32, 108);
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("100% INDONESIA", 32, 134);

  // Red paper pack graphic
  ctx.fillStyle = "#991b1b";
  ctx.fillRect(280, 34, 96, 100);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("SiDU", 304, 72);

  // Output slot
  ctx.fillStyle = "#111827";
  ctx.fillRect(96, 172, 320, 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the PrintBox Printing Station self-service kiosk.
 */
function buildPrintingStation(materials) {
  const group = new THREE.Group();
  group.name = "PrintingStation";

  const tealMat = new THREE.MeshStandardMaterial({ color: 0x38a3b8, roughness: 0.42, metalness: 0.1 });
  const whiteMat = materials.cabinetWhite;
  const blackMat = materials.blackMullion;

  // 4 small caster wheels (y: 0..0.06)
  const wheelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.025, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.36, -0.22],
    [0.36, -0.22],
    [-0.36, 0.22],
    [0.36, 0.22]
  ].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, blackMat);
    wheel.position.set(wx, 0.03, wz);
    group.add(wheel);
  });

  // Lower cabinet body (y: 0.06..0.92)
  const baseBody = makeBox(0.86, 0.86, 0.56, whiteMat);
  baseBody.position.set(0, 0.49, 0);
  group.add(baseBody);

  // Teal side accent panels
  [-0.435, 0.435].forEach((sx) => {
    const side = makeBox(0.03, 1.12, 0.54, tealMat);
    side.position.set(sx, 0.62, 0);
    group.add(side);
  });

  // Lower front SIDU panel
  const lowerFront = makeBox(
    0.82,
    0.58,
    0.02,
    new THREE.MeshStandardMaterial({ map: createPrintBoxLowerTexture(), roughness: 0.45 })
  );
  lowerFront.position.set(0, 0.36, 0.285);
  group.add(lowerFront);

  // Angled middle control console (y: 0.92..1.24)
  const consoleBox = makeBox(
    0.84,
    0.34,
    0.44,
    new THREE.MeshStandardMaterial({ map: createPrintBoxPanelTexture(), roughness: 0.4 })
  );
  consoleBox.position.set(0, 1.04, 0.04);
  consoleBox.rotation.x = -0.35;
  group.add(consoleBox);

  // Upper widescreen monitor frame (y: 1.24..1.84)
  const screenBack = makeBox(0.98, 0.56, 0.14, materials.steelFrame);
  screenBack.position.set(0, 1.54, -0.06);
  group.add(screenBack);

  const screenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.48),
    new THREE.MeshStandardMaterial({
      map: createPrintBoxScreenTexture(),
      emissive: 0xffffff,
      emissiveMap: createPrintBoxScreenTexture(),
      emissiveIntensity: 0.55,
      roughness: 0.25
    })
  );
  screenFace.position.set(0, 1.54, 0.015);
  group.add(screenFace);

  // Top black "PRINTING STATION" header bar
  const headerTex = materials.createSignTexture({
    width: 512,
    height: 96,
    bg: "#0f172a",
    border: "",
    titleColor: "#facc15",
    title: "PRINTING STATION",
    subtitle: "PRINTBOX"
  });
  const headerBar = makeBox(
    0.98,
    0.16,
    0.15,
    new THREE.MeshStandardMaterial({ map: headerTex, roughness: 0.35 })
  );
  headerBar.position.set(0, 1.9, -0.06);
  group.add(headerBar);

  return group;
}

/**
 * Creates crisp yellow & black PERHATIAN rules sign CanvasTexture.
 * variant "upper" = 4-quadrant rules; variant "lower" = 3-row visiting hours/trash/no-smoking.
 */
function createPerhatianTexture(variant = "lower") {
  const w = 512;
  const h = 320;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#dfb426";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  if (variant === "upper") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#111827";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillText("PERHATIAN", w / 2, 54);

    ctx.beginPath();
    ctx.moveTo(12, 74);
    ctx.lineTo(w - 12, 74);
    ctx.stroke();

    const items = [
      { x: 34, y: 118, lines: ["Asrama Kita Harus", "Bersih dan Sehat"], color: "#111827" },
      { x: 268, y: 118, lines: ["Dilarang Berbuat", "ASUSILA/PACARAN"], color: "#b91c1c" },
      { x: 34, y: 222, lines: ["Dilarang Masuk", "Kecuali Penghuni"], color: "#b91c1c" },
      { x: 268, y: 222, lines: ["Orang Mencurigakan", "Hubungi Asrama"], color: "#111827" }
    ];
    items.forEach((it) => {
      // Icon circle
      ctx.fillStyle = "#18181b";
      ctx.beginPath();
      ctx.arc(it.x + 22, it.y + 20, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dfb426";
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", it.x + 22, it.y + 27);

      ctx.textAlign = "left";
      ctx.fillStyle = it.color;
      ctx.font = "bold 17px Arial, sans-serif";
      ctx.fillText(it.lines[0], it.x + 52, it.y + 14);
      ctx.fillText(it.lines[1], it.x + 52, it.y + 36);
    });
  } else {
    // Dark header bar with yellow PERHATIAN
    ctx.fillStyle = "#18181b";
    ctx.fillRect(8, 8, w - 16, 68);
    ctx.textAlign = "center";
    ctx.fillStyle = "#dfb426";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillText("PERHATIAN", w / 2, 56);

    const rows = [
      "Jam Kunjung Mulai Pukul 09.00 WIB - 22.00 WIB",
      "Buanglah Sampah pada Tempatnya",
      "Bebaskan Dirimu dari Asap Rokok"
    ];
    rows.forEach((text, idx) => {
      const y = 112 + idx * 72;
      if (idx > 0) {
        ctx.strokeStyle = "#18181b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(12, y - 34);
        ctx.lineTo(w - 12, y - 34);
        ctx.stroke();
      }
      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(54, y + 2, 20, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#111827";
      ctx.font = "bold 18px Arial, sans-serif";
      ctx.fillText(text, 90, y + 8);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Builds the standing blue warning sign ("DILARANG MEMBAWA MAKANAN/MINUMAN DI ARENA BELAJAR").
 */
function buildBlueRuleSign(materials) {
  const group = new THREE.Group();
  group.name = "BlueRuleSign";

  const frameMat = materials.blackMullion;
  const signW = 0.92;
  const signH = 0.72;
  const legH = 1.1;

  // Standing metal A/post frame grounded at y=0
  [-signW / 2 - 0.025, signW / 2 + 0.025].forEach((lx) => {
    const post = makeBox(0.04, legH, 0.04, frameMat);
    post.position.set(lx, legH / 2, 0);
    group.add(post);

    const foot = makeBox(0.05, 0.03, 0.34, frameMat);
    foot.position.set(lx, 0.015, 0);
    group.add(foot);
  });

  const tex = materials.createSignTexture({
    width: 512,
    height: 384,
    bg: "#1d4f91",
    border: "#3b2314",
    titleColor: "#facc15",
    textColor: "#facc15",
    title: "DILARANG MEMBAWA",
    subtitle: "MAKANAN/MINUMAN DI",
    lines: ["ARENA BELAJAR"]
  });

  const boardMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0.05
  });
  const board = makeBox(signW, signH, 0.035, boardMat);
  board.position.set(0, 0.72, 0);
  group.add(board);

  return group;
}

/**
 * Builds a wall-mounted red fire extinguisher.
 */
function buildFireExtinguisher(materials) {
  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc92a2a, roughness: 0.32, metalness: 0.2 });
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.42, 16), redMat);
  body.castShadow = true;
  group.add(body);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    redMat
  );
  dome.position.y = 0.21;
  group.add(dome);

  // White instruction label patch
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.074, 0.16, 16, 1, true, -0.8, 1.6),
    labelMat
  );
  label.position.y = 0.02;
  group.add(label);

  // Valve & black hose
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 10), materials.blackMullion);
  neck.position.y = 0.295;
  group.add(neck);

  const lever = makeBox(0.09, 0.02, 0.02, materials.blackMullion);
  lever.position.set(0.02, 0.33, 0);
  group.add(lever);

  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 8), materials.blackMullion);
  hose.position.set(0.078, 0.12, 0.02);
  hose.rotation.z = -0.08;
  group.add(hose);

  return group;
}

/**
 * Builds a wall-mounted black oscillating fan with wire guard and 3 blades.
 */
let fanCounter = 0;

function buildWallFan(materials) {
  const group = new THREE.Group();
  const blackMat = materials.blackMullion;

  // Wall bracket & arm
  const plate = makeBox(0.1, 0.14, 0.02, blackMat);
  group.add(plate);

  const arm = makeBox(0.04, 0.04, 0.18, blackMat);
  arm.position.set(0, 0.03, 0.09);
  group.add(arm);

  // Head assembly tilted slightly downward
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.18);
  head.rotation.x = 0.22;

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 14), blackMat);
  motor.rotation.x = Math.PI / 2;
  motor.position.z = -0.05;
  head.add(motor);

  // Outer cage ring
  const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.01, 8, 24), blackMat);
  cageRing.position.z = 0.04;
  cageRing.castShadow = true;
  head.add(cageRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.006, 6, 20), blackMat);
  innerRing.position.z = 0.055;
  head.add(innerRing);

  // Spokes
  for (let i = 0; i < 6; i++) {
    const spoke = makeBox(0.47, 0.005, 0.005, blackMat, false, false);
    spoke.rotation.z = (i * Math.PI) / 6;
    spoke.position.z = 0.055;
    head.add(spoke);
  }

  // 3 fan blades on a spinning rotor
  const rotor = new THREE.Group();
  rotor.position.z = 0.02;
  for (let b = 0; b < 3; b++) {
    const blade = makeBox(0.075, 0.19, 0.006, blackMat, false, false);
    const angle = (b * Math.PI * 2) / 3;
    blade.position.set(Math.cos(angle) * 0.11, Math.sin(angle) * 0.11, 0);
    blade.rotation.z = angle - Math.PI / 2;
    blade.rotation.y = 0.35;
    rotor.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), blackMat);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  head.add(rotor);

  // The whole head sweeps left-right like a real oscillating wall fan
  markDynamic(head);
  const phase = (fanCounter++ * 1.9) % 6.28;
  registerAnimator((time) => {
    rotor.rotation.z = -time * 21;
    head.rotation.y = Math.sin(time * 0.55 + phase) * 0.62;
  });

  group.add(head);
  return group;
}

/**
 * Builds a potted plant:
 * - "medium" -> white twisted/faceted ceramic pot with Sansevieria (Snake Plant) blades
 * - "tall"   -> grey cylindrical pot with slender multi-stem leafy indoor plant
 */
function buildPottedPlant(size = "medium", materials) {
  const group = new THREE.Group();

  if (size === "tall") {
    // Grey ribbed pot + tall slender Dracaena/bamboo plant (like beside curved stair wall)
    const potMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.78 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 16), potMat);
    pot.position.y = 0.17;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 14), soilMat);
    soil.position.y = 0.33;
    group.add(soil);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b6e28, roughness: 0.7 });
    const leafGeo = new THREE.ConeGeometry(0.035, 0.22, 4);
    leafGeo.scale(1, 1, 0.22);

    const stems = [
      { x: 0, z: 0, h: 1.55, tiltX: 0.05, tiltZ: -0.04 },
      { x: -0.05, z: 0.04, h: 1.25, tiltX: -0.1, tiltZ: 0.08 },
      { x: 0.06, z: -0.03, h: 1.05, tiltX: 0.08, tiltZ: -0.12 },
      { x: -0.03, z: -0.05, h: 0.85, tiltX: -0.08, tiltZ: -0.06 }
    ];
    stems.forEach((s) => {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, s.h, 6), stemMat);
      stalk.position.set(s.x, 0.32 + s.h / 2, s.z);
      stalk.rotation.set(s.tiltX, 0, s.tiltZ);
      stalk.castShadow = true;
      group.add(stalk);

      // Leaf clusters along upper half
      for (let k = 0; k < 10; k++) {
        const yPos = 0.55 + (k / 10) * (s.h - 0.25);
        const angle = k * 2.1;
        const leaf = new THREE.Mesh(leafGeo, k % 2 === 0 ? materials.foliageDark : materials.foliageBright);
        leaf.position.set(
          s.x + Math.cos(angle) * 0.07,
          yPos,
          s.z + Math.sin(angle) * 0.07
        );
        leaf.rotation.set(1.15, angle, 0);
        leaf.castShadow = true;
        group.add(leaf);
      }
    });
  } else {
    // White geometric faceted pot + upright yellow-edged Snake Plant (Sansevieria)
    const potMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.42 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 8), potMat);
    pot.position.y = 0.14;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x244d22, roughness: 0.65 });
    const leafMatEdge = new THREE.MeshStandardMaterial({ color: 0x84a92c, roughness: 0.65 });
    const bladeCount = 11;
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + (i % 2) * 0.25;
      const radius = 0.03 + (i % 3) * 0.025;
      const h = 0.42 + (i % 4) * 0.12;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.032, h, 4),
        i % 3 === 0 ? leafMatEdge : leafMatDark
      );
      blade.scale.set(1.1, 1, 0.18);
      blade.position.set(
        Math.cos(angle) * radius,
        0.24 + h / 2,
        Math.sin(angle) * radius
      );
      blade.rotation.set((i % 2 ? 0.12 : -0.1), angle, (i % 3 - 1) * 0.14);
      blade.castShadow = true;
      group.add(blade);
    }
  }

  return group;
}

/**
 * Builds tabletop study or bottle accessories on top of a lesehan table.
 */
function buildTableAccessory(type, materials) {
  const group = new THREE.Group();

  if (type === "laptop-study") {
    const laptopBase = makeBox(0.32, 0.015, 0.22, materials.steelFrame);
    laptopBase.position.set(-0.18, 0.0075, 0.05);
    group.add(laptopBase);

    const screenFrame = makeBox(0.32, 0.21, 0.012, materials.blackMullion);
    screenFrame.position.set(-0.18, 0.11, -0.055);
    screenFrame.rotation.x = -0.22;
    group.add(screenFrame);

    const screenGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.29, 0.18),
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x60a5fa,
        emissiveIntensity: 0.75
      })
    );
    screenGlow.position.set(-0.18, 0.11, -0.048);
    screenGlow.rotation.x = -0.22;
    group.add(screenGlow);

    // Notebook & tumbler
    const notebook = makeBox(0.2, 0.016, 0.26, new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 }));
    notebook.position.set(0.22, 0.008, 0.08);
    notebook.rotation.y = 0.18;
    group.add(notebook);

    const tumbler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.032, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.35 })
    );
    tumbler.position.set(0.42, 0.08, -0.12);
    tumbler.castShadow = true;
    group.add(tumbler);
  } else {
    // Mineral water bottles & snack container
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.7,
      roughness: 0.15
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    [
      [-0.22, 0.05],
      [0.14, -0.08]
    ].forEach(([bx, bz]) => {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 12), bottleMat);
      bottle.position.set(bx, 0.1, bz);
      bottle.castShadow = true;
      group.add(bottle);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 10), capMat);
      cap.position.set(bx, 0.21, bz);
      group.add(cap);
    });
  }

  return group;
}

/**
 * Builds the iconic cute lounging dormitory cat (white fur, smoky-taupe back & tail,
 * asymmetric dark patch over left eye/ear, pale blue eyes, tucked paws, curled tail).
 */
function buildCat() {
  const cat = new THREE.Group();
  cat.name = "DormitoryCat";

  const whiteFur = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85 });
  const taupeFur = new THREE.MeshStandardMaterial({ color: 0x8b8076, roughness: 0.88 });
  const darkBrownFur = new THREE.MeshStandardMaterial({ color: 0x433831, roughness: 0.86 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xe89ca6, roughness: 0.65 });
  const blueEyeMat = new THREE.MeshStandardMaterial({ color: 0x7ec8e3, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1 });

  // Loafed body core resting cleanly on floor (y = 0)
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), whiteFur);
  torso.scale.set(0.92, 0.72, 1.55);
  torso.position.set(0, 0.095, -0.02);
  torso.castShadow = true;
  torso.receiveShadow = true;
  cat.add(torso);

  // Smoky-taupe saddle shading over back/haunches
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10), taupeFur);
  saddle.scale.set(0.86, 0.58, 1.28);
  saddle.position.set(-0.005, 0.118, -0.06);
  saddle.castShadow = true;
  cat.add(saddle);

  // Fluffy white chest
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), whiteFur);
  chest.scale.set(0.95, 0.9, 0.85);
  chest.position.set(0, 0.095, 0.13);
  chest.castShadow = true;
  cat.add(chest);

  // Two tucked front loaf paws
  [-0.052, 0.052].forEach((px) => {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), whiteFur);
    paw.scale.set(0.88, 0.55, 1.35);
    paw.position.set(px, 0.024, 0.165);
    paw.castShadow = true;
    cat.add(paw);
  });

  // Curled dark-brown/taupe tail sweeping neatly along left flank
  const tailSegments = [
    { x: 0.03, y: 0.038, z: -0.24, r: 0.026, mat: darkBrownFur },
    { x: 0.095, y: 0.034, z: -0.22, r: 0.025, mat: taupeFur },
    { x: 0.135, y: 0.032, z: -0.15, r: 0.024, mat: darkBrownFur },
    { x: 0.145, y: 0.03, z: -0.06, r: 0.022, mat: darkBrownFur },
    { x: 0.132, y: 0.028, z: 0.02, r: 0.019, mat: taupeFur },
    { x: 0.105, y: 0.026, z: 0.08, r: 0.016, mat: darkBrownFur }
  ];
  tailSegments.forEach((seg) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(seg.r, 8, 8), seg.mat);
    s.position.set(seg.x, seg.y, seg.z);
    s.castShadow = true;
    cat.add(s);
  });

  // Head group (slightly tilted, looking forward)
  const head = new THREE.Group();
  head.position.set(0, 0.195, 0.175);
  head.rotation.set(0.06, 0.08, -0.04);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), whiteFur);
  cranium.scale.set(1.06, 0.92, 0.98);
  cranium.castShadow = true;
  head.add(cranium);

  // Cute muzzle puff
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), whiteFur);
  muzzle.scale.set(1.15, 0.78, 0.9);
  muzzle.position.set(0, -0.022, 0.072);
  head.add(muzzle);

  // Tiny pink nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), pinkMat);
  nose.scale.set(1.2, 0.85, 0.7);
  nose.position.set(0, -0.01, 0.108);
  head.add(nose);

  // Signature asymmetric dark-brown patch over cat's left brow/ear
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), darkBrownFur);
  patch.scale.set(0.85, 0.85, 0.85);
  patch.position.set(0.042, 0.034, 0.032);
  head.add(patch);

  // Pale blue eyes + vertical dark pupils
  [-0.036, 0.036].forEach((ex) => {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), blueEyeMat);
    iris.scale.set(1.05, 0.95, 0.55);
    iris.position.set(ex, 0.012, 0.08);
    head.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), pupilMat);
    pupil.scale.set(0.5, 1.15, 0.55);
    pupil.position.set(ex, 0.012, 0.085);
    head.add(pupil);
  });

  // Pointed ears (left ear dark brown, right ear pale taupe/white) + pink inner ear
  [
    { x: -0.054, rotZ: 0.28, outerMat: taupeFur },
    { x: 0.054, rotZ: -0.28, outerMat: darkBrownFur }
  ].forEach((e) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.068, 4), e.outerMat);
    ear.position.set(e.x, 0.082, -0.005);
    ear.rotation.set(0.12, Math.PI / 4, e.rotZ);
    ear.castShadow = true;
    head.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.044, 3), pinkMat);
    innerEar.position.set(e.x, 0.078, 0.007);
    innerEar.rotation.set(0.18, 0, e.rotZ);
    head.add(innerEar);
  });

  cat.add(head);

  // Slow breathing, the odd glance around and an ear flick keep the cat alive
  markDynamic(cat);
  registerAnimator((time) => {
    const breath = 1 + Math.sin(time * 1.7) * 0.022;
    torso.scale.y = 0.72 * breath;
    saddle.scale.y = 0.58 * breath;
    const glance = Math.sin(time * 0.21) * Math.sin(time * 0.13 + 1.3);
    head.rotation.y = 0.08 + glance * 0.42;
    head.rotation.x = 0.06 + Math.sin(time * 0.31 + 2.0) * 0.05;
  });
  return cat;
}

/**
 * Builds all props, signage, Printing Station, potted plants, table clutter & dormitory cat
 * matching layoutSpec.props and materials.
 */
export function createProps(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "PropsAndSignage";

  const { props, furniture } = layoutSpec;

  // 1. Printing Station Kiosk
  if (props.printingStation) {
    const kiosk = buildPrintingStation(materials);
    kiosk.position.set(props.printingStation.x, 0, props.printingStation.z);
    kiosk.rotation.y = props.printingStation.rotY || 0;
    group.add(kiosk);
  }

  // 2. Wall Display Cabinet above Printing Station / Office entrance
  if (props.wallDisplayCabinet) {
    const c = props.wallDisplayCabinet;
    const cabGroup = new THREE.Group();
    const frame = makeBox(c.w, c.h, c.d, materials.cabinetWhite);
    cabGroup.add(frame);

    const backWood = makeBox(c.w - 0.1, c.h - 0.1, 0.04, materials.lightWood);
    backWood.position.z = -c.d / 2 + 0.04;
    cabGroup.add(backWood);

    const glassFront = makeBox(c.w - 0.1, c.h - 0.1, 0.015, materials.clearGlass, false, false);
    glassFront.position.z = c.d / 2 - 0.01;
    cabGroup.add(glassFront);

    // Fluorescent tube light inside header box
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, c.w - 0.4, 8),
      materials.lampEmissive
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, -c.h * 0.28, 0.02);
    cabGroup.add(tube);

    cabGroup.position.set(c.x, c.y, c.z);
    group.add(cabGroup);
  }

  // 3. Blue standing rule sign ("DILARANG MEMBAWA MAKANAN/MINUMAN DI ARENA BELAJAR")
  if (props.blueRuleSign) {
    const sign = buildBlueRuleSign(materials);
    sign.position.set(props.blueRuleSign.x, 0, props.blueRuleSign.z);
    sign.rotation.y = props.blueRuleSign.rotY || 0;
    group.add(sign);
  }

  // 4. Yellow PERHATIAN boards (curved staircase drum + wall beside Printing Station)
  const upperPerhatianMat = new THREE.MeshStandardMaterial({
    map: createPerhatianTexture("upper"),
    roughness: 0.45,
    side: THREE.DoubleSide
  });
  const lowerPerhatianMat = new THREE.MeshStandardMaterial({
    map: createPerhatianTexture("lower"),
    roughness: 0.45,
    side: THREE.DoubleSide
  });

  (props.perhatianSigns || []).forEach((s, idx) => {
    const signGroup = new THREE.Group();
    if (idx === 0) {
      // Staircase wall has stacked upper + lower yellow PERHATIAN signs + fire alarm conduit
      const upper = makeBox(1.15, 0.72, 0.02, upperPerhatianMat);
      upper.position.y = 0.38;
      signGroup.add(upper);

      const lower = makeBox(1.15, 0.72, 0.02, lowerPerhatianMat);
      lower.position.y = -0.38;
      signGroup.add(lower);

      // Red fire alarm strobe & call-point box beside sign
      const alarmRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), alarmRed);
      bell.rotation.x = Math.PI / 2;
      bell.position.set(0.75, 0.45, 0.03);
      signGroup.add(bell);

      const callPoint = makeBox(0.1, 0.1, 0.045, alarmRed);
      callPoint.position.set(0.75, -0.25, 0.025);
      signGroup.add(callPoint);
    } else {
      const board = makeBox(1.05, 0.68, 0.02, lowerPerhatianMat);
      signGroup.add(board);
    }

    signGroup.position.set(s.x, s.y, s.z);
    signGroup.rotation.y = s.rotY || 0;
    group.add(signGroup);
  });

  // 5. Fire Extinguishers
  (props.fireExtinguishers || []).forEach((fe) => {
    const ext = buildFireExtinguisher(materials);
    ext.position.set(fe.x, fe.y, fe.z);
    group.add(ext);
  });

  // 6. Wall-mounted black oscillating fans
  (props.wallFans || []).forEach((wf) => {
    const fan = buildWallFan(materials);
    fan.position.set(wf.x, wf.y, wf.z);
    fan.rotation.y = wf.rotY || 0;
    group.add(fan);
  });

  // 7. Potted Plants
  (props.pottedPlants || []).forEach((pp) => {
    const plant = buildPottedPlant(pp.size, materials);
    plant.position.set(pp.x, 0, pp.z);
    group.add(plant);
  });

  // 8. Tabletop Laptops & Bottles on designated Lesehan tables
  const lesehanTables = furniture?.lesehanTables || [];
  (props.tableAccessories || []).forEach((acc) => {
    const tbl = lesehanTables[acc.tableIndex];
    if (!tbl || tbl.tilted) return;
    const accGroup = buildTableAccessory(acc.type, materials);
    const tableTopY = tbl.height ?? 0.34;
    accGroup.position.set(tbl.x, tableTopY, tbl.z);
    accGroup.rotation.y = tbl.rotY || 0;
    group.add(accGroup);
  });

  // 9. Iconic lounging dormitory cat
  if (props.cat) {
    const cat = buildCat();
    cat.position.set(props.cat.x, 0, props.cat.z);
    cat.rotation.y = props.cat.rotY || 0;
    group.add(cat);
  }

  return group;
}
