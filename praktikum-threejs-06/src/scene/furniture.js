import * as THREE from "three";
import { applyMetricUV, metricIfFlagged } from "./geomUtils.js";

/**
 * Helper to create a box mesh with shadows configured and positioned by its center.
 */
function makeBox(w, h, d, material, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(metricIfFlagged(new THREE.BoxGeometry(w, h, d), material), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Builds a strut connecting two 3D points with a square cross-section.
 */
function makeStrut(p1, p2, thickness, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, len, thickness),
    material
  );
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds the iconic weathered orange-red low masonry divider wall with stainless-steel top trim
 * and surface-mounted electrical conduit + 4-socket power strips.
 */
function createRedDividerWall(spec, materials) {
  const group = new THREE.Group();
  group.name = "red-divider-wall";

  const { mainSegment, westReturn } = spec;
  const pvcMat = new THREE.MeshStandardMaterial({
    color: 0xe2e6ea,
    roughness: 0.48,
    metalness: 0.05
  });
  const socketMat = new THREE.MeshStandardMaterial({
    color: 0x22262c,
    roughness: 0.6,
    metalness: 0.1
  });

  // Main east-west segment
  const mainLen = mainSegment.maxX - mainSegment.minX;
  const mainCenterX = (mainSegment.minX + mainSegment.maxX) * 0.5;
  const mainBody = makeBox(
    mainLen,
    mainSegment.height,
    mainSegment.thickness,
    materials.redCounterWall
  );
  // v = 0 at the floor so the damp, flaking base of the paint texture sits at the bottom
  applyMetricUV(mainBody.geometry, 0, mainSegment.height * 0.5, 0);
  mainBody.position.set(mainCenterX, mainSegment.height * 0.5, mainSegment.z);
  group.add(mainBody);

  // Stainless steel top cap along main segment
  const capH = 0.025;
  const capOverhang = 0.03;
  const mainCap = makeBox(
    mainLen + 0.02,
    capH,
    mainSegment.thickness + capOverhang,
    materials.whiteTableTop
  );
  mainCap.position.set(
    mainCenterX,
    mainSegment.height + capH * 0.5,
    mainSegment.z
  );
  group.add(mainCap);

  // East chamfered/white plaster end cap matching reference photos
  const endCap = makeBox(
    0.16,
    mainSegment.height + 0.01,
    mainSegment.thickness + 0.02,
    materials.whitePlaster
  );
  endCap.position.set(
    mainSegment.maxX + 0.06,
    mainSegment.height * 0.5,
    mainSegment.z
  );
  group.add(endCap);

  // West north-south return segment (stops cleanly against mainSegment north face)
  const returnEndZ = mainSegment.z - mainSegment.thickness * 0.5;
  const returnLen = returnEndZ - westReturn.minZ;
  const returnCenterZ = (westReturn.minZ + returnEndZ) * 0.5;
  const returnBody = makeBox(
    westReturn.thickness,
    westReturn.height,
    returnLen,
    materials.redCounterWall
  );
  applyMetricUV(returnBody.geometry, 0, westReturn.height * 0.5, 2.7);
  returnBody.position.set(westReturn.x, westReturn.height * 0.5, returnCenterZ);
  group.add(returnBody);

  const returnCap = makeBox(
    westReturn.thickness + capOverhang,
    capH,
    returnLen + mainSegment.thickness,
    materials.whiteTableTop
  );
  returnCap.position.set(
    westReturn.x,
    westReturn.height + capH * 0.5,
    (westReturn.minZ + mainSegment.z + mainSegment.thickness * 0.5) * 0.5
  );
  group.add(returnCap);

  // Surface-mounted PVC conduit along the south face (+Z) near the floor
  const conduitZ = mainSegment.z + mainSegment.thickness * 0.5 + 0.016;
  const conduitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, mainLen - 0.3, 10),
    pvcMat
  );
  conduitMesh.rotation.z = Math.PI * 0.5;
  conduitMesh.position.set(mainCenterX, 0.08, conduitZ);
  conduitMesh.castShadow = true;
  group.add(conduitMesh);

  // Vertical 4-socket power strips spaced behind the lesehan study tables
  const outletXs = [-6.2, -2.8, 0.6];
  for (const ox of outletXs) {
    const jBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.028, 12),
      pvcMat
    );
    jBox.rotation.x = Math.PI * 0.5;
    jBox.position.set(ox, 0.08, conduitZ);
    group.add(jBox);

    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.28, 8),
      pvcMat
    );
    riser.position.set(ox, 0.22, conduitZ);
    group.add(riser);

    const strip = makeBox(0.06, 0.24, 0.032, pvcMat, { cast: true, receive: false });
    strip.position.set(ox, 0.44, conduitZ + 0.004);
    group.add(strip);

    for (let s = 0; s < 4; s++) {
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.008, 10),
        socketMat
      );
      hole.rotation.x = Math.PI * 0.5;
      hole.position.set(ox, 0.365 + s * 0.05, conduitZ + 0.018);
      group.add(hole);
    }
  }

  return group;
}

/**
 * Builds a long canteen dining table with white laminate top, steel frame, and two benches.
 */
function createCanteenBenchTable(spec, materials) {
  const group = new THREE.Group();
  const { length, width, height } = spec;
  const topThick = 0.04;
  const apronH = 0.045;

  // Tabletop
  const top = makeBox(length, topThick, width, materials.whiteTableTop);
  top.position.y = height - topThick * 0.5;
  group.add(top);

  // Steel apron rails under tabletop
  const apronLongGeo = new THREE.BoxGeometry(length - 0.08, apronH, 0.03);
  for (const zSign of [-1, 1]) {
    const apron = new THREE.Mesh(apronLongGeo, materials.steelFrame);
    apron.position.set(0, height - topThick - apronH * 0.5, zSign * (width * 0.5 - 0.05));
    apron.castShadow = true;
    apron.receiveShadow = true;
    group.add(apron);
  }

  // Three steel A/H-leg frames along length (ends + center)
  const legH = height - topThick;
  const legSpanZ = width - 0.1;
  const legGeo = new THREE.BoxGeometry(0.04, legH, 0.04);
  const footBarGeo = new THREE.BoxGeometry(0.04, 0.035, legSpanZ);
  const xOffsets = [-length * 0.5 + 0.14, 0, length * 0.5 - 0.14];

  for (const lx of xOffsets) {
    for (const zSign of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, materials.steelFrame);
      leg.position.set(lx, legH * 0.5, zSign * (legSpanZ * 0.5 - 0.02));
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
    const crossBar = new THREE.Mesh(footBarGeo, materials.steelFrame);
    crossBar.position.set(lx, 0.12, 0);
    crossBar.castShadow = true;
    group.add(crossBar);
  }

  // Lower longitudinal stretcher bar
  const stretcher = makeBox(length - 0.28, 0.035, 0.035, materials.steelFrame);
  stretcher.position.set(0, 0.12, 0);
  group.add(stretcher);

  // Two companion dark-wood benches on +Z and -Z sides
  const benchLen = length - 0.14;
  const benchW = 0.28;
  const benchH = 0.44;
  const seatThick = 0.035;
  const benchOffsetZ = width * 0.5 + 0.24;

  const seatGeo = new THREE.BoxGeometry(benchLen, seatThick, benchW);
  const bLegGeo = new THREE.BoxGeometry(0.035, benchH - seatThick, 0.035);
  const bCrossGeo = new THREE.BoxGeometry(0.035, 0.03, benchW - 0.06);

  for (const zSign of [-1, 1]) {
    const bz = zSign * benchOffsetZ;
    const seat = new THREE.Mesh(seatGeo, materials.darkWood);
    seat.position.set(0, benchH - seatThick * 0.5, bz);
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    for (const lx of xOffsets) {
      for (const innerSign of [-1, 1]) {
        const bLeg = new THREE.Mesh(bLegGeo, materials.steelFrame);
        bLeg.position.set(
          lx,
          (benchH - seatThick) * 0.5,
          bz + innerSign * (benchW * 0.5 - 0.04)
        );
        bLeg.castShadow = true;
        bLeg.receiveShadow = true;
        group.add(bLeg);
      }
      const bCross = new THREE.Mesh(bCrossGeo, materials.steelFrame);
      bCross.position.set(lx, 0.12, bz);
      bCross.castShadow = true;
      group.add(bCross);
    }
  }

  group.position.set(spec.x, 0, spec.z);
  return group;
}

/**
 * Builds a low wooden lesehan study table (4-plank top, apron rails, 4 chunky legs).
 * Supports `tilted: true` to rest on its long edge & two leg tips cleanly at y = 0.
 */
function createLesehanTable(spec, materials) {
  const outer = new THREE.Group();
  const pivot = new THREE.Group();

  const w = spec.w ?? 1.5;
  const d = spec.d ?? 0.95;
  const height = 0.34;
  const topThick = 0.035;
  const apronH = 0.055;
  const legSize = 0.072;
  const legInset = 0.045;

  // 4 longitudinal wooden planks with narrow visible seams
  const plankCount = 4;
  const gap = 0.007;
  const plankD = (d - gap * (plankCount - 1)) / plankCount;
  const seedShift = Math.abs(Math.sin(spec.x * 3.7 + spec.z * 9.1));
  for (let i = 0; i < plankCount; i++) {
    // Each board samples its own strip of the timber texture so no two planks match
    const plankGeo = new THREE.BoxGeometry(w, topThick, plankD);
    const uv = plankGeo.attributes.uv;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, uv.getX(k) * 0.8 + seedShift * 0.7 + i * 0.13, uv.getY(k) * 0.24 + i * 0.25 + seedShift * 0.2);
    }
    const plank = new THREE.Mesh(plankGeo, materials.darkWood);
    const pz = -d * 0.5 + plankD * 0.5 + i * (plankD + gap);
    plank.position.set(0, height - topThick * 0.5, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pivot.add(plank);
  }

  // Apron skirt under tabletop
  const apronY = height - topThick - apronH * 0.5;
  const apronLongGeo = new THREE.BoxGeometry(w - legInset * 2, apronH, 0.028);
  const apronShortGeo = new THREE.BoxGeometry(0.028, apronH, d - legInset * 2);

  for (const zSign of [-1, 1]) {
    const apron = new THREE.Mesh(apronLongGeo, materials.darkWood);
    apron.position.set(0, apronY, zSign * (d * 0.5 - legInset - 0.014));
    apron.castShadow = true;
    apron.receiveShadow = true;
    pivot.add(apron);
  }
  for (const xSign of [-1, 1]) {
    const apron = new THREE.Mesh(apronShortGeo, materials.darkWood);
    apron.position.set(xSign * (w * 0.5 - legInset - 0.014), apronY, 0);
    apron.castShadow = true;
    apron.receiveShadow = true;
    pivot.add(apron);
  }

  // Underside cross battens (visible on tilted tables)
  const battenGeo = new THREE.BoxGeometry(0.04, 0.035, d - legInset * 2 - 0.04);
  for (const bx of [-w * 0.18, w * 0.18]) {
    const batten = new THREE.Mesh(battenGeo, materials.darkWood);
    batten.position.set(bx, height - topThick - 0.018, 0);
    batten.castShadow = true;
    pivot.add(batten);
  }

  // 4 chunky square legs sitting flush at y = 0 in upright orientation
  const legH = height - topThick;
  const legGeo = new THREE.BoxGeometry(legSize, legH, legSize);
  const legX = w * 0.5 - legInset - legSize * 0.5;
  const legZ = d * 0.5 - legInset - legSize * 0.5;

  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, materials.darkWood);
      leg.position.set(xSign * legX, legH * 0.5, zSign * legZ);
      leg.castShadow = true;
      leg.receiveShadow = true;
      pivot.add(leg);
    }
  }

  if (spec.tilted) {
    // Lean slightly (~83 deg) onto the +Z tabletop edge AND the +Z leg bottoms simultaneously
    const leanAngle = Math.PI * 0.5 - Math.atan2(legInset, height);
    pivot.rotation.x = leanAngle;

    // Exact lowest point of rotated local bounding points (top edge at y=height, z=d/2)
    const cosA = Math.cos(leanAngle);
    const sinA = Math.sin(leanAngle);
    const edgeY = height * cosA - (d * 0.5) * sinA;
    const legTipY = 0 * cosA - (d * 0.5 - legInset) * sinA;
    pivot.position.y = -Math.min(edgeY, legTipY);
  }

  outer.add(pivot);
  outer.position.set(spec.x, 0, spec.z);
  outer.rotation.y = spec.rotY ?? 0;
  return outer;
}

/**
 * Builds a square stainless-steel canteen picnic table with 4 attached dark-wood benches,
 * central cylindrical post, floor '+' cross-base, under-table cross-frame, and diagonal struts.
 */
function createSteelPicnicTable(spec, baseMaterials) {
  // Painted blue-grey angle-iron frame, dull worn steel top and grey weathered seat planks
  const materials = {
    ...baseMaterials,
    steelFrame: baseMaterials.picnicFrame ?? baseMaterials.steelFrame,
    stainlessSteel: baseMaterials.picnicTop ?? baseMaterials.stainlessSteel,
    darkWood: baseMaterials.benchWood ?? baseMaterials.darkWood
  };
  const group = new THREE.Group();
  const topSize = spec.topSize ?? 1.35;
  const height = spec.height ?? 0.75;

  const steelTopThick = 0.024;
  const plywoodThick = 0.018;
  const tube = 0.04;
  const seatY = 0.44;
  const benchLen = topSize - 0.12;
  const benchDepth = 0.28;
  const plankThick = 0.035;
  const benchDist = topSize * 0.5 + 0.32;

  // Stainless steel tabletop + rim
  const steelTop = makeBox(
    topSize,
    steelTopThick,
    topSize,
    materials.stainlessSteel
  );
  steelTop.position.y = height - steelTopThick * 0.5;
  group.add(steelTop);

  // Dark brown plywood underside visible from low angles
  const underside = makeBox(
    topSize - 0.012,
    plywoodThick,
    topSize - 0.012,
    new THREE.MeshStandardMaterial({ color: 0x8a3b2b, roughness: 0.7 })
  );
  underside.position.y = height - steelTopThick - plywoodThick * 0.5;
  group.add(underside);

  // Central cylindrical steel column + floor flange
  const underY = height - steelTopThick - plywoodThick;
  const centerPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, underY, 14),
    materials.steelFrame
  );
  centerPost.position.y = underY * 0.5;
  centerPost.castShadow = true;
  centerPost.receiveShadow = true;
  group.add(centerPost);

  const centerFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.012, 16),
    materials.steelFrame
  );
  centerFlange.position.y = 0.006;
  centerFlange.receiveShadow = true;
  group.add(centerFlange);

  // Under-table '+' cross frame
  const underCrossY = underY - tube * 0.5;
  const underArmSpan = topSize - 0.1;
  const underBarX = makeBox(underArmSpan, tube, tube, materials.steelFrame);
  underBarX.position.y = underCrossY;
  group.add(underBarX);

  const underBarZ = makeBox(tube, tube, underArmSpan, materials.steelFrame);
  underBarZ.position.y = underCrossY;
  group.add(underBarZ);

  // Floor '+' cross base spanning out to the 4 bench center posts
  const floorCrossSpan = benchDist * 2;
  const floorBarX = makeBox(floorCrossSpan, tube, tube, materials.steelFrame);
  floorBarX.position.y = tube * 0.5;
  group.add(floorBarX);

  const floorBarZ = makeBox(tube, tube, floorCrossSpan, materials.steelFrame);
  floorBarZ.position.y = tube * 0.5;
  group.add(floorBarZ);

  // Shared geometries for the 4 identical benches
  const seatGeo = new THREE.BoxGeometry(benchLen, plankThick, benchDepth);
  const centerLegH = seatY - plankThick;
  const centerLegGeo = new THREE.BoxGeometry(tube, centerLegH, tube);
  const plateGeo = new THREE.BoxGeometry(0.14, 0.01, 0.11);
  const outerLegGeo = new THREE.BoxGeometry(0.034, centerLegH, 0.034);
  const outerXOffset = benchLen * 0.5 - 0.14;

  // Build 4 benches rotated at 0, 90, 180, 270 deg around Y
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI) * 0.5;

    // Wood bench plank
    const seat = new THREE.Mesh(seatGeo, materials.darkWood);
    seat.position.set(0, seatY - plankThick * 0.5, benchDist);
    seat.castShadow = true;
    seat.receiveShadow = true;
    arm.add(seat);

    // Center bench vertical post + floor mounting plate
    const cLeg = new THREE.Mesh(centerLegGeo, materials.steelFrame);
    cLeg.position.set(0, centerLegH * 0.5, benchDist);
    cLeg.castShadow = true;
    cLeg.receiveShadow = true;
    arm.add(cLeg);

    const plate = new THREE.Mesh(plateGeo, materials.steelFrame);
    plate.position.set(0, 0.005, benchDist);
    plate.receiveShadow = true;
    arm.add(plate);

    // Two outer vertical legs + V-arms from center post
    for (const xSign of [-1, 1]) {
      const ox = xSign * outerXOffset;
      const oLeg = new THREE.Mesh(outerLegGeo, materials.steelFrame);
      oLeg.position.set(ox, centerLegH * 0.5, benchDist);
      oLeg.castShadow = true;
      oLeg.receiveShadow = true;
      arm.add(oLeg);

      arm.add(
        makeStrut(
          new THREE.Vector3(0, 0.12, benchDist),
          new THREE.Vector3(ox, seatY - plankThick - 0.02, benchDist),
          0.032,
          materials.steelFrame
        )
      );
    }

    // Main diagonal brace from bench center post up-inward to under-table cross arm
    arm.add(
      makeStrut(
        new THREE.Vector3(0, 0.22, benchDist - 0.02),
        new THREE.Vector3(0, underCrossY, topSize * 0.5 - 0.14),
        0.036,
        materials.steelFrame
      )
    );

    group.add(arm);
  }

  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.rotY ?? 0;
  return group;
}

/**
 * Builds the Wing B white counter / filing cabinet hugging the west side of Wing B.
 */
function createWingBWhiteCounter(spec, materials) {
  const group = new THREE.Group();
  group.name = "wing-b-white-counter";

  const widthX = spec.width ?? 0.55;
  const lengthZ = spec.length ?? 2.6;
  const height = spec.height ?? 0.85;
  const cx = spec.minX + widthX * 0.5;

  const body = makeBox(widthX, height - 0.03, lengthZ, materials.cabinetWhite);
  body.position.set(cx, (height - 0.03) * 0.5, spec.z);
  group.add(body);

  // Subtle recessed dark toe-kick
  const kick = makeBox(widthX - 0.04, 0.06, lengthZ - 0.04, materials.blackMullion);
  kick.position.set(cx, 0.03, spec.z);
  group.add(kick);

  // Top overhang counter surface
  const top = makeBox(widthX + 0.04, 0.03, lengthZ + 0.04, materials.whiteTableTop);
  top.position.set(cx, height - 0.015, spec.z);
  group.add(top);

  // Cabinet door seam lines on +X face
  const doorDoors = 4;
  const doorW = (lengthZ - 0.12) / doorDoors;
  for (let i = 0; i < doorDoors; i++) {
    const dz = spec.z - lengthZ * 0.5 + 0.06 + doorW * 0.5 + i * doorW;
    const panel = makeBox(0.015, height - 0.16, doorW - 0.03, materials.whitePlaster);
    panel.position.set(cx + widthX * 0.5 + 0.005, height * 0.5 + 0.02, dz);
    group.add(panel);

    const handle = makeBox(0.02, 0.11, 0.018, materials.stainlessSteel);
    handle.position.set(
      cx + widthX * 0.5 + 0.018,
      height * 0.62,
      dz + (i % 2 === 0 ? doorW * 0.3 : -doorW * 0.3)
    );
    group.add(handle);
  }

  return group;
}

/**
 * Builds the glass-walled office interior worktable, red office chairs, and back filing cabinet.
 */
function createOfficeInteriorFurniture(spec, officeSpec, materials) {
  const group = new THREE.Group();
  group.name = "office-interior-furniture";

  const height = 0.75;
  const topThick = 0.04;

  // Main office desk/table
  const deskTop = makeBox(spec.w, topThick, spec.d, materials.whiteTableTop);
  deskTop.position.set(spec.x, height - topThick * 0.5, spec.z);
  group.add(deskTop);

  const legGeo = new THREE.BoxGeometry(0.05, height - topThick, 0.05);
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, materials.steelFrame);
      leg.position.set(
        spec.x + xSign * (spec.w * 0.5 - 0.08),
        (height - topThick) * 0.5,
        spec.z + zSign * (spec.d * 0.5 - 0.08)
      );
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
  }

  // Red upholstered office chairs visible through the glass walls
  const chairRedMat = new THREE.MeshStandardMaterial({
    color: 0xb92b27,
    roughness: 0.65,
    metalness: 0.05
  });

  const chairOffsets = [
    { dx: -0.65, dz: -spec.d * 0.5 - 0.35, rotY: 0 },
    { dx: 0.65, dz: -spec.d * 0.5 - 0.35, rotY: 0 },
    { dx: -0.65, dz: spec.d * 0.5 + 0.35, rotY: Math.PI },
    { dx: 0.65, dz: spec.d * 0.5 + 0.35, rotY: Math.PI }
  ];

  for (const c of chairOffsets) {
    const chair = new THREE.Group();
    const seat = makeBox(0.46, 0.055, 0.44, chairRedMat);
    seat.position.y = 0.46;
    chair.add(seat);

    const back = makeBox(0.44, 0.42, 0.05, chairRedMat);
    back.position.set(0, 0.72, -0.2);
    chair.add(back);

    const spine = makeBox(0.05, 0.28, 0.04, materials.blackMullion);
    spine.position.set(0, 0.56, -0.22);
    chair.add(spine);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.38, 10),
      materials.stainlessSteel
    );
    stem.position.y = 0.25;
    stem.castShadow = true;
    chair.add(stem);

    for (let k = 0; k < 5; k++) {
      const legArm = makeBox(0.035, 0.03, 0.26, materials.blackMullion);
      legArm.rotation.y = (k * Math.PI * 2) / 5;
      legArm.position.set(
        Math.sin(legArm.rotation.y) * 0.12,
        0.045,
        Math.cos(legArm.rotation.y) * 0.12
      );
      chair.add(legArm);
    }

    chair.position.set(spec.x + c.dx, 0, spec.z + c.dz);
    chair.rotation.y = c.rotY;
    group.add(chair);
  }

  // White filing cabinets along the north wall of the office room
  if (officeSpec) {
    const cabW = 0.9;
    const cabH = 1.85;
    const cabD = 0.45;
    const cabZ = officeSpec.minZ + cabD * 0.5 + 0.08;
    for (const cx of [officeSpec.minX + 1.2, officeSpec.minX + 2.25]) {
      const cab = makeBox(cabW, cabH, cabD, materials.cabinetWhite);
      cab.position.set(cx, cabH * 0.5, cabZ);
      group.add(cab);

      for (let shelf = 0; shelf < 2; shelf++) {
        const door = makeBox(cabW * 0.45, cabH * 0.44, 0.015, materials.whitePlaster);
        door.position.set(
          cx + (shelf === 0 ? -cabW * 0.23 : cabW * 0.23),
          cabH * 0.52,
          cabZ + cabD * 0.5 + 0.006
        );
        group.add(door);
      }
    }
  }

  return group;
}

/**
 * Creates all furniture groups for the communal hall and steel pavilion.
 * @param {object} layoutSpec - Master spatial layout specification (LAYOUT_SPEC)
 * @param {object} materials - Shared material library from createMaterials()
 * @returns {THREE.Group}
 */
export function createFurniture(layoutSpec, materials) {
  const root = new THREE.Group();
  root.name = "furniture";

  const { furniture, officeRoom } = layoutSpec;

  if (furniture.redDividerWall) {
    root.add(createRedDividerWall(furniture.redDividerWall, materials));
  }

  const canteenGroup = new THREE.Group();
  canteenGroup.name = "canteen-bench-tables";
  for (const spec of furniture.canteenBenchTables ?? []) {
    canteenGroup.add(createCanteenBenchTable(spec, materials));
  }
  root.add(canteenGroup);

  const lesehanGroup = new THREE.Group();
  lesehanGroup.name = "lesehan-tables";
  for (const spec of furniture.lesehanTables ?? []) {
    lesehanGroup.add(createLesehanTable(spec, materials));
  }
  root.add(lesehanGroup);

  const steelGroup = new THREE.Group();
  steelGroup.name = "steel-picnic-tables";
  for (const spec of furniture.steelPicnicTables ?? []) {
    steelGroup.add(createSteelPicnicTable(spec, materials));
  }
  root.add(steelGroup);

  if (furniture.wingBWhiteCounter) {
    root.add(createWingBWhiteCounter(furniture.wingBWhiteCounter, materials));
  }

  if (furniture.officeInteriorTable) {
    root.add(
      createOfficeInteriorFurniture(
        furniture.officeInteriorTable,
        officeRoom,
        materials
      )
    );
  }

  return root;
}
