import * as THREE from "three";
import { applyMetricUV, metricIfFlagged } from "./geomUtils.js";

/**
 * Building & Architectural Structure Builder
 * Owns: floors & plinth, structural columns, Wing A asymmetric roof + skylight truss,
 * west window-grid gable, south orange perimeter beam, 2F mezzanine + trapezoidal balcony bay,
 * curved white switchback staircase + under-stair closet, glass-walled office,
 * Wing B clerestory pavilion, and hanging/ceiling lamps.
 */

function setShadows(obj, cast = true, receive = true) {
  obj.castShadow = cast;
  obj.receiveShadow = receive;
  return obj;
}

function createBox(w, h, d, material, x, y, z, shadowOpts = {}) {
  const { castShadow = true, receiveShadow = true } = shadowOpts;
  const geo = new THREE.BoxGeometry(w, h, d);
  metricIfFlagged(geo, material, x, y, z);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return setShadows(mesh, castShadow, receiveShadow);
}

/** Swaps U and V so panel joints / roof ribs run down-slope on slabs that pitch along X. */
function swapUV(geo) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geo;
}

/**
 * Computes Wing A (mainHall) ceiling soffit height at a given Z coordinate.
 */
function getMainHallRoofY(z) {
  if (z >= 3.5) {
    // South overhang (8.7, 3.05) -> south edge (8.5, 3.15) -> spine (3.5, 5.45)
    const t = (8.5 - z) / (8.5 - 3.5);
    return 3.15 + t * (5.45 - 3.15);
  }
  if (z >= -1.8) {
    // Center spine (3.5, 5.45) -> mezzanine edge (-1.8, 7.0)
    const t = (3.5 - z) / (3.5 - -1.8);
    return 5.45 + t * (7.0 - 5.45);
  }
  // Mezzanine edge (-1.8, 7.0) -> north wall (-6.5, 7.45)
  const t = (-1.8 - z) / (-1.8 - -6.5);
  return 7.0 + t * (7.45 - 7.0);
}

/**
 * Computes Wing B (steelWing) roof soffit height at (x, z).
 * East side slopes cleanly from ridge (x=15.5, y=6.4) to east eave (x=21.5, y=4.85).
 * West side slopes from ridge (x=15.5, y=6.4) to west eave, rising smoothly along Z
 * from y=4.85 at z=-14.5 to y=6.2 at z=-6.5 to match the taller Wing A columns.
 */
function getSteelWingRoofY(x, z) {
  const ridgeX = 15.5;
  const ridgeY = 6.4;
  if (x >= ridgeX) {
    const t = (x - ridgeX) / (21.5 - ridgeX);
    return ridgeY + t * (4.85 - ridgeY);
  }
  const westEaveY = z <= -6.5
    ? 4.85 + Math.max(0, (z - -14.2) / (-6.5 - -14.2)) * (6.2 - 4.85)
    : 6.2;
  const t = (ridgeX - x) / (ridgeX - 11.5);
  return ridgeY + t * (westEaveY - ridgeY);
}

/**
 * Creates a sloped rectangular slab spanning along Z from (z1, y1) to (z2, y2).
 */
function createSlopedSlabZ(minX, maxX, z1, y1, z2, y2, thickness, material, shadowOpts = {}) {
  const width = maxX - minX;
  const dz = z2 - z1;
  const dy = y2 - y1;
  const len = Math.hypot(dz, dy);
  const angle = Math.atan2(dy, dz);
  // UVs in metres: u = world X (so ceiling joints line up across slabs), v = distance up the slope
  const geo = applyMetricUV(new THREE.BoxGeometry(width, thickness, len), (minX + maxX) * 0.5, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((minX + maxX) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
  mesh.rotation.x = -angle;
  return setShadows(mesh, shadowOpts.castShadow ?? true, shadowOpts.receiveShadow ?? true);
}

/**
 * Creates a sloped rectangular slab spanning along X from (x1, y1) to (x2, y2).
 */
function createSlopedSlabX(x1, y1, x2, y2, minZ, maxZ, thickness, material, shadowOpts = {}) {
  const depth = maxZ - minZ;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const geo = swapUV(applyMetricUV(new THREE.BoxGeometry(len, thickness, depth), 0, 0, (minZ + maxZ) * 0.5));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (minZ + maxZ) * 0.5);
  mesh.rotation.z = angle;
  return setShadows(mesh, shadowOpts.castShadow ?? true, shadowOpts.receiveShadow ?? true);
}

/**
 * Creates a triangulated thick quad slab from 4 corner points (p00, p10, p11, p01).
 */
function createThickQuadSlab(p00, p10, p11, p01, thickness, material) {
  const halfT = thickness * 0.5;
  const pts = [p00, p10, p11, p01];
  const top = pts.map((p) => [p[0], p[1] + halfT, p[2]]);
  const bot = pts.map((p) => [p[0], p[1] - halfT, p[2]]);

  const positions = [];
  const uvs = [];
  const pushTri = (a, b, c) => {
    positions.push(...a, ...b, ...c);
    // Metres: u along the ridge (Z), v across the slope (X)
    uvs.push(a[2], a[0], b[2], b[0], c[2], c[0]);
  };

  // Top face
  pushTri(top[0], top[1], top[2], [0, 0], [1, 0], [1, 1]);
  pushTri(top[0], top[2], top[3], [0, 0], [1, 1], [0, 1]);
  // Bottom face
  pushTri(bot[0], bot[2], bot[1], [0, 0], [1, 1], [1, 0]);
  pushTri(bot[0], bot[3], bot[2], [0, 0], [0, 1], [1, 1]);
  // 4 side rims
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pushTri(bot[i], top[i], top[j], [0, 0], [0, 1], [1, 1]);
    pushTri(bot[i], top[j], bot[j], [0, 0], [1, 1], [1, 0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  return setShadows(mesh, true, true);
}

/**
 * Builds the L-shaped raised concrete plinth and glossy ceramic tiled floor.
 */
function buildFloorAndPlinth(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "FloorAndPlinth";

  const { mainHall, steelWing } = layoutSpec.wings;
  const plinthH = layoutSpec.plinthHeight;
  const tileThickness = 0.025;
  const plinthBaseH = plinthH - tileThickness;
  const plinthCenterY = layoutSpec.exteriorGroundY + plinthBaseH * 0.5;
  const tileCenterY = layoutSpec.floorY - tileThickness * 0.5;

  // Wing A plinth & tiled floor (x: -14.0..11.5, z: -6.5..8.5)
  const wA = mainHall.maxX - mainHall.minX;
  const dA = mainHall.maxZ - mainHall.minZ;
  const cxA = (mainHall.minX + mainHall.maxX) * 0.5;
  const czA = (mainHall.minZ + mainHall.maxZ) * 0.5;

  group.add(createBox(wA, plinthBaseH, dA, materials.concretePlinth, cxA, plinthCenterY, czA, { castShadow: false }));
  group.add(createBox(wA, tileThickness, dA, materials.floorTile, cxA, tileCenterY, czA, { castShadow: false }));

  // Wing B plinth & tiled floor (x: 11.5..21.5, z: -14.5..3.5) — non-overlapping with Wing A
  const wB = steelWing.maxX - steelWing.minX;
  const dB = steelWing.maxZ - steelWing.minZ;
  const cxB = (steelWing.minX + steelWing.maxX) * 0.5;
  const czB = (steelWing.minZ + steelWing.maxZ) * 0.5;

  group.add(createBox(wB, plinthBaseH, dB, materials.concretePlinth, cxB, plinthCenterY, czB, { castShadow: false }));

  // World-space metric UVs keep the 50 cm tile grid continuous across both wings
  group.add(createBox(wB, tileThickness, dB, materials.floorTile, cxB, tileCenterY, czB, { castShadow: false }));

  return group;
}

/**
 * Builds all cylindrical grey concrete columns from layoutSpec.columns.
 */
function buildColumns(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "StructuralColumns";

  const { columns } = layoutSpec;
  const baseRingMat = materials.concretePlinth;

  const addColumnList = (list, radius) => {
    for (const col of list) {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, col.h, 20),
        materials.concreteColumn
      );
      shaft.position.set(col.x, col.h * 0.5, col.z);
      // Spin each shaft so the shared scuff/chip texture never repeats column to column
      shaft.rotation.y = (Math.abs(Math.sin(col.x * 12.9898 + col.z * 78.233)) * 43758.5453) % (Math.PI * 2);
      setShadows(shaft, true, true);
      group.add(shaft);

      // Subtle concrete collar at floor base
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.02, radius + 0.025, 0.07, 20),
        baseRingMat
      );
      collar.position.set(col.x, 0.035, col.z);
      setShadows(collar, true, true);
      group.add(collar);
    }
  };

  addColumnList(columns.southEdge, columns.radiusMain);
  addColumnList(columns.centerSpine, columns.radiusMain);
  addColumnList(columns.mezzanineEdge, columns.radiusMain);
  addColumnList(columns.steelWing, columns.radiusSecondary);

  return group;
}

/**
 * Builds Wing A asymmetric pitched roof (wood soffit with skylight cutout, steel purlins/trusses,
 * outer corrugated metal roof), perimeter beams, south orange fascia, and west window-grid gable.
 */
function buildMainHallStructure(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "MainHallStructure";

  const mh = layoutSpec.wings.mainHall;
  const minX = mh.minX - 0.35;
  const maxX = mh.maxX + 0.25;
  const gap = mh.skylightGap;

  // 1. South perimeter concrete beam + signature orange perimeter fascia beam
  const southW = mh.maxX - mh.minX + 0.4;
  const southCx = (mh.minX + mh.maxX) * 0.5;
  const beamH = mh.southBeamTopY - mh.southBeamBottomY;
  const beamCy = (mh.southBeamTopY + mh.southBeamBottomY) * 0.5;
  group.add(createBox(southW, beamH, 0.32, materials.whitePlaster, southCx, beamCy, 8.2));
  group.add(createBox(southW + 0.06, beamH - 0.04, 0.4, materials.orangeBeam, southCx, beamCy - 0.02, 8.22));

  // Center spine longitudinal concrete beam (z=3.5) & mezzanine edge beam (z=-1.8)
  group.add(createBox(southW, 0.36, 0.34, materials.whitePlaster, southCx, 5.2, mh.centerSpineZ));
  group.add(createBox(southW, 0.38, 0.36, materials.whitePlaster, southCx, 6.82, mh.mezzanineEdgeZ));

  // Cantilevered SW corner concrete brow tucked cleanly beneath the south roof eave
  group.add(createBox(1.4, 0.46, 1.15, materials.whitePlaster, mh.minX + 0.35, 2.88, 8.1));

  // 2. Wing A Roof: 3 Z-segments:
  //    (a) South bay: z = 8.7 -> 3.5
  //    (b) North-center bay with skylight cutout: z = 3.5 -> -1.8
  //    (c) North bay over mezzanine: z = -1.8 -> -6.7
  const ySouthOver = getMainHallRoofY(8.7);
  const ySpine = getMainHallRoofY(3.5);
  const yMezz = getMainHallRoofY(-1.8);
  const yNorthOver = getMainHallRoofY(-6.7);

  // Outer metal roof sheeting (raised +0.26m above wood soffit to form truss cavity)
  const roofOffset = 0.26;
  group.add(createSlopedSlabZ(minX, maxX, 8.7, ySouthOver + roofOffset, 3.5, ySpine + roofOffset, 0.08, materials.roofMetal));
  group.add(createSlopedSlabZ(minX, maxX, 3.5, ySpine + roofOffset, -1.8, yMezz + roofOffset, 0.08, materials.roofMetal));
  group.add(createSlopedSlabZ(minX, maxX, -1.8, yMezz + roofOffset, -6.7, yNorthOver + roofOffset, 0.08, materials.roofMetal));

  // Reflective foil backing inside the skylight cavity
  group.add(
    createSlopedSlabZ(
      gap.minX - 0.3,
      gap.maxX + 0.3,
      gap.maxZ + 0.1,
      getMainHallRoofY(gap.maxZ + 0.1) + roofOffset - 0.05,
      gap.minZ - 0.1,
      getMainHallRoofY(gap.minZ - 0.1) + roofOffset - 0.05,
      0.015,
      materials.stainlessSteel,
      { castShadow: false }
    )
  );

  // Wood-slat ceiling soffit panels
  group.add(createSlopedSlabZ(minX, maxX, 8.7, ySouthOver, 3.5, ySpine, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabZ(minX, maxX, -1.8, yMezz, -6.7, yNorthOver, 0.05, materials.woodSoffit));

  // North-center wood soffit split cleanly around skylightGap (minX: -9, maxX: 9, minZ: 0, maxZ: 2)
  const yGapMax = getMainHallRoofY(gap.maxZ);
  const yGapMin = getMainHallRoofY(gap.minZ);
  group.add(createSlopedSlabZ(minX, gap.minX, 3.5, ySpine, -1.8, yMezz, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabZ(gap.maxX, maxX, 3.5, ySpine, -1.8, yMezz, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabZ(gap.minX, gap.maxX, 3.5, ySpine, gap.maxZ, yGapMax, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabZ(gap.minX, gap.maxX, gap.minZ, yGapMin, -1.8, yMezz, 0.05, materials.woodSoffit));

  // Exposed dark steel purlins & cross-trusses visible through skylightGap
  const purlinZs = [0.25, 0.75, 1.25, 1.75];
  for (const pz of purlinZs) {
    const py = getMainHallRoofY(pz) + 0.14;
    group.add(createBox(gap.maxX - gap.minX + 0.6, 0.06, 0.05, materials.blackMullion, (gap.minX + gap.maxX) * 0.5, py, pz));
  }
  const rafterXs = [-8.5, -5.0, -1.5, 1.5, 5.0, 8.5];
  for (const rx of rafterXs) {
    group.add(createSlopedSlabZ(rx - 0.03, rx + 0.03, gap.maxZ + 0.1, yGapMax + 0.12, gap.minZ - 0.1, yGapMin + 0.12, 0.08, materials.blackMullion));
  }

  // 3. West Gable Curtain Wall (x = -14.0)
  buildWestGableCurtainWall(group, mh, materials);

  return group;
}

/**
 * Builds the West Gable End (x = -14.0): open lower portal (y < 2.05),
 * white spandrel beam (y: 2.05..2.65), and huge sloped black-mullioned glass grid up to the roof.
 */
function buildWestGableCurtainWall(group, mh, materials) {
  const gableX = mh.minX;
  const openMinZ = -1.8;
  const openMaxZ = 8.4;

  // White concrete spandrel across open portal (y: 2.05..2.65)
  group.add(createBox(0.28, 0.6, openMaxZ - openMinZ, materials.whitePlaster, gableX, 2.35, (openMinZ + openMaxZ) * 0.5));

  // Solid NW wall behind stairs/stalls end (z: -6.5..-1.8, y: 0..3.35)
  group.add(createBox(0.26, 3.35, 4.7, materials.whitePlaster, gableX, 1.675, -4.15));

  // Sloped glass curtain wall spanning z: -6.5..8.4 from y=2.65 (or 3.35 on NW bay) up to roofY(z)
  const glassBottomY = 2.65;
  const zSteps = 12;
  const zStart = -6.4;
  const zEnd = 8.35;
  const dz = (zEnd - zStart) / zSteps;

  // Build trapezoidal glass strip per vertical mullion bay
  const glassPositions = [];
  const glassUvs = [];
  for (let i = 0; i < zSteps; i++) {
    const z0 = zStart + i * dz;
    const z1 = z0 + dz;
    const base0 = z0 < openMinZ ? 3.35 : glassBottomY;
    const base1 = z1 < openMinZ ? 3.35 : glassBottomY;
    const top0 = getMainHallRoofY(z0) - 0.04;
    const top1 = getMainHallRoofY(z1) - 0.04;

    // Two triangles in YZ plane at x = gableX
    glassPositions.push(
      gableX, base0, z0,
      gableX, base1, z1,
      gableX, top1, z1,
      gableX, base0, z0,
      gableX, top1, z1,
      gableX, top0, z0
    );
    glassUvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);

    // Vertical black mullion at z0
    const mH = top0 - base0;
    group.add(createBox(0.08, mH, 0.06, materials.blackMullion, gableX, base0 + mH * 0.5, z0));
  }
  // End vertical mullion
  const lastTop = getMainHallRoofY(zEnd) - 0.04;
  group.add(createBox(0.08, lastTop - glassBottomY, 0.06, materials.blackMullion, gableX, glassBottomY + (lastTop - glassBottomY) * 0.5, zEnd));

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute("position", new THREE.Float32BufferAttribute(glassPositions, 3));
  glassGeo.setAttribute("uv", new THREE.Float32BufferAttribute(glassUvs, 2));
  glassGeo.computeVertexNormals();
  const glassMesh = new THREE.Mesh(glassGeo, materials.clearGlass);
  setShadows(glassMesh, false, false);
  group.add(glassMesh);

  // Horizontal black transoms clipped to sloped roof profile
  const transomYs = [2.68, 3.45, 4.25, 5.05, 5.85, 6.65];
  for (const ty of transomYs) {
    // Find max Z where roofY(z) >= ty + 0.05
    let zMax = zStart;
    for (let z = zStart; z <= zEnd; z += 0.05) {
      if (getMainHallRoofY(z) >= ty + 0.05) {
        zMax = z;
      }
    }
    const zMin = ty < 3.35 ? openMinZ : zStart;
    if (zMax > zMin + 0.2) {
      group.add(createBox(0.08, 0.06, zMax - zMin, materials.blackMullion, gableX, ty, (zMin + zMax) * 0.5));
    }
  }

  // Diagonal rake mullions following the roof slope on the gable
  group.add(createSlopedSlabZ(gableX - 0.05, gableX + 0.05, 8.4, getMainHallRoofY(8.4) - 0.04, 3.5, getMainHallRoofY(3.5) - 0.04, 0.08, materials.blackMullion));
  group.add(createSlopedSlabZ(gableX - 0.05, gableX + 0.05, 3.5, getMainHallRoofY(3.5) - 0.04, -1.8, getMainHallRoofY(-1.8) - 0.04, 0.08, materials.blackMullion));
  group.add(createSlopedSlabZ(gableX - 0.05, gableX + 0.05, -1.8, getMainHallRoofY(-1.8) - 0.04, -6.5, getMainHallRoofY(-6.5) - 0.04, 0.08, materials.blackMullion));
}

/**
 * Builds the 2F mezzanine slab, north service wall with 2F wooden doors,
 * concrete parapet + dark-blue handrail, protruding trapezoidal balcony bay,
 * and suspended rusted overhead cable tray.
 */
function buildMezzanineAndNorthWall(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "MezzanineAndNorthWall";

  const mh = layoutSpec.wings.mainHall;
  const bridge = layoutSpec.wings.steelWing.mezzanineBridge;
  const floorY = mh.mezzanineFloorY;
  const slabT = mh.mezzanineSlabThickness;
  const slabCy = floorY - slabT * 0.5;
  const parapetH = mh.mezzanineParapetTopY - floorY;
  const parapetCy = floorY + parapetH * 0.5;
  const railY = mh.mezzanineRailTopY;

  // 1. North service wall (z = -6.58 so inner face sits cleanly at z = -6.47)
  // Wing A section (x: -14.0..11.5) rises to northRoofTopY (7.45m)
  const wallAW = mh.maxX - mh.minX;
  const wallACx = (mh.minX + mh.maxX) * 0.5;
  group.add(createBox(wallAW, mh.northRoofTopY, 0.22, materials.whitePlaster, wallACx, mh.northRoofTopY * 0.5, mh.minZ - 0.08));

  // Wing B mezzanine bridge rear wall (x: 11.5..15.5) sloped cleanly under Wing B roof (6.18m..6.38m)
  const bridgeWallShape = new THREE.Shape();
  bridgeWallShape.moveTo(mh.maxX, 0);
  bridgeWallShape.lineTo(bridge.maxX, 0);
  bridgeWallShape.lineTo(bridge.maxX, 6.36);
  bridgeWallShape.lineTo(mh.maxX, 6.18);
  bridgeWallShape.closePath();
  const bridgeWallGeo = new THREE.ExtrudeGeometry(bridgeWallShape, { depth: 0.22, bevelEnabled: false });
  const bridgeWallMesh = new THREE.Mesh(bridgeWallGeo, materials.whitePlaster);
  bridgeWallMesh.position.set(0, 0, mh.minZ - 0.19);
  setShadows(bridgeWallMesh, true, true);
  group.add(bridgeWallMesh);

  // Black floor baseboard trim along north wall
  group.add(createBox(mh.maxX - mh.minX, 0.09, 0.04, materials.blackMullion, (mh.minX + mh.maxX) * 0.5, 0.045, mh.minZ + 0.04));

  // 2F Mezzanine wooden double doors on north wall
  for (const dx of [-6.0, 1.5, 8.2]) {
    group.add(createBox(1.55, 2.25, 0.06, materials.blackMullion, dx, floorY + 1.125, mh.minZ + 0.04));
    group.add(createBox(0.7, 2.15, 0.05, materials.darkWood, dx - 0.37, floorY + 1.1, mh.minZ + 0.06));
    group.add(createBox(0.7, 2.15, 0.05, materials.darkWood, dx + 0.37, floorY + 1.1, mh.minZ + 0.06));
  }

  // 2. Main Wing A Mezzanine slab (x: -14.0..11.5, z: -6.5..-1.8)
  const wA = mh.maxX - mh.minX;
  const dA = mh.mezzanineEdgeZ - mh.minZ;
  const cxA = (mh.minX + mh.maxX) * 0.5;
  const czA = (mh.minZ + mh.mezzanineEdgeZ) * 0.5;
  group.add(createBox(wA, slabT, dA, materials.whitePlaster, cxA, slabCy, czA));

  // Wing B Mezzanine landing bridge north of the staircase (x: 11.5..15.5, z: -6.5..-3.6)
  // Leaving z: -3.6..2.0 open as the stairwell void so stairs ascend cleanly without clipping!
  const wBridge = bridge.maxX - bridge.minX;
  const dBridge = -3.6 - bridge.minZ;
  group.add(
    createBox(
      wBridge,
      slabT,
      dBridge,
      materials.whitePlaster,
      (bridge.minX + bridge.maxX) * 0.5,
      slabCy,
      (bridge.minZ + -3.6) * 0.5
    )
  );

  // 3. Mezzanine parapet walls & dark-blue metal top railing along z = -1.8
  // Straight segments left (x: -13.9..1.5) and right (x: 6.5..11.5) of the trapezoidal bay
  const addParapetSegment = (x1, z1, x2, z2) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const segGroup = new THREE.Group();
    segGroup.position.set((x1 + x2) * 0.5, 0, (z1 + z2) * 0.5);
    segGroup.rotation.y = -angle;

    segGroup.add(createBox(len, parapetH, 0.16, materials.whitePlaster, 0, parapetCy, 0));

    // Dark-blue top tubular handrail
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, len + 0.04, 12), materials.blueHandrail);
    rail.rotation.z = Math.PI * 0.5;
    rail.position.set(0, railY, 0);
    setShadows(rail, true, false);
    segGroup.add(rail);

    // Supporting short blue posts
    const postCount = Math.max(2, Math.floor(len / 1.8) + 1);
    for (let i = 0; i < postCount; i++) {
      const px = -len * 0.48 + (i / Math.max(1, postCount - 1)) * (len * 0.96);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, railY - mh.mezzanineParapetTopY + 0.04, 8), materials.blueHandrail);
      post.position.set(px, (mh.mezzanineParapetTopY + railY) * 0.5, 0);
      segGroup.add(post);
    }

    group.add(segGroup);
  };

  // Wing A straight parapet segments
  addParapetSegment(-13.9, mh.mezzanineEdgeZ, 1.5, mh.mezzanineEdgeZ);
  addParapetSegment(6.5, mh.mezzanineEdgeZ, 11.5, mh.mezzanineEdgeZ);

  // Iconic protruding triangular/trapezoidal balcony bay above office (x: 1.5..6.5, apex at x: 4.0, z: -0.55)
  const bayApexX = 4.0;
  const bayApexZ = -0.55;
  addParapetSegment(1.5, mh.mezzanineEdgeZ, bayApexX, bayApexZ);
  addParapetSegment(bayApexX, bayApexZ, 6.5, mh.mezzanineEdgeZ);

  // Triangular concrete floor & angled soffit of the protruding bay
  const bayShape = new THREE.Shape();
  bayShape.moveTo(1.5, -mh.mezzanineEdgeZ);
  bayShape.lineTo(bayApexX, -bayApexZ);
  bayShape.lineTo(6.5, -mh.mezzanineEdgeZ);
  bayShape.closePath();

  const bayGeo = new THREE.ExtrudeGeometry(bayShape, { depth: slabT, bevelEnabled: false });
  bayGeo.rotateX(-Math.PI * 0.5);
  const bayFloor = new THREE.Mesh(bayGeo, materials.whitePlaster);
  bayFloor.position.y = floorY - slabT;
  setShadows(bayFloor, true, true);
  group.add(bayFloor);

  // Wing B stairwell guard parapets at y=3.35
  addParapetSegment(11.5, mh.mezzanineEdgeZ, 11.5, -3.6);
  addParapetSegment(11.5, -3.6, 11.86, -3.6);
  addParapetSegment(13.04, -3.6, 15.5, -3.6);
  addParapetSegment(15.5, -3.6, 15.5, -6.5);

  // 4. Suspended weathered/rusted overhead cable tray beneath mezzanine soffit
  const trayY = 2.96;
  group.add(createBox(24.5, 0.04, 0.36, materials.rustyTray, -1.5, trayY, -2.25));
  group.add(createBox(0.36, 0.04, 4.0, materials.rustyTray, 10.75, trayY, -4.1));
  for (let hx = -12.5; hx <= 10.5; hx += 3.8) {
    group.add(createBox(0.02, 0.2, 0.02, materials.blackMullion, hx, trayY + 0.1, -2.4));
    group.add(createBox(0.02, 0.2, 0.02, materials.blackMullion, hx, trayY + 0.1, -2.1));
  }

  return group;
}

/**
 * Builds the glass-walled office ("Kantor Pelayanan Asrama") at x: 4.8..11.0, z: -6.5..-2.2,
 * plus the recessed alcove wall & glass entrance door around x: 2.0..4.8, z: -4.28..-4.6.
 */
function buildOfficeRoom(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "OfficeRoom";

  const off = layoutSpec.officeRoom;
  const h = Math.min(off.height, layoutSpec.wings.mainHall.mezzanineFloorY - layoutSpec.wings.mainHall.mezzanineSlabThickness);

  // Recessed alcove wall backing PERHATIAN sign & wallDisplayCabinet (z = -4.28)
  group.add(createBox(1.9, h, 0.16, materials.whitePlaster, 2.92, h * 0.5, -4.28));
  group.add(createBox(1.05, h - 2.35, 0.16, materials.whitePlaster, 4.32, 2.35 + (h - 2.35) * 0.5, -4.28));

  // Recessed glass entrance wall with double glass doors at z = -4.6
  group.add(createBox(0.08, 2.35, 0.08, materials.blackMullion, 3.88, 1.175, -4.6));
  group.add(createBox(0.08, 2.35, 0.08, materials.blackMullion, 4.8, 1.175, -4.6));
  group.add(createBox(0.96, 0.08, 0.08, materials.blackMullion, 4.34, 2.35, -4.6));
  // Glass door leaves + stainless handles
  group.add(createBox(0.42, 2.25, 0.04, materials.clearGlass, 4.12, 1.14, -4.6, { castShadow: false }));
  group.add(createBox(0.42, 2.25, 0.04, materials.clearGlass, 4.56, 1.14, -4.6, { castShadow: false }));
  group.add(createBox(0.03, 0.45, 0.06, materials.stainlessSteel, 4.28, 1.05, -4.55));
  group.add(createBox(0.03, 0.45, 0.06, materials.stainlessSteel, 4.4, 1.05, -4.55));

  // Helper to build a black-mullioned glass curtain partition with frosted lower band
  const addGlassWall = (x1, z1, x2, z2, bays, doorBayIdx = -1) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);

    const wGroup = new THREE.Group();
    wGroup.position.set(x1, 0, z1);
    wGroup.rotation.y = -angle;

    // Top & bottom frame rails + mid transoms
    wGroup.add(createBox(len, 0.06, 0.07, materials.blackMullion, len * 0.5, 0.03, 0));
    wGroup.add(createBox(len, 0.06, 0.07, materials.blackMullion, len * 0.5, h - 0.03, 0));
    wGroup.add(createBox(len, 0.05, 0.07, materials.blackMullion, len * 0.5, 2.25, 0));

    const bayW = len / bays;
    for (let i = 0; i <= bays; i++) {
      wGroup.add(createBox(0.06, h, 0.07, materials.blackMullion, i * bayW, h * 0.5, 0));
    }

    for (let i = 0; i < bays; i++) {
      const cx = (i + 0.5) * bayW;
      if (i === doorBayIdx) {
        // Glass door bay with stainless pull handles
        wGroup.add(createBox(bayW - 0.08, 2.18, 0.03, materials.clearGlass, cx, 1.14, 0, { castShadow: false }));
        wGroup.add(createBox(0.03, 0.45, 0.06, materials.stainlessSteel, cx - 0.07, 1.05, 0.04));
        wGroup.add(createBox(0.03, 0.45, 0.06, materials.stainlessSteel, cx + 0.07, 1.05, 0.04));
      } else {
        // Transom bar at y=1.05 + frosted lower glass + clear upper glass
        wGroup.add(createBox(bayW, 0.045, 0.06, materials.blackMullion, cx, 1.05, 0));
        wGroup.add(createBox(bayW - 0.06, 0.96, 0.025, materials.frostedGlass, cx, 0.55, 0, { castShadow: false }));
        wGroup.add(createBox(bayW - 0.06, 1.14, 0.025, materials.clearGlass, cx, 1.65, 0, { castShadow: false }));
      }
      // Top clerestory glass above y=2.25
      wGroup.add(createBox(bayW - 0.06, h - 2.31, 0.025, materials.clearGlass, cx, 2.28 + (h - 2.31) * 0.5, 0, { castShadow: false }));
    }

    group.add(wGroup);
  };

  // Office South Wall (x: 4.8..11.0, z: -2.2) — 5 bays, bay 0 is double glass entrance
  addGlassWall(off.minX, off.maxZ, off.maxX, off.maxZ, 5, 0);

  // Office West Glass Wall (x: 4.8, z: -4.6..-2.2) — 2 bays
  addGlassWall(off.minX, -4.6, off.minX, off.maxZ, 2, -1);

  // Office East Wall (x: 11.0, z: -6.5..-2.2): front glass + rear solid wall with brown double door
  addGlassWall(off.maxX, -4.1, off.maxX, off.maxZ, 2, -1);
  group.add(createBox(0.16, h, 2.4, materials.whitePlaster, off.maxX, h * 0.5, -5.3));
  // Double brown wood doors on east wall facing Wing B atrium
  group.add(createBox(0.19, 2.25, 1.48, materials.blackMullion, off.maxX, 1.125, -5.3));
  group.add(createBox(0.21, 2.16, 0.68, materials.darkWood, off.maxX, 1.1, -5.66));
  group.add(createBox(0.21, 2.16, 0.68, materials.darkWood, off.maxX, 1.1, -4.94));

  return group;
}

/**
 * Builds the iconic curved switchback white concrete staircase + curved drum landing,
 * under-stair enclosed storage closet, dark-blue handrails, and tiled treads.
 */
function buildStaircase(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "CurvedStaircase";

  const st = layoutSpec.staircase;
  const drumX = 12.75; // spans x: 11.07..14.43, keeping perhatianSigns[0] at (11.2, 1.9, 2.25) flush outside
  const drumZ = st.curvedDrumCenter.z; // 1.5
  const drumR = 1.68;
  const midY = st.totalRise * 0.5; // 1.675
  const totalY = st.totalRise; // 3.35

  // Flights positioned east of x=11.75 so upper balustrade clears column (11.5, -1.8, r=0.25)
  const flightW = 1.1;
  const upperCx = 12.48; // spans x: 11.93..13.03 (west balustrade face x=11.78 > 11.75)
  const lowerCx = 13.78; // spans x: 13.23..14.33
  const zBottom = -3.6;
  const zDrumJoin = drumZ; // 1.5
  const flightLen = zDrumJoin - zBottom; // 5.1m
  const stepsPerFlight = 10;
  const stepRun = flightLen / stepsPerFlight;
  const stepRise = midY / stepsPerFlight;

  // 1. Curved semicircular white concrete drum + mid-landing platform
  const drumBody = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR, midY, 32, 1, false, -Math.PI * 0.5, Math.PI),
    materials.whitePlaster
  );
  drumBody.position.set(drumX, midY * 0.5, drumZ);
  setShadows(drumBody, true, true);
  group.add(drumBody);

  // Tiled mid-landing floor disk on top of drum
  const landingDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR - 0.14, drumR - 0.14, 0.04, 32, 1, false, -Math.PI * 0.5, Math.PI),
    materials.stairTile
  );
  landingDisk.position.set(drumX, midY + 0.01, drumZ);
  setShadows(landingDisk, false, true);
  group.add(landingDisk);

  // Curved concrete parapet wall around drum landing (y: midY .. midY + 0.92)
  const parapetH = 0.92;
  const outerParapet = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR, parapetH, 32, 1, true, -Math.PI * 0.5, Math.PI),
    materials.whitePlaster
  );
  outerParapet.position.set(drumX, midY + parapetH * 0.5, drumZ);
  setShadows(outerParapet, true, true);
  group.add(outerParapet);

  const innerParapet = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR - 0.15, drumR - 0.15, parapetH, 32, 1, true, -Math.PI * 0.5, Math.PI),
    materials.whitePlaster
  );
  innerParapet.position.set(drumX, midY + parapetH * 0.5, drumZ);
  setShadows(innerParapet, true, true);
  group.add(innerParapet);

  // Top cap of curved parapet (theta PI..2*PI in XY maps to +Z south after rotateX(-PI/2))
  const capRing = new THREE.Mesh(
    new THREE.RingGeometry(drumR - 0.15, drumR, 32, 1, Math.PI, Math.PI),
    materials.whitePlaster
  );
  capRing.rotation.x = -Math.PI * 0.5;
  capRing.position.set(drumX, midY + parapetH, drumZ);
  group.add(capRing);

  // Dark-blue curved tubular handrail above drum parapet
  const curvedRail = new THREE.Mesh(
    new THREE.TorusGeometry(drumR - 0.075, 0.032, 10, 32, Math.PI),
    materials.blueHandrail
  );
  curvedRail.rotation.x = Math.PI * 0.5;
  curvedRail.position.set(drumX, midY + parapetH + 0.16, drumZ);
  setShadows(curvedRail, true, false);
  group.add(curvedRail);

  for (let a = 0; a <= 4; a++) {
    const theta = (a / 4) * Math.PI;
    const px = drumX + Math.cos(theta) * (drumR - 0.075);
    const pz = drumZ + Math.sin(theta) * (drumR - 0.075);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), materials.blueHandrail);
    post.position.set(px, midY + parapetH + 0.08, pz);
    group.add(post);
  }

  // Short north shoulder return closing west rim of curved drum (x: 11.07..11.86 at z=1.5)
  const shoulderLen = 11.86 - (drumX - drumR);
  const shoulderCx = (drumX - drumR + 11.86) * 0.5;
  group.add(createBox(shoulderLen, parapetH, 0.15, materials.whitePlaster, shoulderCx, midY + parapetH * 0.5, drumZ));
  const shoulderRail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, shoulderLen + 0.04, 10), materials.blueHandrail);
  shoulderRail.rotation.z = Math.PI * 0.5;
  shoulderRail.position.set(shoulderCx, midY + parapetH + 0.16, drumZ);
  setShadows(shoulderRail, true, false);
  group.add(shoulderRail);

  // 2. Enclosed under-stair storage closet under the flights & drum
  const closetZMin = -1.6;
  const closetW = flightW * 2 + 0.2;
  group.add(createBox(closetW, midY, zDrumJoin - closetZMin, materials.whitePlaster, (lowerCx + upperCx) * 0.5, midY * 0.5, (closetZMin + zDrumJoin) * 0.5));
  // Closet white door + dark horizontal louver vent on west side facing hall
  group.add(createBox(0.06, 1.5, 0.78, materials.cabinetWhite, upperCx - flightW * 0.5 - 0.04, 0.76, 0.65));
  group.add(createBox(0.07, 0.18, 0.48, materials.blackMullion, upperCx - flightW * 0.5 - 0.05, 1.25, 0.05));

  // 3. Lower Flight (x = lowerCx, climbs +Z from z=-3.6, y=0 up to z=1.5, y=1.675)
  for (let i = 0; i < stepsPerFlight; i++) {
    const yTop = (i + 1) * stepRise;
    const zCenter = zBottom + (i + 0.5) * stepRun;
    group.add(createBox(flightW, yTop, stepRun + 0.01, materials.whitePlaster, lowerCx, yTop * 0.5, zCenter));
    group.add(createBox(flightW - 0.02, 0.025, stepRun, materials.stairTile, lowerCx, yTop + 0.012, zCenter, { castShadow: false }));
    group.add(createBox(flightW - 0.02, 0.018, 0.03, materials.blackMullion, lowerCx, yTop + 0.018, zCenter - stepRun * 0.46));
  }

  // 4. Upper Flight (x = upperCx, climbs -Z from z=1.5, y=1.675 up to z=-3.6, y=3.35)
  // Angled concrete soffit beam under upper flight + individual steps
  group.add(createSlopedSlabZ(upperCx - flightW * 0.5, upperCx + flightW * 0.5, zDrumJoin, midY - 0.14, zBottom, totalY - 0.14, 0.26, materials.whitePlaster));

  for (let i = 0; i < stepsPerFlight; i++) {
    const yTop = midY + (i + 1) * stepRise;
    const zCenter = zDrumJoin - (i + 0.5) * stepRun;
    group.add(createBox(flightW, stepRise + 0.12, stepRun + 0.02, materials.whitePlaster, upperCx, yTop - (stepRise + 0.12) * 0.5, zCenter));
    group.add(createBox(flightW - 0.02, 0.025, stepRun, materials.stairTile, upperCx, yTop + 0.012, zCenter, { castShadow: false }));
    group.add(createBox(flightW - 0.02, 0.018, 0.03, materials.blackMullion, upperCx, yTop + 0.018, zCenter + stepRun * 0.46));
  }

  // 5. Sloped concrete stringer/parapet walls + dark-blue handrails along flights
  // Normalize endpoints so zA < zB before atan2, preventing upside-down flip when climbing -Z.
  const addSlopedBalustrade = (bx, z1, y1, z2, y2, wallDepthBelow = 0) => {
    const zA = z1 <= z2 ? z1 : z2;
    const yA = z1 <= z2 ? y1 : y2;
    const zB = z1 <= z2 ? z2 : z1;
    const yB = z1 <= z2 ? y2 : y1;

    const dz = zB - zA;
    const dy = yB - yA;
    const len = Math.hypot(dz, dy);
    const angle = Math.atan2(dy, dz);
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, (yA + yB) * 0.5, (zA + zB) * 0.5);
    bGroup.rotation.x = -angle;

    const totalWallH = 0.92 + wallDepthBelow;
    bGroup.add(createBox(0.15, totalWallH, len, materials.whitePlaster, 0, 0.46 - wallDepthBelow * 0.5, 0));

    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len + 0.06, 10), materials.blueHandrail);
    rail.rotation.x = Math.PI * 0.5;
    rail.position.set(0, 1.08, 0);
    setShadows(rail, true, false);
    bGroup.add(rail);

    for (let k = -2; k <= 2; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), materials.blueHandrail);
      post.position.set(0, 0.99, (k / 2.2) * (len * 0.48));
      bGroup.add(post);
    }

    group.add(bGroup);
  };

  // Lower flight outer (east) balustrade + upper flight outer (west) & center divider balustrades
  addSlopedBalustrade(lowerCx + flightW * 0.5 + 0.075, zBottom, 0, zDrumJoin, midY, 0.2);
  addSlopedBalustrade(upperCx - flightW * 0.5 - 0.075, zDrumJoin, midY, zBottom, totalY, 0.25);
  addSlopedBalustrade((lowerCx + upperCx) * 0.5, zDrumJoin, midY, zBottom, totalY, 0.35);

  return group;
}

/**
 * Builds Wing B (Steel Dining Tables Pavilion): pitched roof, clerestory window bands
 * with white spandrel beams, and north/south gable window grids.
 */
function buildSteelWingStructure(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "SteelWingStructure";

  const sw = layoutSpec.wings.steelWing;
  const ridgeX = sw.ridgeX; // 15.5
  const ridgeY = sw.ridgeY; // 6.4
  const eastX = sw.maxX + 0.35; // 21.85 overhang
  const westX = sw.minX; // 11.5
  const minZ = sw.minZ - 0.25; // -14.75 overhang
  const maxZ = sw.maxZ + 0.25; // 3.75 overhang

  // 1. Wing B Roof (East slope + West transition slope)
  const eastOverY = getSteelWingRoofY(eastX, -10);
  // East wood soffit & outer metal roof
  group.add(createSlopedSlabX(ridgeX, ridgeY, eastX, eastOverY, minZ, maxZ, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabX(ridgeX, ridgeY + 0.22, eastX, eastOverY + 0.22, minZ, maxZ, 0.08, materials.roofMetal));

  // West slope south section (z: -6.5..3.75, constant eave y=6.2 at x=11.5)
  group.add(createSlopedSlabX(westX, 6.2, ridgeX, ridgeY, -6.5, maxZ, 0.05, materials.woodSoffit));
  group.add(createSlopedSlabX(westX, 6.42, ridgeX, ridgeY + 0.22, -6.5, maxZ, 0.08, materials.roofMetal));

  // West slope north section (z: -14.75..-6.5, smoothly rising from 4.85 at north eave to 6.2 at Wing A join)
  group.add(
    createThickQuadSlab(
      [westX, 4.85, minZ],
      [ridgeX, ridgeY, minZ],
      [ridgeX, ridgeY, -6.5],
      [westX, 6.2, -6.5],
      0.05,
      materials.woodSoffit
    )
  );
  group.add(
    createThickQuadSlab(
      [westX, 5.07, minZ],
      [ridgeX, ridgeY + 0.22, minZ],
      [ridgeX, ridgeY + 0.22, -6.5],
      [westX, 6.42, -6.5],
      0.08,
      materials.roofMetal
    )
  );

  // Ridge beam
  group.add(createBox(0.24, 0.26, maxZ - minZ, materials.whitePlaster, ridgeX, ridgeY - 0.1, (minZ + maxZ) * 0.5));

  // 2. East Clerestory Wall (x = 21.2, z: -14.2..3.5, open below y=2.05)
  const spandrelH = sw.clerestoryBottomY - sw.spandrelBottomY; // 0.6
  const spandrelCy = (sw.clerestoryBottomY + sw.spandrelBottomY) * 0.5; // 2.35
  const clereH = sw.clerestoryTopY - sw.clerestoryBottomY; // 2.2
  const clereCy = (sw.clerestoryTopY + sw.clerestoryBottomY) * 0.5; // 3.75
  const eastLen = sw.maxZ - -14.2;
  const eastCz = (sw.maxZ + -14.2) * 0.5;

  group.add(createBox(0.24, spandrelH, eastLen, materials.whitePlaster, 21.2, spandrelCy, eastCz));
  group.add(createBox(0.24, 0.22, eastLen, materials.whitePlaster, 21.2, sw.clerestoryTopY - 0.05, eastCz));
  group.add(createBox(0.03, clereH - 0.1, eastLen, materials.clearGlass, 21.2, clereCy, eastCz, { castShadow: false }));
  group.add(createBox(0.07, 0.06, eastLen, materials.blackMullion, 21.2, clereCy, eastCz));
  group.add(createBox(0.07, 0.06, eastLen, materials.blackMullion, 21.2, sw.clerestoryBottomY + 0.03, eastCz));
  for (let z = -14.2; z <= sw.maxZ + 0.01; z += 1.77) {
    group.add(createBox(0.07, clereH, 0.06, materials.blackMullion, 21.2, clereCy, z));
  }

  // 3. West Clerestory Band (x = 11.5, z: -14.2..-6.5, open below y=2.05)
  const westLen = -6.5 - -14.2;
  const westCz = (-6.5 + -14.2) * 0.5;
  group.add(createBox(0.24, spandrelH, westLen, materials.whitePlaster, 11.5, spandrelCy, westCz));
  group.add(createSlopedSlabZ(11.4, 11.6, -14.2, 4.85, -6.5, 6.2, 0.22, materials.whitePlaster));

  // Sloped clerestory glass on x = 11.5
  const wGlassPos = [
    11.5, sw.clerestoryBottomY, -14.2,
    11.5, sw.clerestoryBottomY, -6.5,
    11.5, 6.15, -6.5,
    11.5, sw.clerestoryBottomY, -14.2,
    11.5, 6.15, -6.5,
    11.5, 4.8, -14.2
  ];
  const wGlassGeo = new THREE.BufferGeometry();
  wGlassGeo.setAttribute("position", new THREE.Float32BufferAttribute(wGlassPos, 3));
  wGlassGeo.computeVertexNormals();
  group.add(setShadows(new THREE.Mesh(wGlassGeo, materials.clearGlass), false, false));

  for (let z = -14.2; z <= -6.5 + 0.01; z += 1.54) {
    const topY = 4.85 + ((z - -14.2) / 7.7) * (6.2 - 4.85);
    const mH = topY - sw.clerestoryBottomY;
    group.add(createBox(0.07, mH, 0.06, materials.blackMullion, 11.5, sw.clerestoryBottomY + mH * 0.5, z));
  }
  group.add(createBox(0.07, 0.06, westLen, materials.blackMullion, 11.5, 3.75, westCz));

  // 4. North & South Gable Curtain Grids for Wing B (z = -14.3 and z = 3.5)
  const buildWingBGable = (gz) => {
    const gW = sw.maxX - sw.minX;
    const gCx = (sw.minX + sw.maxX) * 0.5;
    // White spandrel beam above open lower passage (y: 2.05..2.65)
    group.add(createBox(gW, spandrelH, 0.24, materials.whitePlaster, gCx, spandrelCy, gz));

    const steps = 8;
    const dx = (21.2 - 11.5) / steps;
    const gPos = [];
    for (let i = 0; i < steps; i++) {
      const x0 = 11.5 + i * dx;
      const x1 = x0 + dx;
      const top0 = getSteelWingRoofY(x0, gz) - 0.05;
      const top1 = getSteelWingRoofY(x1, gz) - 0.05;
      gPos.push(
        x0, sw.clerestoryBottomY, gz,
        x1, sw.clerestoryBottomY, gz,
        x1, top1, gz,
        x0, sw.clerestoryBottomY, gz,
        x1, top1, gz,
        x0, top0, gz
      );
      const mH = top0 - sw.clerestoryBottomY;
      group.add(createBox(0.06, mH, 0.07, materials.blackMullion, x0, sw.clerestoryBottomY + mH * 0.5, gz));
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3));
    gGeo.computeVertexNormals();
    group.add(setShadows(new THREE.Mesh(gGeo, materials.clearGlass), false, false));

    for (const ty of [3.45, 4.25, 5.05, 5.75]) {
      let xMin = 21.2;
      let xMax = 11.5;
      for (let x = 11.5; x <= 21.2; x += 0.1) {
        if (getSteelWingRoofY(x, gz) >= ty + 0.08) {
          xMin = Math.min(xMin, x);
          xMax = Math.max(xMax, x);
        }
      }
      if (xMax > xMin + 0.3) {
        group.add(createBox(xMax - xMin, 0.06, 0.07, materials.blackMullion, (xMin + xMax) * 0.5, ty, gz));
      }
    }
  };

  buildWingBGable(-14.3);
  buildWingBGable(sw.maxZ);

  return group;
}

/**
 * Builds hanging enamel-shade pendant lamps with glowing bulbs and under-mezzanine ceiling fixtures.
 */
function buildLamps(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "LampsAndFixtures";

  const addPendant = (lamp, actualCeilingY) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(lamp.x, 0, lamp.z);

    const cordTop = actualCeilingY;
    const shadeY = lamp.y;
    const cordLen = Math.max(0.15, cordTop - (shadeY + 0.06));

    // Ceiling rose + hook
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 14), materials.lampShade);
    canopy.position.y = cordTop - 0.015;
    pGroup.add(canopy);

    // Thin twisted flex, hung slightly out of plumb like the real ones
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cordLen, 6), materials.blackMullion);
    cord.position.y = shadeY + 0.06 + cordLen * 0.5;
    pGroup.add(cord);

    // Bakelite lamp holder
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.07, 12), materials.blackMullion);
    socket.position.y = shadeY + 0.045;
    pGroup.add(socket);

    // White enamel saucer shade: shallow flared cone with a rolled rim
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.21, 0.075, 28, 1, true), materials.lampShade);
    shade.position.y = shadeY;
    setShadows(shade, true, false);
    pGroup.add(shade);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.008, 6, 28), materials.lampShade);
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = shadeY - 0.0375;
    pGroup.add(rim);

    // Fat white LED globe poking out below the shade
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), materials.lampEmissive);
    bulb.scale.set(1, 1.25, 1);
    bulb.position.y = shadeY - 0.04;
    pGroup.add(bulb);

    const bulbNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 12), materials.lampShade);
    bulbNeck.position.y = shadeY + 0.005;
    pGroup.add(bulbNeck);

    group.add(pGroup);
  };

  const gap = layoutSpec.wings.mainHall.skylightGap;
  for (const lamp of layoutSpec.lamps.mainHallPendants) {
    const inSkylight =
      lamp.x >= gap.minX && lamp.x <= gap.maxX && lamp.z >= gap.minZ && lamp.z <= gap.maxZ;
    const ceilingY = getMainHallRoofY(lamp.z) + (inSkylight ? 0.14 : -0.02);
    addPendant(lamp, ceilingY);
  }

  for (const lamp of layoutSpec.lamps.steelWingPendants) {
    const ceilingY = getSteelWingRoofY(lamp.x, lamp.z) - 0.02;
    addPendant(lamp, ceilingY);
  }

  // Under-mezzanine surface ceiling fixtures (mounted on soffit at y=3.13)
  const mezzSoffitY =
    layoutSpec.wings.mainHall.mezzanineFloorY - layoutSpec.wings.mainHall.mezzanineSlabThickness;
  for (const fix of layoutSpec.lamps.underMezzanineFixtures) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), materials.blackMullion);
    housing.position.set(fix.x, mezzSoffitY - 0.02, fix.z);
    group.add(housing);

    const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 16), materials.lampEmissive);
    diffuser.position.set(fix.x, mezzSoffitY - 0.045, fix.z);
    group.add(diffuser);
  }

  return group;
}

/**
 * Main exported builder matching layoutSpec.js contract.
 * @param {object} layoutSpec
 * @param {object} materials
 * @returns {THREE.Group}
 */
export function createBuilding(layoutSpec, materials) {
  const buildingGroup = new THREE.Group();
  buildingGroup.name = "BuildingStructure";

  buildingGroup.add(buildFloorAndPlinth(layoutSpec, materials));
  buildingGroup.add(buildColumns(layoutSpec, materials));
  buildingGroup.add(buildMainHallStructure(layoutSpec, materials));
  buildingGroup.add(buildMezzanineAndNorthWall(layoutSpec, materials));
  buildingGroup.add(buildOfficeRoom(layoutSpec, materials));
  buildingGroup.add(buildStaircase(layoutSpec, materials));
  buildingGroup.add(buildSteelWingStructure(layoutSpec, materials));
  buildingGroup.add(buildLamps(layoutSpec, materials));

  return buildingGroup;
}
