import * as THREE from "three";
import { box, cyl, rod, flatMat } from "./geomUtils.js";
import { createRng } from "./noise.js";
import { registerAnimator, markDynamic } from "./animation.js";

/**
 * The people who actually use the hall, and the stuff they bring with them.
 *
 * Figures are deliberately simple and faceless (capsule limbs on a small joint hierarchy),
 * but they are posed from real joint angles: cross-legged at the low lesehan tables, on the
 * canteen benches, serving behind the counters, leaning on the mezzanine rail, and a few
 * walking loops through the aisles. Seated and standing figures are static and get batched
 * with the rest of the scene; only the walkers stay live.
 */

const SKIN = [0xc68e63, 0xb57c52, 0xd3a074, 0xa9714a, 0xc99a6e];
const HAIR = [0x16110e, 0x1f1712, 0x0f0d0c, 0x2a1d14];
const SHIRTS = [0x2f5d9e, 0x9c2f2f, 0xe7e4dc, 0x2f7d5a, 0x3a3f47, 0xd9a23a, 0x6c4a8f, 0x1f2a44, 0xc96a3a, 0x7fa7c9, 0x8a8f96, 0x24344f];
const PANTS = [0x23283a, 0x2d3d5c, 0x1c1c1f, 0x6b5a45, 0x3b4252, 0x4a4f57];
const HIJABS = [0x2a3a5c, 0x8a3a4a, 0xd8c7b0, 0x3d6a5a, 0x1f1f24, 0xb9a0c9, 0x7a8a9c, 0xc9a25a];

function limb(len, radius, material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 3, 8), material);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ball(radius, material, sx = 1, sy = 1, sz = 1, w = 12, h = 9) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, w, h), material);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds one figure standing at the origin facing +Z.
 * Returns the root group and its joints so a pose (or an animator) can drive it.
 */
function createFigure({
  height = 1.64,
  skin = SKIN[0],
  hair = HAIR[0],
  shirt = SHIRTS[0],
  pants = PANTS[0],
  shoes = 0x1d1d20,
  hijab = null,
  longSleeve = false,
  skirt = false,
  barefoot = false,
  apron = null,
  ponytail = false
} = {}) {
  const s = height / 1.64;
  const skinM = flatMat(skin, { roughness: 0.75 });
  const shirtM = flatMat(shirt, { roughness: 0.85 });
  const pantsM = flatMat(pants, { roughness: 0.85 });
  const shoeM = flatMat(shoes, { roughness: 0.6 });
  const hairM = flatMat(hair, { roughness: 0.8 });
  const sleeveLowerM = longSleeve || hijab !== null ? shirtM : skinM;

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(s);
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  body.add(hips);
  const pelvis = ball(0.12, pantsM, 1.38, 0.86, 0.98);
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.04;
  hips.add(spine);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.132, 0.44, 12), shirtM);
  torso.scale.z = 0.64;
  torso.position.y = 0.24;
  torso.castShadow = true;
  torso.receiveShadow = true;
  spine.add(torso);
  const shoulders = ball(0.1, shirtM, 1.9, 0.62, 1.02);
  shoulders.position.y = 0.455;
  spine.add(shoulders);
  const belly = ball(0.1, shirtM, 1.36, 0.6, 0.86);
  belly.position.y = 0.03;
  spine.add(belly);

  if (apron !== null) {
    const apronM = flatMat(apron, { roughness: 0.9 });
    const bib = box(0.25, 0.4, 0.012, apronM, 0, 0.2, 0.105, { cast: false });
    spine.add(bib);
  }

  const neck = cyl(0.044, 0.05, 0.09, skinM, 0, 0.535, 0, 8);
  spine.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.655;
  spine.add(head);
  const skull = ball(0.104, skinM, 0.93, 1.06, 1.0, 14, 11);
  head.add(skull);

  if (hijab !== null) {
    const hijabM = flatMat(hijab, { roughness: 0.9 });
    const wrap = ball(0.118, hijabM, 0.97, 1.06, 1.03, 14, 11);
    wrap.position.set(0, 0.006, -0.012);
    head.add(wrap);
    // Face opening: the skin-toned oval the wrap frames
    const face = ball(0.082, skinM, 0.86, 1.04, 0.42, 12, 9);
    face.position.set(0, -0.012, 0.086);
    face.castShadow = false;
    head.add(face);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.215, 0.27, 12), hijabM);
    drape.scale.z = 0.74;
    drape.position.y = 0.47;
    drape.castShadow = true;
    spine.add(drape);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.111, 14, 9, 0, Math.PI * 2, 0, 1.72), hairM);
    cap.scale.set(0.95, 1.04, 1.03);
    cap.rotation.x = -0.38;
    cap.position.y = 0.012;
    cap.castShadow = true;
    head.add(cap);
    if (ponytail) {
      const tail = ball(0.05, hairM, 0.8, 1.9, 0.8, 8, 6);
      tail.position.set(0, -0.06, -0.11);
      head.add(tail);
    }
  }

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.19, 0.45, 0);
    spine.add(shoulder);
    shoulder.add(limb(0.27, 0.043, shirtM));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    elbow.add(limb(0.24, 0.036, sleeveLowerM));
    const hand = ball(0.042, skinM, 0.85, 1.15, 0.6, 8, 6);
    hand.position.y = -0.275;
    elbow.add(hand);
    return { shoulder, elbow, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);

  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.088, -0.02, 0);
    hips.add(hip);
    hip.add(limb(0.42, skirt ? 0.082 : 0.07, pantsM));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    knee.add(limb(0.38, skirt ? 0.066 : 0.052, pantsM));
    const foot = box(0.085, 0.055, 0.23, barefoot ? skinM : shoeM, 0, -0.415, 0.06);
    knee.add(foot);
    return { hip, knee, foot };
  };
  const legL = leg(1);
  const legR = leg(-1);

  if (skirt) {
    const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 12), pantsM);
    skirtMesh.scale.z = 0.8;
    skirtMesh.position.y = -0.27;
    skirtMesh.castShadow = true;
    skirtMesh.userData.skirt = true;
    hips.add(skirtMesh);
    root.userData.skirtMesh = skirtMesh;
  }

  return { root, body, hips, spine, head, armL, armR, legL, legR, scale: s };
}

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

function dropSkirt(f) {
  const skirt = f.root.userData.skirtMesh;
  if (skirt) skirt.removeFromParent();
}

function poseStand(f, { armsDown = true, lean = 0 } = {}) {
  f.spine.rotation.x = lean;
  if (armsDown) {
    f.armL.shoulder.rotation.set(0.05, 0, 0.09);
    f.armR.shoulder.rotation.set(-0.04, 0, -0.09);
    f.armL.elbow.rotation.x = -0.15;
    f.armR.elbow.rotation.x = -0.2;
  }
}

/** Cross-legged on the floor (sila), as everyone sits at the lesehan tables. */
function poseCross(f, { lean = 0.22, arms = "type", headTilt = 0.18 } = {}) {
  dropSkirt(f);
  f.hips.position.y = 0.105;
  f.spine.rotation.x = lean;
  f.head.rotation.x = headTilt;
  f.legL.hip.rotation.set(-Math.PI / 2 + 0.06, 0, 0.88);
  f.legL.knee.rotation.set(0, 0, -2.25);
  f.legR.hip.rotation.set(-Math.PI / 2 + 0.16, 0, -0.88);
  f.legR.knee.rotation.set(0, 0, 2.25);
  applyArms(f, arms);
}

/** Sitting on the floor with the knees drawn up. */
function poseKneesUp(f, { lean = -0.12, arms = "knees" } = {}) {
  dropSkirt(f);
  f.hips.position.y = 0.125;
  f.spine.rotation.x = lean;
  f.legL.hip.rotation.set(-(Math.PI / 2 + 0.72), 0, 0.14);
  f.legL.knee.rotation.x = 2.05;
  f.legR.hip.rotation.set(-(Math.PI / 2 + 0.66), 0, -0.14);
  f.legR.knee.rotation.x = 1.95;
  applyArms(f, arms);
}

/** On a bench or chair with the seat top at `seatY` (world metres). */
function poseBench(f, seatY, { lean = 0.14, arms = "table", headTilt = 0.1 } = {}) {
  dropSkirt(f);
  f.hips.position.y = seatY / f.scale + 0.082;
  f.spine.rotation.x = lean;
  f.head.rotation.x = headTilt;
  f.legL.hip.rotation.set(-Math.PI / 2 + 0.04, 0, 0.1);
  f.legR.hip.rotation.set(-Math.PI / 2 + 0.04, 0, -0.1);
  f.legL.knee.rotation.x = Math.PI / 2 - 0.12;
  f.legR.knee.rotation.x = Math.PI / 2 + 0.1;
  applyArms(f, arms);
}

function applyArms(f, mode) {
  const { armL, armR } = f;
  switch (mode) {
    case "type": // both hands out on a keyboard
      armL.shoulder.rotation.set(-0.72, 0, -0.08);
      armR.shoulder.rotation.set(-0.72, 0, 0.08);
      armL.elbow.rotation.x = -0.82;
      armR.elbow.rotation.x = -0.82;
      break;
    case "table": // forearms resting on a table edge
      armL.shoulder.rotation.set(-0.5, 0, 0.1);
      armR.shoulder.rotation.set(-0.42, 0, -0.1);
      armL.elbow.rotation.x = -1.15;
      armR.elbow.rotation.x = -1.2;
      break;
    case "eat": // one hand to the plate, the other lifting a spoon
      armL.shoulder.rotation.set(-0.5, 0, 0.1);
      armL.elbow.rotation.x = -1.1;
      armR.shoulder.rotation.set(-0.85, 0, -0.18);
      armR.elbow.rotation.x = -1.75;
      break;
    case "phone": // phone held up in one hand
      armL.shoulder.rotation.set(-0.35, 0, 0.12);
      armL.elbow.rotation.x = -0.6;
      armR.shoulder.rotation.set(-0.62, 0, 0.1);
      armR.elbow.rotation.set(-1.75, 0, 0.25);
      break;
    case "book": // both hands holding a book in the lap
      armL.shoulder.rotation.set(-0.42, 0, -0.14);
      armR.shoulder.rotation.set(-0.42, 0, 0.14);
      armL.elbow.rotation.x = -1.3;
      armR.elbow.rotation.x = -1.3;
      break;
    case "knees": // arms wrapped loosely round the knees
      armL.shoulder.rotation.set(-1.0, 0, -0.18);
      armR.shoulder.rotation.set(-1.0, 0, 0.18);
      armL.elbow.rotation.x = -0.5;
      armR.elbow.rotation.x = -0.5;
      break;
    case "nap": // arms folded on the table as a pillow
      armL.shoulder.rotation.set(-1.25, 0, -0.5);
      armR.shoulder.rotation.set(-1.25, 0, 0.5);
      armL.elbow.rotation.set(-0.5, 0, -1.0);
      armR.elbow.rotation.set(-0.5, 0, 1.0);
      break;
    case "rail": // elbows on a railing
      armL.shoulder.rotation.set(-0.95, 0, 0.12);
      armR.shoulder.rotation.set(-0.95, 0, -0.12);
      armL.elbow.rotation.x = -1.1;
      armR.elbow.rotation.x = -1.1;
      break;
    case "serve": // working at counter height
      armL.shoulder.rotation.set(-0.55, 0, 0.1);
      armR.shoulder.rotation.set(-0.7, 0, -0.12);
      armL.elbow.rotation.x = -1.0;
      armR.elbow.rotation.x = -0.75;
      break;
    case "hips":
      armL.shoulder.rotation.set(0.2, 0, 0.5);
      armR.shoulder.rotation.set(0.2, 0, -0.5);
      armL.elbow.rotation.set(-0.3, 0, -1.2);
      armR.elbow.rotation.set(-0.3, 0, 1.2);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Belongings                                                          */
/* ------------------------------------------------------------------ */

function screenTexture(materials, kind) {
  return materials.createCanvasTexture(256, 160, (ctx, w, h) => {
    const rng = createRng(kind === "code" ? 7 : kind === "slides" ? 13 : 21);
    if (kind === "code") {
      ctx.fillStyle = "#1e222a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#15181d";
      ctx.fillRect(0, 0, 44, h);
      const cols = ["#7fb4f0", "#e0a15e", "#9ad17a", "#d98ac9", "#c9ced6"];
      for (let y = 12; y < h - 8; y += 9) {
        let x = 52 + Math.floor(rng() * 3) * 12;
        const parts = 1 + Math.floor(rng() * 4);
        for (let p = 0; p < parts; p++) {
          const len = 10 + rng() * 44;
          ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
          ctx.fillRect(x, y, len, 3.5);
          x += len + 5;
        }
      }
    } else if (kind === "slides") {
      ctx.fillStyle = "#dfe3e8";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(56, 22, 180, 116);
      ctx.fillStyle = "#12365f";
      ctx.fillRect(56, 22, 180, 26);
      ctx.fillStyle = "#f5c518";
      ctx.fillRect(70, 66, 60, 54);
      ctx.fillStyle = "#6b7280";
      for (let y = 68; y < 122; y += 10) ctx.fillRect(140, y, 60 + rng() * 26, 4);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(8, 22 + i * 30, 40, 24);
      }
    } else {
      ctx.fillStyle = "#c9cdd3";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2b579a";
      ctx.fillRect(0, 0, w, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(48, 24, 160, h - 24);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(64, 36, 90, 6);
      ctx.fillStyle = "#4b5563";
      for (let y = 52; y < h - 4; y += 7) ctx.fillRect(64, y, 90 + rng() * 38, 2.5);
    }
  });
}

function makeLaptop(P, screenMat, shell = P.laptopSilver) {
  const g = new THREE.Group();
  g.add(box(0.33, 0.016, 0.225, shell, 0, 0.008, 0));
  g.add(box(0.28, 0.002, 0.11, P.laptopKeys, 0, 0.0172, -0.035, { cast: false }));
  g.add(box(0.1, 0.002, 0.06, P.laptopPad, 0, 0.0172, 0.07, { cast: false }));
  const lid = new THREE.Group();
  lid.position.set(0, 0.016, -0.112);
  lid.rotation.x = -0.3;
  lid.add(box(0.33, 0.215, 0.008, shell, 0, 0.1075, 0));
  lid.add(box(0.3, 0.185, 0.002, screenMat, 0, 0.11, 0.0052, { cast: false }));
  g.add(lid);
  return g;
}

function makeBackpack(colour, P) {
  const g = new THREE.Group();
  const m = flatMat(colour, { roughness: 0.9 });
  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.2, 3, 10), m);
  bodyMesh.scale.set(1.0, 1.0, 0.62);
  bodyMesh.position.y = 0.25;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);
  g.add(box(0.22, 0.16, 0.05, m, 0, 0.17, 0.1));
  g.add(box(0.2, 0.012, 0.012, P.zip, 0, 0.26, 0.127, { cast: false }));
  g.add(box(0.24, 0.012, 0.012, P.zip, 0, 0.4, 0.085, { cast: false }));
  for (const s of [-1, 1]) g.add(rod([s * 0.08, 0.42, -0.09], [s * 0.09, 0.1, -0.1], 0.016, P.strap, { radial: 5 }));
  g.add(rod([-0.03, 0.47, -0.02], [0.03, 0.47, -0.02], 0.01, P.strap, { radial: 5 }));
  return g;
}

function makeSandals(P, colour, spread = 0.05) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const sole = box(0.09, 0.018, 0.25, colour, s * (0.06 + spread * 0.3), 0.009, s * spread * 0.4, { cast: false });
    sole.rotation.y = s * 0.12;
    g.add(sole);
    const strapMesh = box(0.095, 0.012, 0.03, P.strap, s * (0.06 + spread * 0.3), 0.03, 0.05 + s * spread * 0.4, { cast: false });
    strapMesh.rotation.y = s * 0.12;
    g.add(strapMesh);
  }
  return g;
}

function makeTumbler(colour) {
  const g = new THREE.Group();
  g.add(cyl(0.036, 0.03, 0.19, flatMat(colour, { roughness: 0.3, metalness: 0.4 }), 0, 0.095, 0, 12));
  g.add(cyl(0.037, 0.037, 0.025, flatMat(0x1d1f22, { roughness: 0.5 }), 0, 0.2, 0, 12));
  return g;
}

/* ------------------------------------------------------------------ */
/* Scene population                                                    */
/* ------------------------------------------------------------------ */

export function createPeople(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "People";
  const glow = materials.registerNightGlow || ((m) => m);
  const rng = createRng(31337);
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const P = {
    laptopSilver: flatMat(0xb9bdc2, { roughness: 0.35, metalness: 0.7 }),
    laptopBlack: flatMat(0x1c1d20, { roughness: 0.5, metalness: 0.2 }),
    laptopKeys: flatMat(0x26282c, { roughness: 0.7 }),
    laptopPad: flatMat(0x9da2a8, { roughness: 0.4, metalness: 0.5 }),
    zip: flatMat(0x111214, { roughness: 0.6 }),
    strap: flatMat(0x18191c, { roughness: 0.85 }),
    paper: flatMat(0xf6f5ef, { roughness: 0.85 }),
    bookBlue: flatMat(0x27508f, { roughness: 0.7 }),
    bookRed: flatMat(0x8f2a2a, { roughness: 0.7 }),
    bookGreen: flatMat(0x2a6f4a, { roughness: 0.7 }),
    phone: flatMat(0x101114, { roughness: 0.25, metalness: 0.3 }),
    phoneScreen: glow(new THREE.MeshStandardMaterial({ color: 0x20262e, emissive: 0xbcd4f2, emissiveIntensity: 0.7, roughness: 0.2 }), 0.6, 1.6),
    plate: flatMat(0xf5f3ec, { roughness: 0.25 }),
    rice: flatMat(0xf4f1e4, { roughness: 0.95 }),
    lauk: flatMat(0xb5651d, { roughness: 0.8 }),
    greens: flatMat(0x4f8a35, { roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdff1f5, roughness: 0.05, transparent: true, opacity: 0.38, envMapIntensity: 2 }),
    tea: flatMat(0xa85f1c, { roughness: 0.2 }),
    spoon: flatMat(0xc9cdd1, { roughness: 0.3, metalness: 0.9 }),
    cable: flatMat(0xe9e9e6, { roughness: 0.6 }),
    cableBlack: flatMat(0x18191b, { roughness: 0.6 }),
    brick: flatMat(0xeeeeea, { roughness: 0.5 }),
    sandalBlack: flatMat(0x1b1b1e, { roughness: 0.8 }),
    sandalBlue: flatMat(0x23467f, { roughness: 0.8 }),
    sandalBrown: flatMat(0x6a4a30, { roughness: 0.8 }),
    sandalGreen: flatMat(0x2f6f4a, { roughness: 0.8 }),
    sneakerWhite: flatMat(0xe6e6e2, { roughness: 0.7 }),
    pencil: flatMat(0xe0b020, { roughness: 0.6 }),
    blob: new THREE.MeshBasicMaterial({
      map: materials.createCanvasTexture(
        64,
        64,
        (ctx, w, h) => {
          const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
          g.addColorStop(0, "rgba(0,0,0,0.5)");
          g.addColorStop(0.55, "rgba(0,0,0,0.22)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        },
        { transparent: true }
      ),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    })
  };
  const screens = ["doc", "code", "slides"].map((kind) => {
    const tex = screenTexture(materials, kind);
    return glow(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.25 }), 0.7, 1.5);
  });

  const student = (extra = {}) => {
    const female = extra.hijab !== undefined ? extra.hijab !== null : rng() < 0.45;
    const opts = {
      height: 1.56 + rng() * 0.16,
      skin: pick(SKIN),
      hair: pick(HAIR),
      shirt: pick(SHIRTS),
      pants: pick(PANTS),
      hijab: female ? pick(HIJABS) : null,
      longSleeve: rng() < 0.4,
      skirt: female && rng() < 0.5,
      ...extra
    };
    if (extra.hijab === undefined && !female) opts.hijab = null;
    return createFigure(opts);
  };

  const place = (f, x, y, z, facing) => {
    f.root.position.set(x, y, z);
    f.root.rotation.y = facing;
    group.add(f.root);
    return f;
  };

  // Local-to-world helper for things laid out relative to a seated person or a table
  const putRel = (obj, ox, oz, facing, dx, dy, dz, rotY = 0) => {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    obj.position.set(ox + dx * c + dz * s, dy, oz - dx * s + dz * c);
    obj.rotation.y = facing + rotY;
    group.add(obj);
    return obj;
  };

  const tables = layoutSpec.furniture.lesehanTables;
  const TABLE_H = 0.34;
  const SOUTH = 0;
  const NORTH = Math.PI;
  const EAST = Math.PI / 2;
  const WEST = -Math.PI / 2;

  /** Seats someone cross-legged at a lesehan table on the given side. */
  const seatAtTable = (ti, side, along, pose = {}, figOpts = {}) => {
    const t = tables[ti];
    const f = student({ barefoot: true, ...figOpts });
    const reach = 0.37;
    let x = t.x;
    let z = t.z;
    let facing = NORTH;
    if (side === "S") {
      z += t.d / 2 + reach;
      x += along;
      facing = NORTH;
    } else if (side === "N") {
      z -= t.d / 2 + reach;
      x += along;
      facing = SOUTH;
    } else if (side === "E") {
      x += t.w / 2 + reach;
      z += along;
      facing = WEST;
    } else {
      x -= t.w / 2 + reach;
      z += along;
      facing = EAST;
    }
    if (pose.kneesUp) poseKneesUp(f, pose);
    else poseCross(f, pose);
    place(f, x, 0, z, facing);
    return { f, x, z, facing, t };
  };

  const addLaptopFor = (seat, screenIdx, shell) => {
    const lap = makeLaptop(P, screens[screenIdx % screens.length], shell);
    putRel(lap, seat.x, seat.z, seat.facing, 0, TABLE_H + 0.002, 0.56, Math.PI + (rng() - 0.5) * 0.12);
    return lap;
  };

  const addBag = (seat, dx, dz, colour) => {
    const bag = makeBackpack(colour, P);
    putRel(bag, seat.x, seat.z, seat.facing, dx, 0, dz, rng() * 6.28);
    if (rng() < 0.4) {
      bag.rotation.x = Math.PI / 2 - 0.2; // flopped over on its back
      bag.position.y = 0.1;
    }
  };

  const addBook = (x, y, z, rotY, mat = P.bookBlue, open = false) => {
    if (open) {
      const b = new THREE.Group();
      const l = box(0.16, 0.012, 0.23, P.paper, -0.082, 0.006, 0, { cast: false });
      l.rotation.z = 0.06;
      const r = box(0.16, 0.012, 0.23, P.paper, 0.082, 0.006, 0, { cast: false });
      r.rotation.z = -0.06;
      b.add(l, r, box(0.34, 0.004, 0.24, mat, 0, 0.001, 0, { cast: false }));
      b.position.set(x, y, z);
      b.rotation.y = rotY;
      group.add(b);
      return b;
    }
    const b = box(0.17, 0.03, 0.24, mat, x, y + 0.015, z);
    b.rotation.y = rotY;
    group.add(b);
    return b;
  };

  const addPhoneInHand = (f) => {
    const phone = new THREE.Group();
    phone.add(box(0.07, 0.145, 0.009, P.phone, 0, 0, 0, { cast: false }));
    phone.add(box(0.062, 0.132, 0.002, P.phoneScreen, 0, 0, 0.0056, { cast: false }));
    phone.position.set(0, -0.3, 0.035);
    phone.rotation.set(-1.2, 0, 0);
    f.armR.elbow.add(phone);
  };

  /* ---------- Lesehan hall ---------- */

  // Table 1: one student typing (the existing laptop + tumbler on this table are theirs)
  let seat = seatAtTable(1, "S", -0.18, { arms: "type" }, { hijab: null, shirt: 0x2f5d9e });
  addBag(seat, 0.55, -0.1, 0x30353d);

  // Table 3: a pair - one on the laptop, one opposite reading with knees up against the red wall
  seat = seatAtTable(3, "S", -0.18, { arms: "type", lean: 0.28 }, { hijab: 0x8a3a4a, shirt: 0xe7e4dc, skirt: true, pants: 0x23283a });
  addBag(seat, -0.6, 0.05, 0x7a2f3a);
  seat = seatAtTable(3, "N", 0.32, { kneesUp: true, arms: "book", lean: -0.2 }, { hijab: null, shirt: 0x3a3f47 });
  addBook(seat.x, 0.36, seat.z + 0.33, 0.1, P.bookRed, true).rotation.x = -0.9;

  // Table 0: working with her own laptop, back to the wall, charger run to the wall socket
  seat = seatAtTable(0, "N", 0.1, { arms: "type" }, { hijab: 0x2a3a5c, shirt: 0xd9a23a, skirt: false });
  addLaptopFor(seat, 1, P.laptopBlack);
  addBag(seat, 0.62, 0.0, 0x24344f);
  putRel(makeTumbler(0xd4d7da), seat.x, seat.z, seat.facing, -0.45, TABLE_H, 0.5);
  addBook(seat.t.x + 0.45, TABLE_H, seat.t.z + 0.15, 0.3, P.bookGreen);
  addBook(seat.t.x + 0.47, TABLE_H + 0.03, seat.t.z + 0.16, 0.12, P.bookBlue);

  // Table 5: study group of three with books, a laptop and papers everywhere
  seat = seatAtTable(5, "S", 0.3, { arms: "type" }, { hijab: null, shirt: 0x9c2f2f });
  addLaptopFor(seat, 2);
  addBag(seat, 0.7, 0.2, 0x2f4f3a);
  seat = seatAtTable(5, "N", -0.25, { arms: "book", lean: 0.3, headTilt: 0.3 }, { hijab: 0xd8c7b0, shirt: 0x6c4a8f, skirt: true, pants: 0x3b4252 });
  addBook(seat.t.x - 0.25, TABLE_H, seat.t.z - 0.2, 0.05, P.bookBlue, true);
  seat = seatAtTable(5, "W", 0.05, { arms: "table", lean: 0.2 }, { hijab: null, shirt: 0x2f7d5a });
  addBag(seat, 0.1, 0.5, 0x1f1f24);
  for (let i = 0; i < 6; i++) {
    const p = box(0.21, 0.002, 0.297, P.paper, tables[5].x + (rng() - 0.5) * 0.9, TABLE_H + 0.002 + i * 0.0015, tables[5].z + (rng() - 0.5) * 0.45, { cast: false });
    p.rotation.y = (rng() - 0.5) * 1.2;
    group.add(p);
  }
  group.add(rod([tables[5].x + 0.1, TABLE_H + 0.006, tables[5].z + 0.1], [tables[5].x + 0.24, TABLE_H + 0.006, tables[5].z + 0.14], 0.004, P.pencil, { radial: 5 }));

  // Table 7: two friends chatting, one scrolling a phone
  seat = seatAtTable(7, "S", -0.35, { arms: "phone", lean: 0.12, headTilt: 0.28 }, { hijab: null, shirt: 0xc96a3a });
  addPhoneInHand(seat.f);
  seat = seatAtTable(7, "E", 0.0, { arms: "table", lean: 0.16, headTilt: 0.0 }, { hijab: 0x3d6a5a, shirt: 0x7fa7c9, skirt: true, pants: 0x1c1c1f });
  addBag(seat, -0.1, -0.55, 0x8a3a4a);

  // Table 9: asleep on folded arms next to a closed laptop
  seat = seatAtTable(9, "S", 0.0, { arms: "nap", lean: 1.02, headTilt: 0.35 }, { hijab: null, shirt: 0x1f2a44 });
  seat.f.head.rotation.z = 0.5;
  const closed = box(0.33, 0.022, 0.225, P.laptopSilver, tables[9].x + 0.45, TABLE_H + 0.011, tables[9].z - 0.12);
  closed.rotation.y = 0.2;
  group.add(closed);
  addBag(seat, 0.6, 0.1, 0x3a3f47);

  // Table 4: "reserved" with someone's things while they queue for food
  {
    const t = tables[4];
    const lap = makeLaptop(P, screens[0]);
    lap.position.set(t.x - 0.1, TABLE_H + 0.002, t.z + 0.1);
    lap.rotation.y = Math.PI + 0.1;
    group.add(lap);
    const tum = makeTumbler(0x7a2f3a);
    tum.position.set(t.x + 0.4, TABLE_H, t.z + 0.2);
    group.add(tum);
    const bag = makeBackpack(0x2a3a5c, P);
    bag.position.set(t.x - 0.2, 0, t.z + 0.85);
    bag.rotation.y = 2.6;
    group.add(bag);
    addBook(t.x + 0.3, TABLE_H, t.z - 0.2, 0.4, P.bookRed);
  }

  // Charger cables from the wall-side tables to the socket strips on the red wall
  const rw = layoutSpec.furniture.redDividerWall.mainSegment;
  const faceZ = rw.z + rw.thickness / 2 + 0.03;
  for (const [ti, sx, black] of [
    [0, -10.2, false],
    [1, -6.9, true],
    [3, -0.3, false]
  ]) {
    const t = tables[ti];
    const pts = [
      new THREE.Vector3(t.x - 0.2, TABLE_H + 0.015, t.z - 0.2),
      new THREE.Vector3(t.x - 0.26, TABLE_H + 0.01, t.z - 0.47),
      new THREE.Vector3(t.x - 0.3, 0.02, t.z - 0.62),
      new THREE.Vector3((t.x + sx) / 2 - 0.1, 0.008, t.z - 0.85),
      new THREE.Vector3(sx + 0.12, 0.008, faceZ + 0.2),
      new THREE.Vector3(sx + 0.04, 0.3, faceZ + 0.02),
      new THREE.Vector3(sx, 0.46, faceZ)
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0045, 5, false), black ? P.cableBlack : P.cable);
    cable.receiveShadow = true;
    group.add(cable);
    group.add(box(0.05, 0.03, 0.09, black ? P.cableBlack : P.brick, (t.x + sx) / 2 - 0.1, 0.015, t.z - 0.85, { cast: false }));
    group.add(box(0.035, 0.04, 0.03, black ? P.cableBlack : P.brick, sx, 0.48, faceZ + 0.008, { cast: false }));
  }

  // Sandals and shoes left at the edge of the study area (and beside each occupied table)
  const sandalMats = [P.sandalBlack, P.sandalBlue, P.sandalBrown, P.sandalGreen, P.sneakerWhite, P.sandalBlack];
  const dropSandals = (x, z, n, spreadX, spreadZ) => {
    for (let i = 0; i < n; i++) {
      const pair = makeSandals(P, pick(sandalMats), rng() * 0.12);
      pair.position.set(x + (rng() - 0.5) * spreadX, 0.002, z + (rng() - 0.5) * spreadZ);
      pair.rotation.y = Math.PI + (rng() - 0.5) * 1.2;
      group.add(pair);
    }
  };
  dropSandals(-11.6, 7.0, 6, 1.6, 0.5);
  dropSandals(-4.2, 7.05, 4, 2.4, 0.4);
  dropSandals(4.6, 7.0, 3, 1.6, 0.4);
  dropSandals(-6.4, 3.75, 1, 0.3, 0.2);
  dropSandals(0.4, 3.8, 1, 0.3, 0.2);
  dropSandals(-9.2, 6.8, 2, 0.8, 0.2);

  /* ---------- Canteen benches ---------- */
  const benchSeatY = 0.44;
  const bt = layoutSpec.furniture.canteenBenchTables;
  const benchZ = bt[1].width / 2 + 0.24;

  const meal = (x, z, eaten = false) => {
    const y = bt[1].height;
    group.add(cyl(0.12, 0.08, 0.014, P.plate, x, y + 0.008, z, 18));
    if (!eaten) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), P.rice);
      mound.scale.y = 0.7;
      mound.position.set(x - 0.02, y + 0.014, z);
      group.add(mound);
      group.add(box(0.07, 0.025, 0.05, P.lauk, x + 0.05, y + 0.028, z + 0.02, { cast: false }));
      group.add(box(0.05, 0.015, 0.05, P.greens, x + 0.04, y + 0.022, z - 0.04, { cast: false }));
    }
    group.add(cyl(0.034, 0.028, 0.12, P.glass, x + 0.2, y + 0.06, z - 0.08, 10, { cast: false }));
    group.add(cyl(0.03, 0.025, 0.08, P.tea, x + 0.2, y + 0.045, z - 0.08, 10, { cast: false }));
    group.add(rod([x - 0.1, y + 0.02, z + 0.06], [x - 0.02, y + 0.028, z + 0.02], 0.004, P.spoon, { radial: 4 }));
  };

  let f = student({ hijab: null, shirt: 0x24344f, pants: 0x1c1c1f });
  poseBench(f, benchSeatY, { arms: "eat", lean: 0.26, headTilt: 0.2 });
  place(f, bt[1].x - 0.5, 0, bt[1].z + benchZ, NORTH);
  meal(bt[1].x - 0.5, bt[1].z + 0.14);

  f = student({ hijab: 0xb9a0c9, shirt: 0x2f7d5a, skirt: true, pants: 0x23283a });
  poseBench(f, benchSeatY, { arms: "table", lean: 0.18, headTilt: 0.05 });
  place(f, bt[1].x - 0.35, 0, bt[1].z - benchZ, SOUTH);
  meal(bt[1].x - 0.35, bt[1].z - 0.14, true);

  f = student({ hijab: null, shirt: 0x8a8f96 });
  poseBench(f, benchSeatY, { arms: "phone", lean: 0.1, headTilt: 0.3 });
  addPhoneInHand(f);
  place(f, bt[2].x + 0.6, 0, bt[2].z - benchZ, SOUTH);
  group.add(cyl(0.04, 0.03, 0.13, P.glass, bt[2].x + 0.82, bt[2].height + 0.065, bt[2].z - 0.1, 10, { cast: false }));
  group.add(cyl(0.036, 0.027, 0.1, flatMat(0x8fbf4a, { roughness: 0.3 }), bt[2].x + 0.82, bt[2].height + 0.052, bt[2].z - 0.1, 10, { cast: false }));
  const bagOnBench = makeBackpack(0x3d6a5a, P);
  bagOnBench.position.set(bt[2].x + 1.1, benchSeatY, bt[2].z - benchZ);
  bagOnBench.rotation.y = 0.4;
  group.add(bagOnBench);

  f = student({ hijab: null, shirt: 0xd9a23a });
  poseBench(f, benchSeatY, { arms: "eat", lean: 0.24, headTilt: 0.22 });
  place(f, bt[0].x + 0.7, 0, bt[0].z + benchZ, NORTH);
  meal(bt[0].x + 0.7, bt[0].z + 0.14);

  /* ---------- Stalls: vendors and customers ---------- */
  const vendor = (x, z, apron, hijab, shirt) => {
    const v = createFigure({ height: 1.58, skin: pick(SKIN), hair: pick(HAIR), shirt, pants: 0x23283a, hijab, apron, longSleeve: true });
    poseStand(v, { armsDown: false, lean: 0.1 });
    applyArms(v, "serve");
    place(v, x, 0, z, SOUTH);
    return v;
  };
  vendor(-7.2, -3.95, 0xd99b26, null, 0x1c1c1f);
  vendor(-3.9, -3.95, 0x8a2f2f, 0x1f1f24, 0xe7e4dc);
  vendor(0.25, -3.95, 0x3f7a33, 0xc9a25a, 0x2f5d9e);

  f = student({ hijab: null, shirt: 0x6c4a8f });
  poseStand(f, { armsDown: false, lean: 0.06 });
  applyArms(f, "table");
  place(f, -6.9, 0, -2.62, NORTH);
  const custBag = makeBackpack(0x30353d, P);
  custBag.scale.setScalar(0.92);
  custBag.position.set(0, 1.0 - 0.86 + 0.02, -0.17);
  custBag.rotation.y = Math.PI;
  f.spine.add(custBag);

  f = student({ hijab: 0x7a8a9c, shirt: 0xc96a3a, skirt: true, pants: 0x3b4252 });
  poseStand(f, { armsDown: false });
  applyArms(f, "phone");
  addPhoneInHand(f);
  f.head.rotation.x = 0.3;
  place(f, 0.95, 0, -2.62, NORTH + 0.15);

  f = student({ hijab: null, shirt: 0x2f7d5a });
  poseStand(f, { armsDown: false });
  applyArms(f, "hips");
  place(f, 1.55, 0, -2.3, NORTH - 0.5);

  /* ---------- Office, mezzanine, Wing B ---------- */
  const desk = layoutSpec.furniture.officeInteriorTable;
  f = createFigure({ height: 1.62, skin: SKIN[2], hair: HAIR[1], shirt: 0xe7e4dc, pants: 0x1c1c1f, longSleeve: true });
  poseBench(f, 0.487, { arms: "type", lean: 0.1, headTilt: 0.05 });
  place(f, desk.x - 0.7, 0, desk.z + desk.d / 2 + 0.3, NORTH);

  const mh = layoutSpec.wings.mainHall;
  f = student({ hijab: null, shirt: 0x7fa7c9, pants: 0x23283a });
  poseStand(f, { armsDown: false, lean: 0.38 });
  applyArms(f, "rail");
  f.legL.hip.rotation.x = 0.16;
  f.legR.hip.rotation.x = 0.3;
  f.legR.knee.rotation.x = 0.25;
  place(f, -5.2, mh.mezzanineFloorY + 0.012, mh.mezzanineEdgeZ - 0.42, SOUTH);

  f = student({ hijab: 0x8a3a4a, shirt: 0x24344f, skirt: true, pants: 0x1c1c1f });
  poseStand(f);
  place(f, -4.3, mh.mezzanineFloorY + 0.012, mh.mezzanineEdgeZ - 0.5, SOUTH - 0.7);

  const pt = layoutSpec.furniture.steelPicnicTables;
  const picnicSeat = 0.44;
  const picnicDist = 1.35 / 2 + 0.32;
  f = student({ hijab: null, shirt: 0x9c2f2f });
  poseBench(f, picnicSeat, { arms: "table", lean: 0.2 });
  place(f, pt[1].x, 0, pt[1].z + picnicDist, NORTH);
  f = student({ hijab: 0xd8c7b0, shirt: 0x3a3f47, skirt: true, pants: 0x2d3d5c });
  poseBench(f, picnicSeat, { arms: "eat", lean: 0.24, headTilt: 0.2 });
  place(f, pt[1].x - picnicDist, 0, pt[1].z, EAST);
  {
    const y = pt[1].height;
    group.add(cyl(0.12, 0.08, 0.014, P.plate, pt[1].x - 0.38, y + 0.008, pt[1].z, 18));
    group.add(box(0.08, 0.03, 0.07, P.lauk, pt[1].x - 0.38, y + 0.03, pt[1].z, { cast: false }));
    group.add(cyl(0.034, 0.028, 0.12, P.glass, pt[1].x + 0.05, y + 0.06, pt[1].z + 0.4, 10, { cast: false }));
  }

  f = student({ hijab: null, shirt: 0x1f2a44 });
  poseBench(f, picnicSeat, { arms: "type", lean: 0.2 });
  place(f, pt[4].x, 0, pt[4].z - picnicDist, SOUTH);
  {
    const lap = makeLaptop(P, screens[1], P.laptopBlack);
    lap.position.set(pt[4].x, pt[4].height + 0.002, pt[4].z - 0.42);
    group.add(lap);
    const bag = makeBackpack(0x2f4f3a, P);
    bag.position.set(pt[4].x + 0.42, picnicSeat, pt[4].z - picnicDist);
    group.add(bag);
  }

  /* ---------- Walkers ---------- */
  const addWalker = (figure, path, speed, phase0, withBag) => {
    const { root } = figure;
    markDynamic(root);
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    if (withBag) {
      const bag = makeBackpack(withBag, P);
      bag.position.set(0, 0.16, -0.17);
      bag.rotation.y = Math.PI;
      bag.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      figure.spine.add(bag);
    }
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), P.blob);
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = 3;
    blob.userData.dynamic = true;
    blob.userData.noAO = true;
    group.add(blob);
    group.add(root);

    // Closed polyline, parameterised by distance
    const pts = path.map(([x, z]) => new THREE.Vector2(x, z));
    const lens = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const l = pts[i].distanceTo(pts[(i + 1) % pts.length]);
      lens.push(l);
      total += l;
    }
    const groundY = path.groundY ?? 0;
    let heading = 0;
    let first = true;
    const stride = 1.32 * figure.scale;

    registerAnimator((time, dt) => {
      let d = (time * speed + phase0) % total;
      let i = 0;
      while (d > lens[i]) {
        d -= lens[i];
        i = (i + 1) % pts.length;
      }
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const t = d / lens[i];
      const x = a.x + (b.x - a.x) * t;
      const z = a.y + (b.y - a.y) * t;
      const target = Math.atan2(b.x - a.x, b.y - a.y);
      if (first) {
        heading = target;
        first = false;
      } else {
        let diff = target - heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        heading += diff * Math.min(1, dt * 4.5);
      }

      const p = ((time * speed + phase0) / stride) * Math.PI * 2;
      const sw = Math.sin(p);
      const cw = Math.cos(p);
      root.position.set(x, groundY - Math.cos(p * 2) * 0.014 + 0.014, z);
      root.rotation.y = heading;
      figure.legL.hip.rotation.x = -sw * 0.5;
      figure.legR.hip.rotation.x = sw * 0.5;
      figure.legL.knee.rotation.x = 0.1 + Math.max(0, cw) * 0.85;
      figure.legR.knee.rotation.x = 0.1 + Math.max(0, -cw) * 0.85;
      figure.armL.shoulder.rotation.x = sw * 0.42;
      figure.armR.shoulder.rotation.x = -sw * 0.42;
      figure.armL.elbow.rotation.x = -0.25 - Math.max(0, sw) * 0.3;
      figure.armR.elbow.rotation.x = -0.25 - Math.max(0, -sw) * 0.3;
      figure.spine.rotation.y = sw * 0.07;
      figure.spine.rotation.x = 0.05;
      blob.position.set(x, groundY + 0.006, z);
      blob.rotation.z = heading;
    });
  };

  // South aisle of the hall, there and back
  let w = student({ hijab: null, shirt: 0xe7e4dc, pants: 0x2d3d5c, skirt: false });
  poseStand(w);
  w.armL.shoulder.rotation.z = 0.1;
  w.armR.shoulder.rotation.z = -0.1;
  addWalker(
    w,
    [
      [-11.5, 7.82],
      [9.4, 7.82],
      [10.3, 6.6],
      [9.4, 6.1],
      [-11.5, 6.25],
      [-12.3, 7.0]
    ],
    1.12,
    0,
    0x30353d
  );

  // Wing B centre aisle
  w = student({ hijab: 0x2a3a5c, shirt: 0xd9a23a, pants: 0x23283a, skirt: false });
  poseStand(w);
  addWalker(
    w,
    [
      [16.75, -13.2],
      [16.75, 1.6],
      [17.15, 2.3],
      [17.5, 1.6],
      [17.5, -13.2],
      [17.1, -13.8]
    ],
    1.0,
    9,
    0x7a2f3a
  );

  // Outside along the driveway
  w = student({ hijab: null, shirt: 0x2f7d5a, pants: 0x1c1c1f, skirt: false });
  poseStand(w);
  const outside = [
    [-19, 10.4],
    [24.5, 10.4],
    [25.2, 11.2],
    [24.5, 12.0],
    [-19, 12.0],
    [-19.8, 11.2]
  ];
  outside.groundY = layoutSpec.exteriorGroundY + 0.03;
  addWalker(w, outside, 1.22, 30, 0x1f2a44);

  return group;
}
