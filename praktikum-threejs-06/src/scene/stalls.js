import * as THREE from "three";
import { metricIfFlagged } from "./geomUtils.js";

/**
 * Generates a brown/beige/cream square mosaic tile CanvasTexture matching
 * the front cladding of all three canteen stall counters.
 */
function createMosaicTileTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#cfc6bc";
  ctx.fillRect(0, 0, size, size);

  const palette = [
    "#f2ece4",
    "#e3d7ca",
    "#c9b29b",
    "#a88970",
    "#7d5f49",
    "#574133"
  ];
  const grid = 16;
  const cell = size / grid;

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Deterministic pseudo-random distribution so builds look consistent
      const hash = ((r * 37 + c * 73 + r * c * 11) % 97) / 97;
      const idx = Math.floor(hash * palette.length);
      ctx.fillStyle = palette[idx];
      ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Creates the ExSoe Chicken & Beef header menu banner CanvasTexture.
 */
function createExSoeBannerTexture() {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Warm orange-peach gradient background
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#d86b27");
  grad.addColorStop(0.14, "#e69a5c");
  grad.addColorStop(0.86, "#e5a066");
  grad.addColorStop(1, "#d97b38");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Top & bottom subtle trim
  ctx.fillStyle = "#b84f18";
  ctx.fillRect(0, 0, w, 6);
  ctx.fillRect(0, h - 6, w, 6);

  // Left mascot emblem (cute white chick/panda badge)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(62, 54, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.arc(52, 48, 4, 0, Math.PI * 2);
  ctx.arc(72, 48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(57, 56);
  ctx.lineTo(67, 56);
  ctx.lineTo(62, 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7c2d12";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ExSoe", 62, 98);

  // Halal badge on right
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(w - 52, 48, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText("HALAL", w - 52, 52);

  // Main title
  ctx.fillStyle = "#1e1b18";
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText("ExSoe", w * 0.5, 36);
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = "#3f2616";
  ctx.fillText("Chicken & Beef", w * 0.5, 62);

  // 4 top menu plates + 4 bottom menu plates
  const topItems = ["PAKET NASI 1", "PAKET NASI 2", "HOT SPICY 1", "HOT SPICY 2"];
  const botItems = ["FRENCH FRIES", "NUGGETS", "CHICKEN STRIP", "BURGER"];
  const cols = 4;
  const startX = 185;
  const stepX = 195;

  for (let i = 0; i < cols; i++) {
    const cx = startX + i * stepX;

    // Top row: white rice ball + crispy fried chicken on wooden plate
    ctx.fillStyle = "#85522c";
    ctx.beginPath();
    ctx.ellipse(cx, 118, 44, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(cx - 18, 108, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i >= 2 ? "#7c2d12" : "#c97a2c";
    ctx.beginPath();
    ctx.ellipse(cx + 16, 108, 22, 13, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f160f";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(topItems[i], cx, 148);

    // Bottom row
    ctx.fillStyle = "#9c6234";
    ctx.beginPath();
    ctx.ellipse(cx, 198, 42, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i === 3 ? "#b45309" : "#eab308";
    ctx.beginPath();
    ctx.ellipse(cx, 189, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f160f";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText(botItems[i], cx, 232);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Creates the WARAS (Warung Asrama ITS) header banner CanvasTexture.
 */
function createWarasBannerTexture() {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Dark charcoal base + golden wave on right/bottom
  ctx.fillStyle = "#1c1f24";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#e8a81c";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.65, h * 0.75);
  ctx.lineTo(w, h * 0.55);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Golden border frame
  ctx.strokeStyle = "#f2b824";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Left circular food photos
  const plates = [
    { cx: 110, cy: 85, r: 62, fill: "#b45309", accent: "#f8fafc" },
    { cx: 215, cy: 138, r: 54, fill: "#92400e", accent: "#84cc16" }
  ];
  plates.forEach((p) => {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.fill;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(p.cx - 12, p.cy - 8, p.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  });

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillText("WARAS", 620, 62);

  ctx.fillStyle = "#fef3c7";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText("Warung Asrama ITS", 620, 96);

  ctx.fillStyle = "#f3f4f6";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("Start From 10 k", 620, 126);

  // 4 Golden Pill Buttons
  const pills = [
    { label: "Nasi Campur", x: 475, y: 158 },
    { label: "Nasi Pecel", x: 765, y: 158 },
    { label: "Nasi Goreng", x: 475, y: 204 },
    { label: "Tahu Tek", x: 765, y: 204 }
  ];
  pills.forEach((pill) => {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect(pill.x - 125, pill.y - 18, 250, 36, 18);
    ctx.fill();
    ctx.strokeStyle = "#1c1f24";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.fillText(pill.label, pill.x, pill.y + 7);
  });

  // Bottom info bar
  ctx.fillStyle = "#111827";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText("085648101073   |   Asrama Mahasiswa ITS", 620, 242);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Creates the KEDAI MINUMAN ASRAMA green fruit-juice header banner CanvasTexture.
 */
function createKedaiMinumanBannerTexture() {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Lush lime-green gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#7ec143");
  grad.addColorStop(0.5, "#94cf4d");
  grad.addColorStop(1, "#4e9231");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Wooden deck strip at bottom
  ctx.fillStyle = "#7c5333";
  ctx.fillRect(0, h - 42, w, 42);

  // Left dark green drink list panel
  ctx.fillStyle = "#225724";
  ctx.beginPath();
  ctx.roundRect(14, 62, 235, 180, 14);
  ctx.fill();

  ctx.fillStyle = "#3f7d2c";
  ctx.beginPath();
  ctx.arc(90, 34, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Serba 7k", 90, 39);

  const leftDrinks = [
    "Good Day Freeze",
    "Good Day Cappucino",
    "Good Day Latte",
    "White Coffee",
    "Chocolatos",
    "Teh Tarik",
    "Dancow"
  ];
  ctx.textAlign = "left";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 16px Arial, sans-serif";
  leftDrinks.forEach((d, idx) => {
    ctx.fillText(d, 28, 92 + idx * 21);
  });

  // Center header
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#143518";
  ctx.lineWidth = 6;
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.strokeText("KEDAI MINUMAN", 495, 42);
  ctx.fillText("KEDAI MINUMAN", 495, 42);
  ctx.strokeText("ASRAMA", 495, 84);
  ctx.fillText("ASRAMA", 495, 84);

  // Yellow JUS BUAH badge
  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  ctx.roundRect(405, 96, 180, 40, 10);
  ctx.fill();
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText("JUS BUAH", 495, 124);

  // Fruit icons
  const fruits = [
    { name: "Buah Naga", color: "#db2777", x: 325, y: 168 },
    { name: "Alpukat", color: "#65a30d", x: 400, y: 168 },
    { name: "Stroberi", color: "#ef4444", x: 475, y: 168 },
    { name: "Apel", color: "#dc2626", x: 550, y: 168 },
    { name: "Jeruk", color: "#f97316", x: 625, y: 168 },
    { name: "Melon", color: "#84cc16", x: 365, y: 205 },
    { name: "Semangka", color: "#e11d48", x: 445, y: 205 },
    { name: "Jambu", color: "#f43f5e", x: 525, y: 205 }
  ];
  fruits.forEach((f) => {
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.fillText(f.name, f.x, f.y + 22);
  });

  // Right Serba 6k section
  ctx.fillStyle = "#1f4e22";
  ctx.beginPath();
  ctx.arc(845, 38, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText("Serba 6k", 845, 43);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial, sans-serif";
  ["Milo", "Hilo", "Indomilk", "Nutrisari", "Pop Ice", "Es Jeruk", "Es Teh  5k"].forEach(
    (d, idx) => {
      ctx.fillText(d, 785, 92 + idx * 20);
    }
  );

  // SWEGER REK ribbon
  ctx.fillStyle = "#366824";
  ctx.beginPath();
  ctx.roundRect(755, 206, 235, 36, 8);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fde047";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("SWEGER REK", 872, 232);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Helper to create a 3D box mesh with shadows enabled.
 */
function makeBox(w, h, d, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(metricIfFlagged(new THREE.BoxGeometry(w, h, d), material), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Builds the L-shaped or straight mosaic-clad front counter with glossy black top.
 */
function buildFrontCounter({
  counterMinX,
  counterMaxX,
  frontZ,
  depth = 0.56,
  height = 0.9,
  returnLen = 0.85,
  returnOnRight = false,
  mosaicMat,
  blackTopMat
}) {
  const group = new THREE.Group();
  const width = counterMaxX - counterMinX;
  const centerX = (counterMinX + counterMaxX) / 2;
  const topThickness = 0.06;
  const bodyH = height - topThickness;
  const bodyCenterZ = frontZ - depth / 2;

  // Mosaic base front section
  const body = makeBox(width - 0.04, bodyH, depth - 0.06, mosaicMat);
  body.position.set(centerX, bodyH / 2, bodyCenterZ);
  group.add(body);

  // Black corner framing pillars (seen at counter edges in photos)
  const leftTrim = makeBox(0.11, height, depth, blackTopMat);
  leftTrim.position.set(counterMinX + 0.055, height / 2, bodyCenterZ);
  group.add(leftTrim);

  const rightTrim = makeBox(0.11, height, depth, blackTopMat);
  rightTrim.position.set(counterMaxX - 0.055, height / 2, bodyCenterZ);
  group.add(rightTrim);

  // Glossy black granite countertop
  const top = makeBox(width + 0.04, topThickness, depth + 0.04, blackTopMat);
  top.position.set(centerX, height - topThickness / 2, bodyCenterZ);
  group.add(top);

  // Short L-return leg on the interior side
  if (returnLen > 0) {
    const legX = returnOnRight
      ? counterMaxX - depth / 2
      : counterMinX + depth / 2;
    const legCenterZ = frontZ - depth - returnLen / 2;

    const legBody = makeBox(depth - 0.06, bodyH, returnLen, mosaicMat);
    legBody.position.set(legX, bodyH / 2, legCenterZ);
    group.add(legBody);

    const legTop = makeBox(depth + 0.04, topThickness, returnLen + 0.04, blackTopMat);
    legTop.position.set(legX, height - topThickness / 2, legCenterZ);
    group.add(legTop);
  }

  return group;
}

/**
 * Builds a countertop glass & aluminum food display warmer showcase.
 */
function buildGlassShowcase({ w = 0.85, h = 0.65, d = 0.45, frameMat, glassMat, glowMat }) {
  const group = new THREE.Group();

  // Base tray
  const base = makeBox(w, 0.05, d, frameMat);
  base.position.y = 0.025;
  group.add(base);

  // Corner vertical struts
  const postGeo = new THREE.BoxGeometry(0.03, h, 0.03);
  [
    [-w / 2 + 0.015, -d / 2 + 0.015],
    [w / 2 - 0.015, -d / 2 + 0.015],
    [-w / 2 + 0.015, d / 2 - 0.015],
    [w / 2 - 0.015, d / 2 - 0.015]
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(px, h / 2, pz);
    post.castShadow = true;
    group.add(post);
  });

  // Top frame
  const top = makeBox(w, 0.04, d, frameMat);
  top.position.y = h - 0.02;
  group.add(top);

  // Glass enclosure walls
  const frontGlass = makeBox(w - 0.04, h - 0.08, 0.015, glassMat, false, false);
  frontGlass.position.set(0, h / 2, d / 2 - 0.015);
  group.add(frontGlass);

  const sideGeo = new THREE.BoxGeometry(0.015, h - 0.08, d - 0.04);
  [-w / 2 + 0.015, w / 2 - 0.015].forEach((sx) => {
    const sg = new THREE.Mesh(sideGeo, glassMat);
    sg.position.set(sx, h / 2, 0);
    group.add(sg);
  });

  // Two interior display shelves + golden food pieces
  const foodMat = new THREE.MeshStandardMaterial({ color: 0xc97b2c, roughness: 0.65 });
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.6 });
  [0.24, 0.44].forEach((sy) => {
    const shelf = makeBox(w - 0.08, 0.015, d - 0.08, trayMat);
    shelf.position.y = sy;
    group.add(shelf);

    for (let i = -2; i <= 2; i++) {
      const piece = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 0), foodMat);
      piece.scale.set(1.2, 0.65, 0.9);
      piece.position.set(i * 0.13, sy + 0.035, (i % 2) * 0.06);
      group.add(piece);
    }
  });

  // Warm interior warmer bulb strip
  const bulb = makeBox(w - 0.14, 0.025, 0.04, glowMat, false, false);
  bulb.position.set(0, h - 0.06, 0);
  group.add(bulb);

  return group;
}

/**
 * Builds a 3-seat silver perforated metal waiting bench inside a booth.
 */
function buildWaitingBench(metalMat, darkMat) {
  const group = new THREE.Group();
  const beam = makeBox(1.45, 0.05, 0.06, darkMat);
  beam.position.set(0, 0.38, 0);
  group.add(beam);

  [-0.6, 0.6].forEach((lx) => {
    const leg = makeBox(0.05, 0.38, 0.42, darkMat);
    leg.position.set(lx, 0.19, 0);
    group.add(leg);
  });

  [-0.48, 0, 0.48].forEach((sx) => {
    const seat = makeBox(0.42, 0.03, 0.4, metalMat);
    seat.position.set(sx, 0.42, 0.04);
    group.add(seat);

    const back = makeBox(0.42, 0.38, 0.03, metalMat);
    back.position.set(sx, 0.62, -0.15);
    back.rotation.x = -0.1;
    group.add(back);
  });

  return group;
}

/**
 * Builds a blue 19L water gallon bottle.
 */
function buildWaterGallon() {
  const group = new THREE.Group();
  const bluePlastic = new THREE.MeshStandardMaterial({
    color: 0x2b7cb8,
    transparent: true,
    opacity: 0.78,
    roughness: 0.22,
    metalness: 0.05
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.36, 16), bluePlastic);
  body.position.y = 0.18;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.135, 0.09, 16), bluePlastic);
  shoulder.position.y = 0.405;
  shoulder.castShadow = true;
  group.add(shoulder);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.045, 12), capMat);
  cap.position.y = 0.47;
  group.add(cap);

  return group;
}

/**
 * Builds the food stalls row (ExSoe, WARAS, KEDAI MINUMAN) matching layoutSpec.stalls.
 */
export function createStalls(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "FoodStalls";

  const { stalls } = layoutSpec;
  const backZ = stalls.backWallZ;
  const frontZ = stalls.frontCounterZ;
  const depth = stalls.depth;
  const wallH = 3.1; // Fits cleanly under mezzanine slab bottom (3.35 - 0.22 = 3.13)
  const counterH = stalls.counterHeight;
  const headerBotY = stalls.headerBottomY;
  const headerTopY = stalls.headerTopY;
  const headerH = headerTopY - headerBotY;
  const headerCenterY = (headerBotY + headerTopY) / 2;

  const mosaicMat = new THREE.MeshStandardMaterial({
    map: createMosaicTileTexture(),
    roughness: 0.38,
    metalness: 0.05
  });
  const blackCounterTopMat = new THREE.MeshStandardMaterial({
    color: 0x15181c,
    roughness: 0.18,
    metalness: 0.12
  });
  const stallWallMat = new THREE.MeshStandardMaterial({
    color: 0xf0ede6,
    roughness: 0.85,
    metalness: 0.02
  });
  const woodDoorMat = new THREE.MeshStandardMaterial({
    color: 0x8f6b4b,
    roughness: 0.62,
    metalness: 0.04
  });
  const darkFrameMat = materials.blackMullion;
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffd584,
    emissiveIntensity: 1.8,
    roughness: 0.2
  });

  // Back wall running across entire stalls zone (x: -9.0..2.0 at z = -6.5)
  const totalWidth = stalls.booths[stalls.booths.length - 1].maxX - stalls.booths[0].minX;
  const midX = (stalls.booths[0].minX + stalls.booths[stalls.booths.length - 1].maxX) / 2;
  const backWall = makeBox(totalWidth, wallH, 0.14, stallWallMat);
  backWall.position.set(midX, wallH / 2, backZ + 0.07);
  group.add(backWall);

  // Partition walls at each booth boundary (-9.0, -5.3, -1.6, 2.0)
  const partitionXs = [
    stalls.booths[0].minX,
    ...stalls.booths.map((b) => b.maxX)
  ];
  partitionXs.forEach((px) => {
    const part = makeBox(0.12, wallH, depth, stallWallMat);
    part.position.set(px, wallH / 2, backZ + depth / 2);
    group.add(part);
  });

  const bannerTextures = {
    exsoe: createExSoeBannerTexture(),
    waras: createWarasBannerTexture(),
    kedai: createKedaiMinumanBannerTexture()
  };

  // Build each booth
  stalls.booths.forEach((booth) => {
    const boothGroup = new THREE.Group();
    boothGroup.name = `Booth_${booth.id}`;
    const boothW = booth.maxX - booth.minX;
    const boothCenterX = (booth.minX + booth.maxX) / 2;

    // 1. Header Banner Board (y: 2.25..3.05 at z = -3.22)
    const bannerTex = bannerTextures[booth.id];
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.45,
      metalness: 0.04
    });
    const bannerBoard = makeBox(boothW - 0.14, headerH, 0.08, bannerMat);
    bannerBoard.position.set(boothCenterX, headerCenterY, frontZ - 0.04);
    boothGroup.add(bannerBoard);

    // Optional upper wood cabinet fascia behind/above ExSoe header
    if (booth.hasUpperWoodCabinet) {
      const upperCab = makeBox(boothW - 0.16, headerH - 0.06, 0.36, materials.lightWood);
      upperCab.position.set(boothCenterX, headerCenterY + 0.01, frontZ - 0.28);
      boothGroup.add(upperCab);

      // Horizontal silver shutter rail strip along bottom of cabinet
      const rail = makeBox(boothW - 0.2, 0.03, 0.04, materials.steelFrame);
      rail.position.set(boothCenterX, headerBotY + 0.02, frontZ - 0.12);
      boothGroup.add(rail);
    }

    // 2. Back interior staff door
    const doorW = 0.85;
    const doorH = 2.08;
    const doorX = booth.id === "waras" ? boothCenterX - 0.3 : boothCenterX + 0.45;
    const doorFrame = makeBox(doorW + 0.08, doorH + 0.05, 0.06, darkFrameMat);
    doorFrame.position.set(doorX, doorH / 2, backZ + 0.15);
    boothGroup.add(doorFrame);

    const doorLeaf = makeBox(doorW, doorH, 0.04, woodDoorMat);
    doorLeaf.position.set(doorX, doorH / 2, backZ + 0.16);
    boothGroup.add(doorLeaf);

    // 3. Front Counter & Booth-Specific Equipment
    if (booth.id === "exsoe") {
      // Entry aisle on left (-9.0..-8.15), counter on right (-8.15..-5.36)
      const counter = buildFrontCounter({
        counterMinX: booth.minX + 0.85,
        counterMaxX: booth.maxX - 0.06,
        frontZ,
        height: counterH,
        returnLen: 0.8,
        returnOnRight: false,
        mosaicMat,
        blackTopMat: blackCounterTopMat
      });
      boothGroup.add(counter);

      // Plywood modesty board in front of left aisle gap (seen in photos)
      const modesty = makeBox(0.95, 0.72, 0.04, materials.lightWood);
      modesty.position.set(booth.minX + 0.55, 0.36, frontZ + 0.08);
      boothGroup.add(modesty);

      // Glowing fried chicken glass warmer showcase on counter
      const showcase = buildGlassShowcase({
        w: 0.92,
        h: 0.68,
        d: 0.46,
        frameMat: materials.stainlessSteel,
        glassMat: materials.clearGlass,
        glowMat: warmGlowMat
      });
      showcase.position.set(boothCenterX + 0.35, counterH, frontZ - 0.28);
      boothGroup.add(showcase);

      // Sauce squeeze bottles (red & yellow)
      const redBottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
      );
      redBottle.position.set(boothCenterX - 0.28, counterH + 0.09, frontZ - 0.22);
      boothGroup.add(redBottle);

      const yellowBottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      yellowBottle.position.set(boothCenterX - 0.2, counterH + 0.09, frontZ - 0.24);
      boothGroup.add(yellowBottle);

      // Interior back prep counter, red plastic stool & 3-seat bench
      const backPrep = makeBox(1.5, 0.78, 0.55, materials.darkWood);
      backPrep.position.set(booth.maxX - 0.85, 0.39, backZ + 0.45);
      boothGroup.add(backPrep);

      const riceCooker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.17, 0.26, 14),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.35 })
      );
      riceCooker.position.set(booth.maxX - 0.5, 0.91, backZ + 0.45);
      boothGroup.add(riceCooker);

      const bench = buildWaitingBench(materials.stainlessSteel, darkFrameMat);
      bench.position.set(boothCenterX - 0.45, 0, backZ + 0.62);
      boothGroup.add(bench);

      const redStool = makeBox(0.32, 0.45, 0.32, new THREE.MeshStandardMaterial({ color: 0xc92a2a, roughness: 0.45 }));
      redStool.position.set(booth.minX + 0.45, 0.225, backZ + 1.15);
      boothGroup.add(redStool);
    } else if (booth.id === "waras") {
      // Counter on left/center (-5.24..-2.55), entry gap on right
      const counter = buildFrontCounter({
        counterMinX: booth.minX + 0.06,
        counterMaxX: booth.maxX - 0.95,
        frontZ,
        height: counterH,
        returnLen: 0.75,
        returnOnRight: true,
        mosaicMat,
        blackTopMat: blackCounterTopMat
      });
      boothGroup.add(counter);

      // Smaller glass food display cabinet on left side of counter
      const showcase = buildGlassShowcase({
        w: 0.72,
        h: 0.56,
        d: 0.42,
        frameMat: materials.stainlessSteel,
        glassMat: materials.clearGlass,
        glowMat: warmGlowMat
      });
      showcase.position.set(booth.minX + 0.75, counterH, frontZ - 0.28);
      boothGroup.add(showcase);

      // QRIS white standee on counter
      const qrisTex = materials.createSignTexture({
        width: 256,
        height: 256,
        bg: "#ffffff",
        border: "#1e293b",
        title: "QRIS",
        subtitle: "WARAS ITS",
        lines: ["Scan to Pay"]
      });
      const qrisSign = makeBox(0.18, 0.24, 0.02, new THREE.MeshStandardMaterial({ map: qrisTex }));
      qrisSign.position.set(booth.minX + 1.4, counterH + 0.12, frontZ - 0.2);
      boothGroup.add(qrisSign);

      // Blue water gallon on floor at front-right corner
      const gallon = buildWaterGallon();
      gallon.position.set(booth.maxX - 0.38, 0, frontZ - 0.35);
      boothGroup.add(gallon);

      // Interior waiting bench & round orange wall clock
      const bench = buildWaitingBench(materials.stainlessSteel, darkFrameMat);
      bench.rotation.y = -Math.PI / 2;
      bench.position.set(booth.maxX - 0.45, 0, backZ + 1.55);
      boothGroup.add(bench);

      const clock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.04, 18),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 })
      );
      clock.rotation.z = Math.PI / 2;
      clock.position.set(booth.minX + 0.08, 2.05, backZ + 1.65);
      boothGroup.add(clock);
    } else if (booth.id === "kedai") {
      // Entry gap on left (-1.54..-0.75), counter on right (-0.75..1.94)
      const counter = buildFrontCounter({
        counterMinX: booth.minX + 0.85,
        counterMaxX: booth.maxX - 0.06,
        frontZ,
        height: counterH,
        returnLen: 0.78,
        returnOnRight: false,
        mosaicMat,
        blackTopMat: blackCounterTopMat
      });
      boothGroup.add(counter);

      // Clear plastic snack trays & green cup holder on counter
      const trayMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.55,
        roughness: 0.2
      });
      [0.25, 0.85].forEach((offsetX) => {
        const tray = makeBox(0.45, 0.14, 0.34, trayMat, true, false);
        tray.position.set(booth.minX + 1.25 + offsetX, counterH + 0.07, frontZ - 0.25);
        boothGroup.add(tray);
      });

      const cupHolder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.055, 0.15, 12),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 })
      );
      cupHolder.position.set(booth.minX + 1.05, counterH + 0.075, frontZ - 0.2);
      boothGroup.add(cupHolder);

      // Blue insulated water/ice jug behind counter
      const iceJug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.15, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
      );
      iceJug.position.set(booth.maxX - 0.45, counterH + 0.16, frontZ - 0.35);
      boothGroup.add(iceJug);

      // 3 blue water gallon bottles lined along left partition wall (as seen in photo)
      for (let g = 0; g < 3; g++) {
        const gallon = buildWaterGallon();
        gallon.position.set(booth.minX + 0.28, 0, frontZ - 0.65 - g * 0.42);
        boothGroup.add(gallon);
      }

      // Standing vertical KEDAI MINUMAN X-banner inside
      const xBannerTex = materials.createSignTexture({
        width: 256,
        height: 512,
        bg: "#a3c948",
        border: "#2d5a27",
        titleColor: "#7c2d12",
        textColor: "#1e293b",
        title: "KEDAI MINUMAN",
        subtitle: "MENU JUS BUAH",
        lines: [
          "Jus Jeruk   11k",
          "Jus Alpukat 12k",
          "Jus Mangga  12k",
          "Jus Naga    11k",
          "Es Teh       5k"
        ]
      });
      const xBanner = makeBox(0.6, 1.55, 0.02, new THREE.MeshStandardMaterial({ map: xBannerTex }));
      xBanner.position.set(boothCenterX - 0.35, 0.85, backZ + 0.55);
      xBanner.rotation.y = 0.12;
      boothGroup.add(xBanner);
    }

    group.add(boothGroup);
  });

  // Poster "BUDAYAKAN BEBERES SETELAH MAKAN !!" mounted at booth divider edge
  const beberesTex = materials.createSignTexture({
    width: 256,
    height: 360,
    bg: "#f8fafc",
    border: "#1d4ed8",
    titleColor: "#1e3a8a",
    textColor: "#111827",
    title: "BUDAYAKAN",
    subtitle: "BEBERES SETELAH MAKAN !!",
    lines: ["Kembalikan piring", "ke meja penjual"]
  });
  const beberesPoster = makeBox(0.36, 0.5, 0.015, new THREE.MeshStandardMaterial({ map: beberesTex }));
  beberesPoster.position.set(1.92, 1.55, frontZ + 0.02);
  group.add(beberesPoster);

  return group;
}
