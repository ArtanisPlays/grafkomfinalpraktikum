import * as THREE from "three";
import { metricIfFlagged } from "./geomUtils.js";
import { applyWind, foliageBlob } from "./wind.js";

/**
 * Deterministic PRNG (Mulberry32) so procedural textures and foliage stay reproducible.
 */
function createRng(seed = 1337) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a box with its bottom resting cleanly at `bottomY`.
 */
function createGroundedBox(w, h, d, material, x, bottomY, z, { castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(metricIfFlagged(new THREE.BoxGeometry(w, h, d), material, x, bottomY + h / 2, z), material);
  mesh.position.set(x, bottomY + h / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * Resolves whether (x, z) lies inside the raised L-shaped building floor slab.
 */
function getGroundYAt(x, z, spec) {
  const { mainHall, steelWing } = spec.wings;
  const inMain = x >= mainHall.minX && x <= mainHall.maxX && z >= mainHall.minZ && z <= mainHall.maxZ;
  const inSteel = x >= steelWing.minX && x <= steelWing.maxX && z >= steelWing.minZ && z <= steelWing.maxZ;
  return inMain || inSteel ? spec.floorY : spec.exteriorGroundY;
}

/**
 * Procedural dark charcoal hexagonal conblock walkway texture.
 */
function createHexPaverTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = createRng(4021);

  ctx.fillStyle = "#484d54";
  ctx.fillRect(0, 0, size, size);

  const r = 16;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);

  for (let col = -1; col <= Math.ceil(size / dx) + 1; col++) {
    for (let row = -1; row <= Math.ceil(size / dy) + 1; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 !== 0 ? dy / 2 : 0);
      const shade = 74 + Math.floor(rng() * 26);

      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI / 3) * k;
        const px = cx + (r - 1.3) * Math.cos(angle);
        const py = cy + (r - 1.3) * Math.sin(angle);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      ctx.fill();
      ctx.strokeStyle = "#2f3338";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural river-stone masonry retaining wall texture (cream mortar + irregular dark/grey stones).
 */
function createRiverStoneTexture() {
  const width = 512;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const rng = createRng(8842);

  // Weathered cream/grey mortar bed
  ctx.fillStyle = "#c9c4b8";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(145,140,128,0.18)" : "rgba(230,226,215,0.2)";
    ctx.fillRect(rng() * width, rng() * height, 4 + rng() * 14, 3 + rng() * 8);
  }

  const stonePalette = ["#4b5056", "#5e6268", "#706b63", "#3e4247", "#847d72", "#555c63"];
  const cols = 16;
  const rows = 4;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW + (rng() - 0.5) * 6;
      const cy = (r + 0.5) * cellH + (rng() - 0.5) * 4;
      const rx = cellW * (0.34 + rng() * 0.12);
      const ry = cellH * (0.32 + rng() * 0.12);
      const rot = (rng() - 0.5) * 0.6;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = stonePalette[Math.floor(rng() * stonePalette.length)];
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(35, 35, 38, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Subtle mineral highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.ellipse(-rx * 0.25, -ry * 0.25, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(8, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural sorting label CanvasTexture for wheeled trash bins.
 */
function createBinDecalTexture({ bg = "#2d7a47", border = "#e8f5e9", title = "ORGANIK", subtitle = "SISA MAKANAN", style = "its" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (style === "krisbow") {
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.clearRect(0, 0, 192, 256);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 34, 144, 150);

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, 96, 62);

    // Simple person + bin icon
    ctx.beginPath();
    ctx.arc(118, 92, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(108, 106, 18, 38);
    ctx.fillRect(62, 124, 28, 38);
    ctx.beginPath();
    ctx.arc(82, 106, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = bg;
    ctx.fillRect(12, 12, 168, 232);
    ctx.strokeStyle = border;
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, 156, 220);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("ITS NOL SAMPAH 2029", 96, 44);

    ctx.font = "bold 18px Arial, sans-serif";
    ctx.fillText(title, 96, 74);

    // Inner pictogram box
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(36, 92, 120, 96);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 92, 120, 96);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(96, 140, 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText(subtitle, 96, 214);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Builds the outdoor ground planes, driveways, lawns, and curbed grass islands.
 */
function buildGroundAndDriveways(spec, materials, outdoorMats) {
  const group = new THREE.Group();
  group.name = "GroundAndDriveways";
  const gY = spec.exteriorGroundY;
  const { drivewaySouth, drivewayEast, lawnSouth, lawnWest, lawnEast, lawnNorth } = spec.outdoor;

  // Base earth plane slightly below exteriorGroundY to prevent any voids at borders
  const baseSoil = createGroundedBox(64, 0.04, 52, outdoorMats.soil, 3.0, gY - 0.055, -2.0, {
    castShadow: false,
    receiveShadow: true
  });
  group.add(baseSoil);

  // Main exterior lawns (non-overlapping with driveways)
  const addLawnRect = (r, name) => {
    const w = r.maxX - r.minX;
    const d = r.maxZ - r.minZ;
    if (w <= 0 || d <= 0) return;
    const mesh = createGroundedBox(w, 0.02, d, materials.grass, (r.minX + r.maxX) / 2, gY - 0.02, (r.minZ + r.maxZ) / 2, {
      castShadow: false,
      receiveShadow: true
    });
    mesh.name = name;
    group.add(mesh);
  };

  addLawnRect(lawnSouth, "lawnSouth");
  // Trim lawnWest so it does not z-fight with drivewaySouth (z: 8.5..13.5, x: -22..28)
  addLawnRect({ minX: lawnWest.minX, maxX: lawnWest.maxX, minZ: lawnWest.minZ, maxZ: drivewaySouth.minZ }, "lawnWestNorthPart");
  addLawnRect({ minX: lawnWest.minX, maxX: drivewaySouth.minX, minZ: drivewaySouth.minZ, maxZ: lawnWest.maxZ }, "lawnWestStrip");
  addLawnRect(lawnEast, "lawnEast");
  addLawnRect(lawnNorth, "lawnNorth");

  // Paved driveways (split cleanly so drivewaySouth and drivewayEast do not overlap)
  const southW = drivewaySouth.maxX - drivewaySouth.minX;
  const southD = drivewaySouth.maxZ - drivewaySouth.minZ;
  const southDrive = createGroundedBox(
    southW,
    0.024,
    southD,
    materials.paver,
    (drivewaySouth.minX + drivewaySouth.maxX) / 2,
    gY - 0.016,
    (drivewaySouth.minZ + drivewaySouth.maxZ) / 2,
    { castShadow: false, receiveShadow: true }
  );
  southDrive.name = "drivewaySouth";
  group.add(southDrive);

  const eastTrimMaxZ = drivewaySouth.minZ;
  const eastW = drivewayEast.maxX - drivewayEast.minX;
  const eastD = eastTrimMaxZ - drivewayEast.minZ;
  const eastDrive = createGroundedBox(
    eastW,
    0.024,
    eastD,
    materials.paver,
    (drivewayEast.minX + drivewayEast.maxX) / 2,
    gY - 0.016,
    (drivewayEast.minZ + eastTrimMaxZ) / 2,
    { castShadow: false, receiveShadow: true }
  );
  eastDrive.name = "drivewayEast";
  group.add(eastDrive);

  // Raised earth berm behind the south river-stone retaining wall
  const berm = createGroundedBox(
    46.0,
    0.14,
    5.8,
    outdoorMats.bermSoil,
    2.5,
    gY - 0.01,
    16.65,
    { castShadow: false, receiveShadow: true }
  );
  group.add(berm);

  const bermGrass = createGroundedBox(
    45.6,
    0.03,
    5.4,
    materials.grass,
    2.5,
    gY + 0.125,
    16.65,
    { castShadow: false, receiveShadow: true }
  );
  group.add(bermGrass);

  return group;
}

/**
 * Builds the dark hexagonal conblock perimeter walkways, winding path, and curbed grass islands.
 */
function buildWalkwaysAndCurbs(spec, materials, outdoorMats) {
  const group = new THREE.Group();
  group.name = "WalkwaysAndCurbs";
  const gY = spec.exteriorGroundY;
  const { mainHall, steelWing } = spec.wings;

  // 1. Dark hexagonal conblock walkway along Wing A south edge
  const southWalk = createGroundedBox(
    mainHall.maxX - mainHall.minX + 1.15,
    0.02,
    1.35,
    outdoorMats.hexPaver,
    (mainHall.minX - 1.15 + mainHall.maxX) / 2,
    gY - 0.004,
    mainHall.maxZ + 0.675,
    { castShadow: false, receiveShadow: true }
  );
  group.add(southWalk);

  // 2. Dark hexagonal conblock apron along Wing B east edge & west edge of Wing A (cleanly meeting southWalk)
  const eastWalk = createGroundedBox(
    1.35,
    0.02,
    steelWing.maxZ - steelWing.minZ,
    outdoorMats.hexPaver,
    steelWing.maxX + 0.675,
    gY - 0.004,
    (steelWing.minZ + steelWing.maxZ) / 2,
    { castShadow: false, receiveShadow: true }
  );
  group.add(eastWalk);

  const westWalk = createGroundedBox(
    1.15,
    0.02,
    mainHall.maxZ - mainHall.minZ,
    outdoorMats.hexPaver,
    mainHall.minX - 0.575,
    gY - 0.004,
    (mainHall.minZ + mainHall.maxZ) / 2,
    { castShadow: false, receiveShadow: true }
  );
  group.add(westWalk);

  // 3. Curbed green grass islands in the south breezeway (between perimeter walkway z=9.85 and outer lane z=11.9)
  const islands = [
    { minX: -10.8, maxX: -3.6, minZ: 9.88, maxZ: 11.82, roundWestTip: true },
    { minX: -1.1, maxX: 9.0, minZ: 9.88, maxZ: 11.82, roundWestTip: false }
  ];

  const curbW = 0.12;
  const curbH = 0.11;

  for (const isl of islands) {
    const w = isl.maxX - isl.minX;
    const d = isl.maxZ - isl.minZ;
    const cx = (isl.minX + isl.maxX) / 2;
    const cz = (isl.minZ + isl.maxZ) / 2;

    // Grass bed turf
    const turf = createGroundedBox(w - curbW, 0.055, d - curbW, materials.grass, cx, gY, cz, {
      castShadow: false,
      receiveShadow: true
    });
    group.add(turf);

    // North & south concrete curbs
    group.add(createGroundedBox(w, curbH, curbW, outdoorMats.darkCurb, cx, gY, isl.minZ + curbW / 2));
    group.add(createGroundedBox(w, curbH, curbW, outdoorMats.darkCurb, cx, gY, isl.maxZ - curbW / 2));
    // East curb
    group.add(createGroundedBox(curbW, curbH, d, outdoorMats.darkCurb, isl.maxX - curbW / 2, gY, cz));

    // West curb (rounded semicircle on west island like in reference photo)
    if (isl.roundWestTip) {
      const tipRadius = d / 2;
      const tipTurf = new THREE.Mesh(new THREE.CylinderGeometry(tipRadius - curbW, tipRadius - curbW, 0.055, 20), materials.grass);
      tipTurf.position.set(isl.minX, gY + 0.0275, cz);
      tipTurf.receiveShadow = true;
      group.add(tipTurf);

      const tipCurb = new THREE.Mesh(
        new THREE.TorusGeometry(tipRadius - curbW / 2, curbW / 2, 8, 20, Math.PI),
        outdoorMats.darkCurb
      );
      tipCurb.rotation.x = Math.PI / 2;
      tipCurb.rotation.z = Math.PI / 2;
      tipCurb.position.set(isl.minX, gY + curbH * 0.55, cz);
      tipCurb.castShadow = true;
      tipCurb.receiveShadow = true;
      group.add(tipCurb);
    } else {
      group.add(createGroundedBox(curbW, curbH, d, outdoorMats.darkCurb, isl.minX + curbW / 2, gY, cz));
    }
  }

  // 4. Winding S-curved hexagonal paver path connecting perimeter walkway to outer driveway (x: -3.5..-1.2)
  const pathPoints = [
    { x: -2.4, z: 9.95 },
    { x: -2.65, z: 10.45 },
    { x: -2.1, z: 10.95 },
    { x: -1.95, z: 11.45 },
    { x: -2.25, z: 11.85 }
  ];
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p0 = pathPoints[i];
    const p1 = pathPoints[i + 1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz) + 0.18;
    const angle = Math.atan2(dx, dz);

    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.025, len), outdoorMats.hexPaver);
    seg.position.set((p0.x + p1.x) / 2, gY + 0.013, (p0.z + p1.z) / 2);
    seg.rotation.y = angle;
    seg.receiveShadow = true;
    group.add(seg);
  }

  // 5. Straight courtyard garden walkway at east end of Wing A (z: 8.5..13.5, x: 11.6..13.0)
  const courtyardPath = createGroundedBox(1.35, 0.024, 4.9, outdoorMats.lightConcrete, 12.3, gY + 0.005, 11.0, {
    castShadow: false,
    receiveShadow: true
  });
  group.add(courtyardPath);

  return group;
}

/**
 * Builds perimeter plinth curbs, entry steps, drainage grates, and the river-stone retaining wall.
 */
function buildPerimeterStepsAndWalls(spec, materials, outdoorMats) {
  const group = new THREE.Group();
  group.name = "PerimeterStepsAndWalls";
  const gY = spec.exteriorGroundY;
  const { mainHall, steelWing } = spec.wings;

  // Perimeter curb ledge along Wing A south edge (z = 8.50..8.68)
  const stepZones = [
    { minX: -6.2, maxX: -3.8 },
    { minX: 1.6, maxX: 4.4 },
    { minX: 8.6, maxX: 11.2 }
  ];

  for (const sz of stepZones) {
    const w = sz.maxX - sz.minX;
    const cx = (sz.minX + sz.maxX) / 2;
    // Lower tread (-0.25 -> -0.125)
    group.add(createGroundedBox(w, 0.125, 0.44, materials.concretePlinth, cx, gY, mainHall.maxZ + 0.22));
    // Upper threshold nosing (-0.125 -> -0.01)
    group.add(createGroundedBox(w, 0.115, 0.16, outdoorMats.lightConcrete, cx, gY + 0.125, mainHall.maxZ + 0.08));
  }

  // Wing B south edge step apron (z = 3.5..3.9, x = 11.5..21.5)
  group.add(
    createGroundedBox(
      steelWing.maxX - steelWing.minX,
      0.125,
      0.38,
      materials.concretePlinth,
      (steelWing.minX + steelWing.maxX) / 2,
      gY,
      steelWing.maxZ + 0.19
    )
  );

  // Wing B east edge curb + recessed drainage channel grate (x = 21.5..21.85)
  const eastLen = steelWing.maxZ - steelWing.minZ;
  const eastMidZ = (steelWing.minZ + steelWing.maxZ) / 2;
  group.add(createGroundedBox(0.18, 0.12, eastLen, materials.concretePlinth, steelWing.maxX + 0.09, gY, eastMidZ));
  group.add(createGroundedBox(0.24, 0.03, eastLen, outdoorMats.drainGrate, steelWing.maxX + 0.30, gY, eastMidZ));

  // Decorative river-stone masonry retaining wall along north edge of lawnSouth (z = 13.65)
  // Stops at x = 24.0 so the SE outdoor camera preset [26, 4.5, 14.5] has an unobstructed view
  const wallMinX = -21.5;
  const wallMaxX = 24.0;
  const wallLen = wallMaxX - wallMinX;
  const wallCenterX = (wallMinX + wallMaxX) / 2;
  const wallZ = 13.68;
  const wallH = 0.46;

  const stoneWall = createGroundedBox(wallLen, wallH, 0.32, outdoorMats.riverStone, wallCenterX, gY, wallZ);
  group.add(stoneWall);

  // Concrete coping cap on top of the river-stone wall
  const wallCap = createGroundedBox(wallLen + 0.1, 0.06, 0.38, outdoorMats.lightConcrete, wallCenterX, gY + wallH, wallZ);
  group.add(wallCap);

  return group;
}

/**
 * Creates a detailed tapered wheeled plastic trash bin (Krisbow / ITS Nol Sampah style).
 */
function createWheeledBin({
  bodyColor = "#2e8b57",
  lidColor = null,
  decalTex = null,
  openLid = false,
  tiltAngle = 0,
  outdoorMats
}) {
  const bin = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.52,
    metalness: 0.04
  });
  const topLidMat = lidColor
    ? new THREE.MeshStandardMaterial({ color: lidColor, roughness: 0.48, metalness: 0.04 })
    : bodyMat;

  // Tapered rectangular bin body via 4-sided cylinder scaled into a 0.48 x 0.52m footprint
  const bodyH = 0.84;
  const bodyGeo = new THREE.CylinderGeometry(0.32, 0.25, bodyH, 4, 1);
  bodyGeo.rotateY(Math.PI / 4);
  bodyGeo.scale(1.02, 1.0, 1.08);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.08 + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  bin.add(body);

  // Upper collar rim around the mouth
  const rim = createGroundedBox(0.50, 0.055, 0.53, bodyMat, 0, 0.08 + bodyH - 0.04, 0);
  bin.add(rim);

  // Hinged lid (or open interior bag peeking out)
  if (openLid) {
    const bagMat = new THREE.MeshStandardMaterial({ color: "#d63344", roughness: 0.45, metalness: 0.05 });
    const bag = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), bagMat);
    bag.scale.set(1.1, 0.55, 1.15);
    bag.position.set(0, 0.08 + bodyH - 0.02, 0);
    bag.castShadow = true;
    bin.add(bag);
  } else {
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.08 + bodyH + 0.015, 0);
    lidGroup.add(createGroundedBox(0.52, 0.04, 0.55, topLidMat, 0, 0, 0));
    lidGroup.add(createGroundedBox(0.34, 0.035, 0.36, topLidMat, 0, 0.038, 0.02));
    // Rear hinge knuckles
    lidGroup.add(createGroundedBox(0.32, 0.045, 0.06, topLidMat, 0, -0.01, -0.27));
    bin.add(lidGroup);
  }

  // Rear axle + two rubber wheels + front support feet
  const wheelGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.045, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(wheelGeo, outdoorMats.rubberWheel);
    wheel.position.set(side * 0.23, 0.095, -0.22);
    wheel.castShadow = true;
    bin.add(wheel);

    // Front support foot
    bin.add(createGroundedBox(0.07, 0.08, 0.07, bodyMat, side * 0.14, 0, 0.15));
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 8), outdoorMats.steelAxle);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 0.095, -0.22);
  bin.add(axle);

  // Front decal sticker
  if (decalTex) {
    const decalMat = new THREE.MeshStandardMaterial({
      map: decalTex,
      transparent: true,
      roughness: 0.45,
      metalness: 0.02
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), decalMat);
    // Positioned slightly proud of front sloped face (which slopes from z=0.19 at bottom to 0.245 at top)
    decal.position.set(0, 0.52, 0.232);
    decal.rotation.x = -0.085;
    bin.add(decal);
  }

  if (tiltAngle !== 0) {
    bin.rotation.z = tiltAngle;
  }

  return bin;
}

/**
 * Creates a round cylindrical blue outdoor bin with domed lid (seen near the west lawn tip).
 */
function createRoundOutdoorBin(color = "#1f6fb8") {
  const bin = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.05 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.78, 18), mat);
  body.position.y = 0.39;
  body.castShadow = true;
  body.receiveShadow = true;
  bin.add(body);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 18), mat);
  rim.position.y = 0.78;
  rim.castShadow = true;
  bin.add(rim);

  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mat);
  lid.scale.y = 0.45;
  lid.position.y = 0.79;
  lid.castShadow = true;
  bin.add(lid);

  return bin;
}

/**
 * Builds all grouped trash bins from layoutSpec plus additional perimeter bins from photos.
 */
function buildTrashBins(spec, outdoorMats) {
  const group = new THREE.Group();
  group.name = "TrashBins";

  const decals = {
    organik: createBinDecalTexture({ bg: "#267347", title: "SISA MAKANAN", subtitle: "HANYA ORGANIK" }),
    asrama: createBinDecalTexture({ bg: "#a44225", title: "ASRAMA ITS", subtitle: "RESIDU" }),
    elektronik: createBinDecalTexture({ bg: "#8c242b", title: "ELEKTRONIK", subtitle: "LIMBAH B3" }),
    kertas: createBinDecalTexture({ bg: "#1d4b8f", title: "KERTAS & DUS", subtitle: "BERSIH & KERING" }),
    krisbow: createBinDecalTexture({ title: "KRISBOW", style: "krisbow" })
  };

  const groups = spec.outdoor.trashBinGroups || [];
  groups.forEach((binGroup, gIdx) => {
    binGroup.colors.forEach((color, idx) => {
      let x = binGroup.startX + (binGroup.axis === "x" ? idx * binGroup.spacing : 0);
      let z = binGroup.startZ + (binGroup.axis === "z" ? idx * binGroup.spacing : 0);

      // Keep Wing B east edge bins slightly clear of the x=21.2 column radius
      if (gIdx === 0 && x > 20.64) {
        x = 20.64;
      }

      // Keep south outdoor bins just outside the south plinth curb so they sit cleanly on the hex walkway
      if (gIdx === 1 && z < spec.wings.mainHall.maxZ + 0.34) {
        z = spec.wings.mainHall.maxZ + 0.34;
      }

      const groundY = getGroundYAt(x, z, spec);
      let lidColor = null;
      let decalTex = decals.krisbow;
      let openLid = false;

      if (gIdx === 0) {
        // Wing B sorted ITS Nol Sampah bins
        const decalKeys = ["organik", "asrama", "elektronik", "kertas"];
        decalTex = decals[decalKeys[idx % decalKeys.length]];
      } else {
        // Wing A south-west bins: dark green, open medium green, dark green w/ mustard lid
        if (idx === 1) openLid = true;
        if (idx === 2) lidColor = "#c79a26";
      }

      const bin = createWheeledBin({
        bodyColor: color,
        lidColor,
        decalTex,
        openLid,
        outdoorMats
      });
      bin.position.set(x, groundY, z);
      bin.rotation.y = binGroup.rotY;
      group.add(bin);
    });
  });

  // 4th yellow Krisbow bin at the end of the SW outdoor cluster (matching IMG20261111153640.jpg)
  const yellowBin = createWheeledBin({
    bodyColor: "#d49b1a",
    lidColor: "#c28b12",
    decalTex: decals.krisbow,
    outdoorMats
  });
  yellowBin.position.set(-11.5 + 3 * 0.72, spec.exteriorGroundY + 0.015, spec.wings.mainHall.maxZ + 0.34);
  group.add(yellowBin);

  // Two blue cylindrical outdoor bins near the curved west grass island tip (IMG20261111153637.jpg)
  const bluePositions = [
    { x: -12.35, z: 9.75 },
    { x: -11.75, z: 10.15 }
  ];
  for (const pos of bluePositions) {
    const roundBin = createRoundOutdoorBin("#1b6cb8");
    roundBin.position.set(pos.x, spec.exteriorGroundY + 0.015, pos.z);
    group.add(roundBin);
  }

  // Individual green/slate bins tucked near south edge columns (clear of entry steps)
  const columnBins = [
    { x: 1.15, z: 8.88, color: "#1e5e36", lidColor: "#c79a26", tilt: 0 },
    { x: 5.2, z: 8.88, color: "#4a5568", lidColor: "#c79a26", tilt: -0.06 },
    { x: 7.4, z: 8.88, color: "#1e5e36", lidColor: "#c79a26", tilt: 0 }
  ];
  for (const cb of columnBins) {
    const bin = createWheeledBin({
      bodyColor: cb.color,
      lidColor: cb.lidColor,
      decalTex: decals.krisbow,
      tiltAngle: cb.tilt,
      outdoorMats
    });
    bin.position.set(cb.x, spec.exteriorGroundY + 0.015, cb.z);
    group.add(bin);
  }

  return group;
}

/**
 * Creates a multi-branched tropical canopy shade tree with organic clustered foliage.
 */
function createCanopyTree(scale, seed, materials, outdoorMats) {
  const tree = new THREE.Group();
  const rng = createRng(seed);

  // Main trunk + slight natural lean
  const trunkH = (2.2 + rng() * 0.6) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.28 * scale, trunkH, 9),
    materials.bark
  );
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (rng() - 0.5) * 0.08;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // 3 spreading branches
  const branchCount = 3;
  const foliageMats = [outdoorMats.canopyDark, outdoorMats.canopyBright, outdoorMats.canopyMid];

  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2 + rng() * 0.6;
    const tilt = 0.42 + rng() * 0.25;
    const bLen = (1.3 + rng() * 0.5) * scale;

    const branchPivot = new THREE.Group();
    branchPivot.position.y = trunkH * (0.72 + rng() * 0.18);
    branchPivot.rotation.y = angle;

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * scale, 0.13 * scale, bLen, 7),
      materials.bark
    );
    branch.position.set(Math.sin(tilt) * bLen * 0.5, Math.cos(tilt) * bLen * 0.5, 0);
    branch.rotation.z = -tilt;
    branch.castShadow = true;
    branchPivot.add(branch);

    // Foliage puffs at branch tip
    const tipX = Math.sin(tilt) * bLen * 0.9;
    const tipY = Math.cos(tilt) * bLen * 0.9;
    for (let c = 0; c < 5; c++) {
      const r = (c < 3 ? 0.85 + rng() * 0.55 : 0.5 + rng() * 0.3) * scale;
      const puff = new THREE.Mesh(foliageBlob(i * 3 + c), foliageMats[(i + c) % foliageMats.length]);
      puff.scale.set(r * (1.0 + rng() * 0.25), r * (0.78 + rng() * 0.18), r * (1.0 + rng() * 0.25));
      puff.position.set(
        tipX + (rng() - 0.5) * (c < 3 ? 0.9 : 1.9) * scale,
        tipY + (rng() - 0.3) * (c < 3 ? 0.65 : 1.0) * scale,
        (rng() - 0.5) * (c < 3 ? 0.9 : 1.9) * scale
      );
      puff.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
      puff.castShadow = true;
      puff.receiveShadow = true;
      branchPivot.add(puff);
    }

    tree.add(branchPivot);
  }

  // Central crown cap
  const topCrown = new THREE.Mesh(foliageBlob(1), outdoorMats.canopyBright);
  topCrown.scale.set(1.35 * scale, 1.05 * scale, 1.3 * scale);
  topCrown.position.y = trunkH + 1.05 * scale;
  topCrown.castShadow = true;
  topCrown.receiveShadow = true;
  tree.add(topCrown);

  return tree;
}

/**
 * Creates a multi-stemmed spiky/feathery bamboo palm cluster (like in the south lawn islands).
 */
function createBambooPalmCluster(scale, seed, materials, outdoorMats) {
  const palm = new THREE.Group();
  const rng = createRng(seed);
  const stemCount = 6;
  const bladeGeo = new THREE.ConeGeometry(0.11, 1.05, 4);
  bladeGeo.scale(1.0, 1.0, 0.22);

  for (let i = 0; i < stemCount; i++) {
    const angle = (i / stemCount) * Math.PI * 2 + rng() * 0.4;
    const splay = 0.16 + rng() * 0.18;
    const stemH = (1.35 + rng() * 0.7) * scale;

    const stemPivot = new THREE.Group();
    stemPivot.rotation.y = angle;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022 * scale, 0.035 * scale, stemH, 6),
      outdoorMats.palmStem
    );
    stem.position.set(Math.sin(splay) * stemH * 0.5, Math.cos(splay) * stemH * 0.5, 0);
    stem.rotation.z = -splay;
    stem.castShadow = true;
    stemPivot.add(stem);

    // Radiating spiky frond blades at top of stem
    const topX = Math.sin(splay) * stemH;
    const topY = Math.cos(splay) * stemH;
    const frondCluster = new THREE.Group();
    frondCluster.position.set(topX, topY, 0);

    for (let b = 0; b < 7; b++) {
      const bAngle = (b / 7) * Math.PI * 2 + rng() * 0.3;
      const bPitch = 0.45 + rng() * 0.65;
      const blade = new THREE.Mesh(
        bladeGeo,
        b % 2 === 0 ? outdoorMats.palmFrond : materials.foliageBright
      );
      blade.scale.multiplyScalar(scale * (0.75 + rng() * 0.35));
      blade.rotation.order = "YXZ";
      blade.rotation.y = bAngle;
      blade.rotation.x = bPitch;
      blade.position.set(
        Math.sin(bAngle) * 0.32 * scale,
        0.18 * scale,
        Math.cos(bAngle) * 0.32 * scale
      );
      blade.castShadow = true;
      frondCluster.add(blade);
    }

    stemPivot.add(frondCluster);
    palm.add(stemPivot);
  }

  return palm;
}

/**
 * Creates a Syzygium / Pucuk Merah ornamental shrub-tree with lime-green leaves & warm golden-reddish tips.
 */
function createPucukMerahTree(scale, seed, materials, outdoorMats) {
  const shrubTree = new THREE.Group();
  const rng = createRng(seed);

  // Twin-forked slender trunk
  for (const dir of [-1, 1]) {
    const h = (1.15 + rng() * 0.25) * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.065 * scale, h, 7),
      materials.bark
    );
    trunk.position.set(dir * 0.09 * scale, h / 2, (rng() - 0.5) * 0.06);
    trunk.rotation.z = -dir * 0.12;
    trunk.castShadow = true;
    shrubTree.add(trunk);
  }

  const foliageOffsets = [
    { x: 0, y: 1.45, z: 0, r: 1.0, mat: outdoorMats.canopyBright },
    { x: -0.35, y: 1.25, z: 0.22, r: 0.78, mat: outdoorMats.canopyMid },
    { x: 0.38, y: 1.28, z: -0.18, r: 0.82, mat: outdoorMats.canopyBright },
    { x: 0.08, y: 1.88, z: 0.05, r: 0.72, mat: outdoorMats.canopyShoot },
    { x: -0.22, y: 1.72, z: -0.15, r: 0.58, mat: outdoorMats.canopyShoot },
    { x: 0.3, y: 1.7, z: 0.25, r: 0.5, mat: outdoorMats.canopyShoot }
  ];

  for (const [fi, f] of foliageOffsets.entries()) {
    const lobe = new THREE.Mesh(foliageBlob(fi + 1), f.mat);
    lobe.scale.setScalar(f.r * 0.6 * scale);
    lobe.position.set(f.x * scale, f.y * scale, f.z * scale);
    lobe.castShadow = true;
    lobe.receiveShadow = true;
    shrubTree.add(lobe);
  }

  return shrubTree;
}

/**
 * Creates a low tropical bush (optionally with coral-orange Ixora flower clusters).
 */
function createTropicalShrub(scale, seed, hasFlowers, materials, outdoorMats) {
  const shrub = new THREE.Group();
  const rng = createRng(seed);
  const base = 0.36 * scale;

  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(foliageBlob(i, 1), i % 2 === 0 ? outdoorMats.shrubDark : outdoorMats.shrubBright);
    puff.position.set((rng() - 0.5) * 0.42 * scale, (0.2 + rng() * 0.16) * scale, (rng() - 0.5) * 0.42 * scale);
    puff.scale.set(base * (0.9 + rng() * 0.4), base * (0.75 + rng() * 0.3), base * (0.9 + rng() * 0.4));
    puff.castShadow = true;
    puff.receiveShadow = true;
    shrub.add(puff);
  }

  if (hasFlowers) {
    const bloomGeo = new THREE.SphereGeometry(0.065 * scale, 6, 5);
    for (let f = 0; f < 6; f++) {
      const bloom = new THREE.Mesh(bloomGeo, outdoorMats.coralBloom);
      bloom.position.set((rng() - 0.5) * 0.48 * scale, (0.35 + rng() * 0.15) * scale, (rng() - 0.5) * 0.48 * scale);
      shrub.add(bloom);
    }
  }

  return shrub;
}

/**
 * Places perimeter canopy trees from layoutSpec plus foreground island palms, pucuk merah, and shrubs.
 */
function buildGreenery(spec, materials, outdoorMats) {
  const group = new THREE.Group();
  group.name = "OutdoorGreenery";
  const gY = spec.exteriorGroundY;

  // 1. Primary canopy trees from layoutSpec.outdoor.trees
  const { drivewaySouth, drivewayEast } = spec.outdoor;
  (spec.outdoor.trees || []).forEach((t, idx) => {
    const inSouthDrive =
      t.x >= drivewaySouth.minX && t.x <= drivewaySouth.maxX && t.z >= drivewaySouth.minZ && t.z <= drivewaySouth.maxZ;
    const inEastDrive =
      t.x >= drivewayEast.minX && t.x <= drivewayEast.maxX && t.z >= drivewayEast.minZ && t.z <= drivewayEast.maxZ;
    const inDriveway = inSouthDrive || inEastDrive;

    // Trees sitting on the raised south berm (z > 13.7) rest at berm top; driveway trees get a stone-curbed tree pit
    const baseY = t.z > 13.8 ? gY + 0.14 : inDriveway ? gY + 0.08 : gY;
    if (inDriveway) {
      const pitSoil = createGroundedBox(1.35, 0.1, 1.35, outdoorMats.bermSoil, t.x, gY, t.z);
      const pitCurbN = createGroundedBox(1.5, 0.14, 0.1, outdoorMats.lightConcrete, t.x, gY, t.z - 0.72);
      const pitCurbS = createGroundedBox(1.5, 0.14, 0.1, outdoorMats.lightConcrete, t.x, gY, t.z + 0.72);
      const pitCurbW = createGroundedBox(0.1, 0.14, 1.35, outdoorMats.lightConcrete, t.x - 0.72, gY, t.z);
      const pitCurbE = createGroundedBox(0.1, 0.14, 1.35, outdoorMats.lightConcrete, t.x + 0.72, gY, t.z);
      group.add(pitSoil, pitCurbN, pitCurbS, pitCurbW, pitCurbE);
    }

    const tree = createCanopyTree(t.scale || 1.15, 2000 + idx * 97, materials, outdoorMats);
    tree.position.set(t.x, baseY, t.z);
    group.add(tree);
  });

  // Extra backdrop canopy trees along the raised south & north berms
  const extraCanopy = [
    { x: -16.0, z: 16.5, scale: 1.35 },
    { x: -4.0, z: 17.2, scale: 1.25 },
    { x: 7.5, z: 16.8, scale: 1.3 },
    { x: 21.5, z: 16.5, scale: 1.2 },
    { x: -17.5, z: -10.5, scale: 1.2 },
    { x: 3.0, z: -17.5, scale: 1.3 }
  ];
  extraCanopy.forEach((t, idx) => {
    const tree = createCanopyTree(t.scale, 5000 + idx * 131, materials, outdoorMats);
    const baseY = t.z > 13.8 ? gY + 0.14 : gY;
    tree.position.set(t.x, baseY, t.z);
    group.add(tree);
  });

  // 2. Bamboo palm clusters in the curbed south grass islands & lawn edges
  const palmPlacements = [
    { x: -8.2, z: 10.75, scale: 1.05 },
    { x: -16.2, z: 7.4, scale: 0.9 },
    { x: 0.2, z: 10.8, scale: 1.05 },
    { x: 8.1, z: 10.85, scale: 0.85 },
    { x: 23.3, z: -1.2, scale: 1.0 },
    { x: 23.4, z: -7.8, scale: 0.95 }
  ];
  palmPlacements.forEach((p, idx) => {
    const palm = createBambooPalmCluster(p.scale, 7000 + idx * 73, materials, outdoorMats);
    palm.position.set(p.x, gY + 0.03, p.z);
    group.add(palm);
  });

  // 3. Pucuk Merah ornamental shrub-trees in the east south island (IMG20261111153736)
  const pucukPlacements = [
    { x: 2.3, z: 10.85, scale: 1.15 },
    { x: 6.2, z: 10.8, scale: 0.95 },
    { x: -15.8, z: 5.5, scale: 1.05 }
  ];
  pucukPlacements.forEach((p, idx) => {
    const tree = createPucukMerahTree(p.scale, 9000 + idx * 59, materials, outdoorMats);
    tree.position.set(p.x, gY + 0.03, p.z);
    group.add(tree);
  });

  // 4. Flowering & leafy low shrubs along retaining wall, islands, and Wing B perimeter
  const shrubPlacements = [
    { x: -12.0, z: 14.3, scale: 1.25, flowers: true },
    { x: -6.2, z: 14.4, scale: 1.15, flowers: true },
    { x: 4.5, z: 14.4, scale: 1.2, flowers: false },
    { x: 11.0, z: 14.3, scale: 1.15, flowers: true },
    { x: -6.0, z: 10.85, scale: 0.95, flowers: false },
    { x: 4.4, z: 10.85, scale: 0.85, flowers: false },
    { x: 23.0, z: 2.4, scale: 1.05, flowers: false },
    { x: 23.1, z: -11.5, scale: 1.1, flowers: true }
  ];
  shrubPlacements.forEach((s, idx) => {
    const shrub = createTropicalShrub(s.scale, 11000 + idx * 41, s.flowers, materials, outdoorMats);
    const baseY = s.z > 13.8 ? gY + 0.14 : gY + 0.03;
    shrub.position.set(s.x, baseY, s.z);
    group.add(shrub);
  });

  return group;
}

/**
 * Entry builder for the outdoor environment: perimeter curbs, walkways, driveways, bins & greenery.
 * @param {typeof import("./layoutSpec.js").LAYOUT_SPEC} layoutSpec
 * @param {ReturnType<import("./materials.js").createMaterials>} materials
 * @returns {THREE.Group}
 */
export function createOutdoor(layoutSpec, materials) {
  const root = new THREE.Group();
  root.name = "OutdoorEnvironment";

  const hexTex = createHexPaverTexture();
  hexTex.repeat.set(16, 2);
  const stoneTex = createRiverStoneTexture();

  const outdoorMats = {
    soil: new THREE.MeshStandardMaterial({ color: 0x4f4334, roughness: 0.96, metalness: 0.0 }),
    bermSoil: new THREE.MeshStandardMaterial({ color: 0x614e3a, roughness: 0.95, metalness: 0.0 }),
    hexPaver: new THREE.MeshStandardMaterial({ map: hexTex, roughness: 0.9, metalness: 0.04 }),
    riverStone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.88, metalness: 0.03 }),
    darkCurb: new THREE.MeshStandardMaterial({ color: 0x4e5257, roughness: 0.88, metalness: 0.04 }),
    lightConcrete: new THREE.MeshStandardMaterial({ color: 0xb6bbc0, roughness: 0.84, metalness: 0.04 }),
    drainGrate: new THREE.MeshStandardMaterial({ color: 0x2d3238, roughness: 0.6, metalness: 0.55 }),
    rubberWheel: new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.85, metalness: 0.05 }),
    steelAxle: new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.4, metalness: 0.7 }),
    foliageMid: new THREE.MeshStandardMaterial({ color: 0x3b7330, roughness: 0.84, metalness: 0.02 }),
    // Tree crowns: vertex-shaded leafy blobs that sway in the wind
    canopyDark: applyWind(new THREE.MeshStandardMaterial({ color: 0x356f2c, roughness: 0.88, vertexColors: true }), { strength: 0.07, minY: 1.4, maxY: 6.5, leaf: 7 }),
    canopyBright: applyWind(new THREE.MeshStandardMaterial({ color: 0x66a544, roughness: 0.86, vertexColors: true }), { strength: 0.07, minY: 1.4, maxY: 6.5, leaf: 7 }),
    canopyMid: applyWind(new THREE.MeshStandardMaterial({ color: 0x488a37, roughness: 0.87, vertexColors: true }), { strength: 0.07, minY: 1.4, maxY: 6.5, leaf: 7 }),
    canopyShoot: applyWind(new THREE.MeshStandardMaterial({ color: 0xc9743a, roughness: 0.8, vertexColors: true }), { strength: 0.05, minY: 0.6, maxY: 3.0, leaf: 9 }),
    shrubDark: applyWind(new THREE.MeshStandardMaterial({ color: 0x38702d, roughness: 0.88, vertexColors: true }), { strength: 0.012, minY: -0.2, maxY: 1.4, leaf: 11 }),
    shrubBright: applyWind(new THREE.MeshStandardMaterial({ color: 0x5f9c40, roughness: 0.86, vertexColors: true }), { strength: 0.012, minY: -0.2, maxY: 1.4, leaf: 11 }),
    palmStem: new THREE.MeshStandardMaterial({ color: 0x6f8245, roughness: 0.82, metalness: 0.0 }),
    palmFrond: applyWind(new THREE.MeshStandardMaterial({ color: 0x6ba143, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide }), { strength: 0.05, minY: 0.5, maxY: 3.2 }),
    pucukShoot: new THREE.MeshStandardMaterial({ color: 0xb57c32, roughness: 0.78, metalness: 0.02 }),
    coralBloom: new THREE.MeshStandardMaterial({ color: 0xd95836, roughness: 0.75, metalness: 0.0 })
  };

  root.add(buildGroundAndDriveways(layoutSpec, materials, outdoorMats));
  root.add(buildWalkwaysAndCurbs(layoutSpec, materials, outdoorMats));
  root.add(buildPerimeterStepsAndWalls(layoutSpec, materials, outdoorMats));
  root.add(buildTrashBins(layoutSpec, outdoorMats));
  root.add(buildGreenery(layoutSpec, materials, outdoorMats));

  return root;
}
