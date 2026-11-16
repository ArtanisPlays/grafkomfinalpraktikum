import * as THREE from "three";
import { box, cyl, rod, card, flatMat, applyMetricUV } from "./geomUtils.js";
import { createRng } from "./noise.js";
import { registerAnimator, markDynamic } from "./animation.js";
import { applyWind, applyGrassWind, foliageBlob } from "./wind.js";

/**
 * The campus around the hall: the wider ground plane, access roads, the neighbouring dormitory
 * blocks with their orange clay roofs, the yellow boundary wall with red roster blocks,
 * parked vehicles (the canteen's white pickup, a cargo trike, motorbikes, a silver car),
 * street lamps, a direction signpost, wind-blown grass, a ring of distant trees and a few birds.
 */

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

function facadeTextures(materials, { bays, floors, seed }) {
  const bw = 84;
  const fh = 116;
  const w = bays * bw;
  const h = floors * fh;
  const lit = [];
  const map = materials.createCanvasTexture(w, h, (ctx) => {
    const rng = createRng(seed);
    ctx.fillStyle = "#e9e6dd";
    ctx.fillRect(0, 0, w, h);
    // Weather mottling
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${120 + rng() * 60}, ${115 + rng() * 55}, ${100 + rng() * 50}, ${0.02 + rng() * 0.04})`;
      ctx.fillRect(rng() * w, rng() * h, 6 + rng() * 40, 3 + rng() * 22);
    }
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh;
      // Floor slab line and a painted dado
      ctx.fillStyle = "#b9b5aa";
      ctx.fillRect(0, y0, w, 7);
      ctx.fillStyle = "#d9d5ca";
      ctx.fillRect(0, y0 + fh - 30, w, 30);
      for (let b = 0; b < bays; b++) {
        const x0 = b * bw;
        // Door
        ctx.fillStyle = "#7a5a3c";
        ctx.fillRect(x0 + 8, y0 + 34, 24, fh - 34);
        ctx.fillStyle = "#5e4530";
        ctx.fillRect(x0 + 8, y0 + 34, 24, 3);
        ctx.fillStyle = "#c9c2a8";
        ctx.fillRect(x0 + 27, y0 + 78, 3, 5);
        // Vent above the door
        ctx.fillStyle = "#3d4a52";
        ctx.fillRect(x0 + 8, y0 + 18, 24, 12);
        // Window with louvres
        const isLit = rng() < 0.42;
        lit.push([x0 + 40, y0 + 34, 36, 44, isLit, rng()]);
        ctx.fillStyle = "#31404b";
        ctx.fillRect(x0 + 40, y0 + 34, 36, 44);
        ctx.fillStyle = "rgba(140, 170, 190, 0.35)";
        for (let l = 0; l < 6; l++) ctx.fillRect(x0 + 41, y0 + 36 + l * 7, 34, 2);
        ctx.strokeStyle = "#f2f0ea";
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 40, y0 + 34, 36, 44);
        ctx.beginPath();
        ctx.moveTo(x0 + 58, y0 + 34);
        ctx.lineTo(x0 + 58, y0 + 78);
        ctx.stroke();
        if (rng() < 0.3) {
          // Curtain
          ctx.fillStyle = ["rgba(200,120,90,0.7)", "rgba(110,140,190,0.7)", "rgba(220,210,170,0.7)", "rgba(120,170,130,0.7)"][Math.floor(rng() * 4)];
          ctx.fillRect(x0 + 42, y0 + 36, 15, 40);
        }
        // Room number plate
        ctx.fillStyle = "#12365f";
        ctx.fillRect(x0 + 13, y0 + 40, 12, 6);
        // Rain streak under the window
        if (rng() < 0.5) {
          const g = ctx.createLinearGradient(0, y0 + 78, 0, y0 + fh);
          g.addColorStop(0, "rgba(90,88,78,0.22)");
          g.addColorStop(1, "rgba(90,88,78,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x0 + 44 + rng() * 20, y0 + 78, 5 + rng() * 6, fh - 78);
        }
      }
    }
  });
  const emissiveMap = materials.createCanvasTexture(w, h, (ctx) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, ww, hh, isLit, r] of lit) {
      if (!isLit) continue;
      ctx.fillStyle = r < 0.7 ? "#ffd9a0" : r < 0.9 ? "#fff3dc" : "#bcd8ff";
      ctx.globalAlpha = 0.65 + r * 0.35;
      ctx.fillRect(x, y, ww, hh);
      ctx.globalAlpha = 1;
    }
  });
  return { map, emissiveMap };
}

function clayRoofTexture(materials) {
  const tex = materials.createCanvasTexture(256, 256, (ctx, w, h) => {
    const rng = createRng(4242);
    ctx.fillStyle = "#b5532a";
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tone = 150 + rng() * 60;
        ctx.fillStyle = `rgb(${tone + 25}, ${tone * 0.48}, ${tone * 0.26})`;
        ctx.fillRect(c * cw + 1, r * rh, cw - 2, rh - 2);
        const g = ctx.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
        g.addColorStop(0, "rgba(0,0,0,0.25)");
        g.addColorStop(0.5, "rgba(255,220,180,0.14)");
        g.addColorStop(1, "rgba(0,0,0,0.25)");
        ctx.fillStyle = g;
        ctx.fillRect(c * cw, r * rh, cw, rh);
      }
      ctx.fillStyle = "rgba(40, 18, 8, 0.5)";
      ctx.fillRect(0, (r + 1) * rh - 3, w, 3);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(40, 46, 30, ${0.08 + rng() * 0.12})`;
      ctx.fillRect(rng() * w, rng() * h, 10 + rng() * 40, 6 + rng() * 20);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 2.2, 1 / 2.4);
  return tex;
}

function rosterWallTexture(materials) {
  const tex = materials.createCanvasTexture(512, 256, (ctx, w, h) => {
    const rng = createRng(77);
    ctx.fillStyle = "#e3b93c";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(${120 + rng() * 60}, ${90 + rng() * 40}, ${30 + rng() * 30}, ${0.03 + rng() * 0.05})`;
      ctx.fillRect(rng() * w, rng() * h, 8 + rng() * 50, 4 + rng() * 30);
    }
    // Capping and plinth
    ctx.fillStyle = "#8f2f22";
    ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = "#6f6a60";
    ctx.fillRect(0, h - 30, w, 30);
    // Band of red terracotta roster (ventilation) blocks
    const size = 32;
    for (let x = 0; x < w; x += size) {
      for (let y = 40; y < 40 + size * 2; y += size) {
        ctx.fillStyle = "#a8402a";
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        ctx.fillStyle = "#3a1c14";
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + 5);
        ctx.lineTo(x + size - 5, y + size / 2);
        ctx.lineTo(x + size / 2, y + size - 5);
        ctx.lineTo(x + 5, y + size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#a8402a";
        ctx.fillRect(x + size / 2 - 2, y + 5, 4, size - 10);
        ctx.fillRect(x + 5, y + size / 2 - 2, size - 10, 4);
      }
    }
    // Damp rising from the ground
    const g = ctx.createLinearGradient(0, h - 90, 0, h - 30);
    g.addColorStop(0, "rgba(70,80,50,0)");
    g.addColorStop(1, "rgba(70,80,50,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 90, w, 60);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(1 / 3.2, 1 / 2.3);
  return tex;
}

function asphaltTexture(materials, dashed) {
  const tex = materials.createCanvasTexture(256, 256, (ctx, w, h) => {
    const rng = createRng(dashed ? 5 : 6);
    ctx.fillStyle = "#3d4043";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const t = 40 + rng() * 60;
      ctx.fillStyle = `rgba(${t}, ${t}, ${t + 3}, 0.5)`;
      ctx.fillRect(rng() * w, rng() * h, 1.5, 1.5);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(25, 26, 28, ${0.1 + rng() * 0.14})`;
      ctx.fillRect(rng() * w, 0, 10 + rng() * 26, h);
    }
    if (dashed) {
      ctx.fillStyle = "rgba(235, 232, 220, 0.85)";
      ctx.fillRect(w / 2 - 3, 20, 6, h * 0.5);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function signBoardTexture(materials, text, arrow) {
  return materials.createCanvasTexture(512, 112, (ctx, w, h) => {
    ctx.fillStyle = "#0b6b3a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px Arial";
    ctx.textBaseline = "middle";
    const ax = arrow === "left" ? 52 : w - 52;
    ctx.beginPath();
    if (arrow === "left") {
      ctx.moveTo(ax - 30, h / 2);
      ctx.lineTo(ax, h / 2 - 26);
      ctx.lineTo(ax, h / 2 - 10);
      ctx.lineTo(ax + 28, h / 2 - 10);
      ctx.lineTo(ax + 28, h / 2 + 10);
      ctx.lineTo(ax, h / 2 + 10);
      ctx.lineTo(ax, h / 2 + 26);
    } else {
      ctx.moveTo(ax + 30, h / 2);
      ctx.lineTo(ax, h / 2 - 26);
      ctx.lineTo(ax, h / 2 - 10);
      ctx.lineTo(ax - 28, h / 2 - 10);
      ctx.lineTo(ax - 28, h / 2 + 10);
      ctx.lineTo(ax, h / 2 + 10);
      ctx.lineTo(ax, h / 2 + 26);
    }
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = arrow === "left" ? "left" : "right";
    ctx.fillText(text, arrow === "left" ? 100 : w - 100, h / 2 + 2);
  });
}

/* ------------------------------------------------------------------ */
/* Dormitory block                                                     */
/* ------------------------------------------------------------------ */

function dormBlock(S, { length, depth = 9.5, floors = 4, facade }) {
  const g = new THREE.Group();
  const fh = 3.3;
  const H = floors * fh;
  const corridor = 1.5;

  g.add(box(length, H, depth, S.dormWall, 0, H / 2, 0));
  g.add(card(length, H, facade, 0, H / 2, depth / 2 + 0.015, 0));
  g.add(card(length, H, facade, 0, H / 2, -depth / 2 - 0.015, Math.PI));
  g.add(box(length + 0.3, 0.5, depth + 0.3, S.plinth, 0, 0.25, 0));

  // Open access corridors on the front: slabs, solid parapets with a painted band, columns
  for (let f = 1; f <= floors; f++) {
    g.add(box(length + 0.5, 0.16, corridor + 0.1, S.slab, 0, f * fh - 0.08, depth / 2 + corridor / 2));
  }
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    g.add(box(length + 0.5, 0.95, 0.12, S.dormWall, 0, y + 0.475, depth / 2 + corridor));
    g.add(box(length + 0.52, 0.22, 0.13, S.dormBand, 0, y + 0.84, depth / 2 + corridor));
  }
  const bay = 7.2;
  const n = Math.round(length / bay);
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (i * length) / n;
    g.add(box(0.36, H, 0.36, S.dormWall, x, H / 2, depth / 2 + corridor));
  }
  // Stair towers at both ends
  for (const s of [-1, 1]) {
    g.add(box(3.2, H + 1.2, depth * 0.55, S.dormWall, s * (length / 2 + 1.6), (H + 1.2) / 2, -depth * 0.1));
    for (let f = 0; f < floors; f++) {
      g.add(box(1.4, 1.1, 0.05, S.windowDark, s * (length / 2 + 1.6), f * fh + 1.9, depth * 0.175 + 0.03, { cast: false }));
    }
  }

  // Clay-tile gable roof with generous eaves
  const half = depth / 2 + corridor / 2 + 1.1;
  const rise = 2.7;
  const slope = Math.hypot(half, rise);
  const pitch = Math.atan2(rise, half);
  const zc = corridor / 2;
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(length + 8.4, 0.14, slope + 0.3);
    applyMetricUV(geo);
    const panel = new THREE.Mesh(geo, S.clayRoof);
    panel.position.set(0, H + rise / 2 + 0.12, zc + (s * half) / 2);
    panel.rotation.x = s * pitch;
    panel.castShadow = true;
    panel.receiveShadow = true;
    g.add(panel);
    g.add(box(length + 8.4, 0.2, 0.05, S.fascia, 0, H + 0.02, zc + s * (half + 0.06)));
  }
  g.add(box(length + 8.5, 0.16, 0.42, S.ridge, 0, H + rise + 0.2, zc));
  // Gable infill at each end
  const tri = new THREE.Shape();
  tri.moveTo(-half + 1.1, 0);
  tri.lineTo(half - 1.1, 0);
  tri.lineTo(0, rise * ((half - 1.1) / half));
  tri.closePath();
  for (const s of [-1, 1]) {
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(tri), S.dormWallDouble);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(s * (length / 2 + 3.2), H, zc);
    gable.castShadow = true;
    g.add(gable);
  }

  // Lived-in touches: laundry over a few parapets, AC condensers on the back
  const rng = createRng(Math.round(length * 31 + floors));
  const cloth = [S.clothA, S.clothB, S.clothC, S.clothD];
  for (let i = 0; i < Math.round(length * 0.7); i++) {
    const f = Math.floor(rng() * floors);
    const x = (rng() - 0.5) * (length - 2);
    g.add(box(0.5 + rng() * 0.5, 0.5 + rng() * 0.4, 0.03, cloth[Math.floor(rng() * 4)], x, f * fh + 0.72, depth / 2 + corridor + 0.085, { cast: false }));
  }
  for (let i = 0; i < Math.round(length * 0.35); i++) {
    const f = Math.floor(rng() * floors);
    const x = (rng() - 0.5) * (length - 2);
    g.add(box(0.8, 0.55, 0.32, S.acUnit, x, f * fh + 0.6, -depth / 2 - 0.2));
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Vehicles (all built facing +X)                                      */
/* ------------------------------------------------------------------ */

function wheel(S, radius, width) {
  const w = new THREE.Group();
  const tyre = cyl(radius, radius, width, S.tyre, 0, 0, 0, 20);
  tyre.rotation.x = Math.PI / 2;
  w.add(tyre);
  const hub = cyl(radius * 0.58, radius * 0.58, width + 0.012, S.hub, 0, 0, 0, 14, { cast: false });
  hub.rotation.x = Math.PI / 2;
  w.add(hub);
  const cap = cyl(radius * 0.2, radius * 0.2, width + 0.03, S.tyre, 0, 0, 0, 8, { cast: false });
  cap.rotation.x = Math.PI / 2;
  w.add(cap);
  return w;
}

function pickupTruck(S) {
  const t = new THREE.Group();
  const white = S.truckWhite;
  // Chassis and wheels
  t.add(box(4.15, 0.14, 1.0, S.chassis, -0.05, 0.5, 0));
  for (const [x, z] of [
    [1.38, 0.72],
    [1.38, -0.72],
    [-1.25, 0.72],
    [-1.25, -0.72]
  ]) {
    const w = wheel(S, 0.33, 0.22);
    w.position.set(x, 0.33, z);
    t.add(w);
  }
  // Cab-over cabin
  t.add(box(1.5, 0.78, 1.64, white, 1.35, 0.98, 0));
  const upper = box(1.36, 0.66, 1.58, white, 1.28, 1.7, 0);
  t.add(upper);
  t.add(box(1.3, 0.05, 1.5, white, 1.26, 2.05, 0));
  // Glass: windscreen, side windows, rear window
  t.add(box(0.02, 0.5, 1.4, S.glass, 1.97, 1.72, 0, { cast: false }));
  for (const s of [-1, 1]) {
    t.add(box(0.78, 0.44, 0.02, S.glass, 1.4, 1.72, s * 0.795, { cast: false }));
    t.add(box(0.018, 0.74, 0.01, S.seam, 0.98, 1.0, s * 0.823, { cast: false }));
    t.add(box(0.018, 0.74, 0.01, S.seam, 1.88, 1.0, s * 0.823, { cast: false }));
    t.add(box(0.12, 0.03, 0.02, S.chassis, 1.1, 1.22, s * 0.832, { cast: false }));
    // Mirror on a stalk
    t.add(rod([1.95, 1.6, s * 0.8], [2.02, 1.62, s * 0.98], 0.012, S.chassis, { radial: 5 }));
    t.add(box(0.03, 0.24, 0.13, S.chassis, 2.03, 1.62, s * 1.0));
    // Headlight + indicator
    t.add(box(0.02, 0.14, 0.26, S.headlight, 2.105, 0.92, s * 0.6, { cast: false }));
    t.add(box(0.02, 0.07, 0.12, S.amber, 2.105, 0.92, s * 0.78, { cast: false }));
    // Tail lamp
    t.add(box(0.02, 0.16, 0.1, S.tailRed, -2.08, 0.72, s * 0.72, { cast: false }));
    // Mud flap
    t.add(box(0.02, 0.26, 0.24, S.tyre, -1.66, 0.36, s * 0.72, { cast: false }));
  }
  t.add(box(0.03, 0.5, 1.2, S.glass, 0.6, 1.72, 0, { cast: false }));
  t.add(box(0.02, 0.18, 0.9, S.chassis, 2.105, 0.92, 0, { cast: false }));
  t.add(box(0.012, 0.05, 0.36, S.hub, 2.117, 1.14, 0, { cast: false }));
  t.add(box(0.12, 0.2, 1.68, S.bumper, 2.1, 0.58, 0));
  t.add(box(0.012, 0.12, 0.36, S.plate, 2.165, 0.58, 0, { cast: false }));
  // Wipers
  t.add(rod([1.985, 1.5, 0.1], [1.985, 1.74, 0.5], 0.006, S.chassis, { radial: 4 }));
  t.add(rod([1.985, 1.5, -0.5], [1.985, 1.74, -0.1], 0.006, S.chassis, { radial: 4 }));

  // Drop-side cargo bed
  t.add(box(2.62, 0.07, 1.66, white, -0.76, 0.74, 0));
  for (const s of [-1, 1]) {
    t.add(box(2.62, 0.36, 0.04, white, -0.76, 0.95, s * 0.81));
    for (let i = 0; i < 4; i++) t.add(box(0.05, 0.36, 0.02, S.seam, -1.85 + i * 0.72, 0.95, s * 0.835, { cast: false }));
    t.add(box(2.62, 0.03, 0.06, S.chassis, -0.76, 1.14, s * 0.81, { cast: false }));
  }
  t.add(box(0.04, 0.36, 1.66, white, -2.07, 0.95, 0));
  t.add(box(0.04, 0.6, 1.66, white, 0.55, 1.07, 0));
  t.add(box(0.012, 0.12, 0.36, S.plate, -2.095, 0.9, 0, { cast: false }));
  t.add(rod([0.56, 1.36, -0.8], [0.56, 1.36, 0.8], 0.02, S.chassis, { radial: 6 }));

  // Today's delivery: water gallons and cartons
  for (let i = 0; i < 8; i++) {
    const gx = 0.2 - Math.floor(i / 2) * 0.33;
    const gz = (i % 2 ? 1 : -1) * 0.2 + 0.36;
    t.add(cyl(0.135, 0.135, 0.36, S.gallon, gx, 0.955, gz, 14));
    t.add(cyl(0.04, 0.12, 0.08, S.gallon, gx, 1.17, gz, 10));
    t.add(cyl(0.035, 0.035, 0.03, S.gallonCap, gx, 1.22, gz, 8));
  }
  t.add(box(0.5, 0.34, 0.4, S.carton, -1.55, 0.945, -0.45));
  t.add(box(0.5, 0.34, 0.4, S.carton, -1.52, 0.945, 0.0));
  t.add(box(0.46, 0.3, 0.38, S.carton, -1.54, 1.265, -0.22));
  t.add(box(0.6, 0.26, 0.42, S.crate, -0.95, 0.905, -0.5));
  return t;
}

function motorbike(S, bodyMat) {
  const m = new THREE.Group();
  for (const x of [0.62, -0.6]) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.055, 8, 18), S.tyre);
    tyre.position.set(x, 0.285, 0);
    tyre.castShadow = true;
    m.add(tyre);
    const hub = cyl(0.1, 0.1, 0.06, S.hub, x, 0.285, 0, 10, { cast: false });
    hub.rotation.x = Math.PI / 2;
    m.add(hub);
  }
  // Step-through body
  m.add(box(0.5, 0.06, 0.3, S.chassis, 0.12, 0.33, 0));
  const tailBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 3, 8), bodyMat);
  tailBody.rotation.z = Math.PI / 2 - 0.2;
  tailBody.scale.z = 0.95;
  tailBody.position.set(-0.36, 0.62, 0);
  tailBody.castShadow = true;
  m.add(tailBody);
  m.add(box(0.72, 0.08, 0.3, S.seat, -0.3, 0.83, 0));
  const shield = box(0.07, 0.56, 0.38, bodyMat, 0.42, 0.62, 0);
  shield.rotation.z = -0.22;
  m.add(shield);
  m.add(box(0.3, 0.05, 0.16, bodyMat, 0.62, 0.55, 0));
  m.add(rod([0.6, 0.3, 0], [0.42, 1.02, 0], 0.022, S.chassis, { radial: 6, cast: true }));
  m.add(box(0.14, 0.14, 0.3, bodyMat, 0.45, 1.0, 0));
  m.add(rod([0.4, 1.06, -0.32], [0.4, 1.06, 0.32], 0.014, S.chassis, { radial: 6 }));
  m.add(box(0.03, 0.1, 0.16, S.headlight, 0.525, 1.0, 0, { cast: false }));
  for (const s of [-1, 1]) {
    m.add(rod([0.4, 1.06, s * 0.24], [0.36, 1.26, s * 0.3], 0.006, S.chassis, { radial: 4 }));
    m.add(box(0.02, 0.07, 0.11, S.chassis, 0.36, 1.28, s * 0.3, { cast: false }));
    m.add(box(0.05, 0.03, 0.05, S.tyre, 0.4, 1.06, s * 0.3, { cast: false }));
  }
  m.add(box(0.03, 0.08, 0.14, S.tailRed, -0.78, 0.68, 0, { cast: false }));
  m.add(box(0.012, 0.1, 0.2, S.plate, -0.8, 0.52, 0, { cast: false }));
  m.add(rod([-0.2, 0.3, 0.16], [-0.72, 0.36, 0.17], 0.035, S.exhaust, { radial: 7 }));
  m.add(rod([0.0, 0.3, -0.12], [-0.06, 0.02, -0.26], 0.012, S.chassis, { radial: 5 }));
  m.rotation.x = -0.13; // resting on its side stand
  const holder = new THREE.Group();
  holder.add(m);
  return holder;
}

function cargoTrike(S) {
  const t = new THREE.Group();
  // Front: motorbike nose
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 8, 18), S.tyre);
  tyre.position.set(1.25, 0.3, 0);
  tyre.castShadow = true;
  t.add(tyre);
  t.add(rod([1.25, 0.3, 0], [1.0, 1.05, 0], 0.025, S.chassis, { radial: 6, cast: true }));
  t.add(rod([0.98, 1.08, -0.34], [0.98, 1.08, 0.34], 0.015, S.chassis, { radial: 6 }));
  t.add(box(0.08, 0.5, 0.42, S.trikeBlue, 1.0, 0.72, 0));
  t.add(box(0.03, 0.12, 0.16, S.headlight, 1.09, 1.0, 0, { cast: false }));
  t.add(box(0.75, 0.07, 0.34, S.chassis, 0.6, 0.38, 0));
  t.add(box(0.62, 0.09, 0.34, S.seat, 0.45, 0.82, 0));
  t.add(box(0.4, 0.36, 0.3, S.trikeBlue, 0.4, 0.6, 0));
  // Rear: load bed on two wheels
  for (const s of [-1, 1]) {
    const w = wheel(S, 0.27, 0.14);
    w.position.set(-0.75, 0.27, s * 0.62);
    t.add(w);
    t.add(box(1.5, 0.34, 0.035, S.trikeBlue, -0.75, 0.8, s * 0.55));
    t.add(box(1.5, 0.03, 0.05, S.chassis, -0.75, 0.98, s * 0.55, { cast: false }));
  }
  t.add(box(1.5, 0.05, 1.1, S.trikeBlue, -0.75, 0.62, 0));
  t.add(box(0.035, 0.34, 1.1, S.trikeBlue, -1.5, 0.8, 0));
  t.add(box(0.035, 0.5, 1.1, S.trikeBlue, 0.0, 0.88, 0));
  t.add(box(1.4, 0.08, 0.9, S.chassis, -0.75, 0.52, 0));
  t.add(box(0.012, 0.1, 0.24, S.plate, -1.522, 0.72, 0, { cast: false }));
  // Load: sacks of rice and a crate of vegetables
  for (let i = 0; i < 3; i++) {
    const sack = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 3, 8), S.sack);
    sack.rotation.set(Math.PI / 2, 0, 0.2 * i);
    sack.scale.y = 0.9;
    sack.position.set(-1.1 + i * 0.12, 0.76 + i * 0.2, (i % 2 ? 0.1 : -0.1));
    sack.castShadow = true;
    t.add(sack);
  }
  t.add(box(0.5, 0.26, 0.38, S.crate, -0.36, 0.78, 0.22));
  for (let i = 0; i < 5; i++) {
    const veg = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), i % 2 ? S.vegGreen : S.vegOrange);
    veg.position.set(-0.5 + i * 0.07, 0.94, 0.14 + (i % 3) * 0.07);
    t.add(veg);
  }
  return t;
}

function car(S, paint) {
  const c = new THREE.Group();
  const width = 1.7;
  const extrude = (pts, depth, material) => {
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  // Lower body up to the beltline
  c.add(
    extrude(
      [
        [-2.08, 0.42],
        [-2.1, 0.9],
        [-1.95, 1.02],
        [1.1, 1.02],
        [1.95, 0.86],
        [2.1, 0.62],
        [2.08, 0.4],
        [1.7, 0.32],
        [-1.7, 0.32]
      ],
      width - 0.08,
      paint
    )
  );
  // Greenhouse: dark glass block with painted roof and pillars
  c.add(
    extrude(
      [
        [-1.92, 1.0],
        [-1.56, 1.5],
        [0.4, 1.5],
        [1.12, 1.0]
      ],
      width - 0.22,
      S.glass
    )
  );
  c.add(box(1.98, 0.05, width - 0.16, paint, -0.58, 1.555, 0));
  for (const s of [-1, 1]) {
    const zz = s * (width / 2 - 0.085);
    c.add(rod([1.14, 1.02, zz], [0.42, 1.55, zz], 0.035, paint, { radial: 6 }));
    c.add(rod([-1.94, 1.02, zz], [-1.57, 1.55, zz], 0.04, paint, { radial: 6 }));
    c.add(rod([-0.42, 1.02, zz], [-0.42, 1.55, zz], 0.035, paint, { radial: 6 }));
    c.add(box(0.014, 0.6, 0.01, S.seam, -0.42, 0.72, s * (width / 2 + 0.001), { cast: false }));
    c.add(box(0.014, 0.6, 0.01, S.seam, 0.62, 0.72, s * (width / 2 + 0.001), { cast: false }));
    c.add(box(0.14, 0.025, 0.02, S.chassis, 0.4, 0.92, s * (width / 2 + 0.008), { cast: false }));
    c.add(box(0.14, 0.025, 0.02, S.chassis, -0.62, 0.92, s * (width / 2 + 0.008), { cast: false }));
    c.add(box(0.12, 0.09, 0.16, paint, 1.0, 1.1, s * (width / 2 + 0.07)));
    c.add(box(0.03, 0.12, 0.3, S.headlight, 2.07, 0.76, s * 0.56, { cast: false }));
    c.add(box(0.03, 0.16, 0.24, S.tailRed, -2.12, 0.86, s * 0.6, { cast: false }));
    for (const x of [1.3, -1.3]) {
      const w = wheel(S, 0.31, 0.2);
      w.position.set(x, 0.31, s * (width / 2 - 0.1));
      c.add(w);
      const arch = cyl(0.37, 0.37, 0.02, S.chassis, x, 0.33, s * (width / 2 - 0.005), 18, { cast: false });
      arch.rotation.x = Math.PI / 2;
      c.add(arch);
    }
  }
  c.add(box(0.03, 0.14, 0.8, S.chassis, 2.12, 0.6, 0, { cast: false }));
  c.add(box(0.012, 0.11, 0.38, S.plate, 2.14, 0.47, 0, { cast: false }));
  c.add(box(0.012, 0.11, 0.38, S.plate, -2.145, 0.62, 0, { cast: false }));
  return c;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function createSurroundings(layoutSpec, materials, { outdoorGroup = null } = {}) {
  const group = new THREE.Group();
  group.name = "Surroundings";
  const glow = materials.registerNightGlow || ((m) => m);
  const gY = layoutSpec.exteriorGroundY;
  const rng = createRng(90210);

  const S = {
    dormWall: flatMat(0xe9e6dd, { roughness: 0.9 }),
    dormWallDouble: flatMat(0xe4e1d8, { roughness: 0.9, side: THREE.DoubleSide }),
    dormBand: flatMat(0xd9722a, { roughness: 0.8 }),
    slab: flatMat(0xcfcbc0, { roughness: 0.9 }),
    plinth: flatMat(0x77726a, { roughness: 0.95 }),
    windowDark: flatMat(0x2b3944, { roughness: 0.2, metalness: 0.3 }),
    fascia: flatMat(0x7a3b22, { roughness: 0.7 }),
    ridge: flatMat(0x9a4424, { roughness: 0.8 }),
    acUnit: flatMat(0xdcdcd6, { roughness: 0.5 }),
    clothA: flatMat(0x3f6fb0, { roughness: 0.95 }),
    clothB: flatMat(0xe8e6de, { roughness: 0.95 }),
    clothC: flatMat(0xb23a48, { roughness: 0.95 }),
    clothD: flatMat(0x4a8a5f, { roughness: 0.95 }),
    clayRoof: (() => {
      const m = new THREE.MeshStandardMaterial({ map: clayRoofTexture(materials), roughness: 0.85 });
      m.userData.metricUV = true;
      return m;
    })(),
    tyre: flatMat(0x17181a, { roughness: 0.9 }),
    hub: flatMat(0xb9bdc2, { roughness: 0.35, metalness: 0.8 }),
    chassis: flatMat(0x1e2023, { roughness: 0.6, metalness: 0.3 }),
    truckWhite: flatMat(0xf1f1ee, { roughness: 0.32, metalness: 0.1, envMapIntensity: 1.1 }),
    glass: flatMat(0x18222b, { roughness: 0.06, metalness: 0.6, envMapIntensity: 1.6 }),
    seam: flatMat(0x8d9194, { roughness: 0.6 }),
    bumper: flatMat(0x3a3d41, { roughness: 0.6 }),
    plate: flatMat(0xf4f4f0, { roughness: 0.5 }),
    headlight: glow(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xfff6dc, emissiveIntensity: 0.05, roughness: 0.1, metalness: 0.4 }), 0.05, 0.25),
    amber: flatMat(0xe8921c, { roughness: 0.3 }),
    tailRed: flatMat(0xb0171c, { roughness: 0.3 }),
    gallon: flatMat(0x6fb3e0, { roughness: 0.15, envMapIntensity: 1.5 }),
    gallonCap: flatMat(0x1f5fb8, { roughness: 0.4 }),
    carton: flatMat(0xb08552, { roughness: 0.9 }),
    crate: flatMat(0x2f7d4f, { roughness: 0.6 }),
    seat: flatMat(0x141416, { roughness: 0.75 }),
    exhaust: flatMat(0x8d9093, { roughness: 0.4, metalness: 0.8 }),
    trikeBlue: flatMat(0x1f5fa8, { roughness: 0.45, metalness: 0.2 }),
    sack: flatMat(0xe6dfc8, { roughness: 0.95 }),
    vegGreen: flatMat(0x4f9a3a, { roughness: 0.8 }),
    vegOrange: flatMat(0xe07a1f, { roughness: 0.8 }),
    bikeBlack: flatMat(0x1b1c1f, { roughness: 0.3, metalness: 0.4 }),
    bikeRed: flatMat(0xb4161b, { roughness: 0.3, metalness: 0.3 }),
    bikeBlue: flatMat(0x1c4fa0, { roughness: 0.3, metalness: 0.3 }),
    bikeWhite: flatMat(0xe9e9e6, { roughness: 0.3, metalness: 0.2 }),
    carSilver: flatMat(0xb4b9be, { roughness: 0.28, metalness: 0.75, envMapIntensity: 1.2 }),
    carDark: flatMat(0x23262b, { roughness: 0.25, metalness: 0.7, envMapIntensity: 1.2 }),
    poleGreen: flatMat(0x24503a, { roughness: 0.5, metalness: 0.4 }),
    poleGrey: flatMat(0x8e9499, { roughness: 0.45, metalness: 0.6 }),
    lampLens: glow(new THREE.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0xffe2a8, emissiveIntensity: 0.02, roughness: 0.3 }), 0.02, 9),
    curb: flatMat(0xb6bbc0, { roughness: 0.85 }),
    sidewalk: flatMat(0xa9aca8, { roughness: 0.9 }),
    bird: new THREE.MeshBasicMaterial({ color: 0x1c1f24, side: THREE.DoubleSide })
  };

  // Everything distant lives on render layer 1: the main camera sees it, the floor-reflection
  // camera (layer 0 only) skips it, which saves a full extra pass over the whole campus.
  const far = new THREE.Group();
  far.name = "FarSurroundings";
  group.add(far);

  /* ---------- wider ground ---------- */
  const groundGeo = new THREE.CircleGeometry(320, 64);
  groundGeo.rotateX(-Math.PI / 2);
  applyMetricUV(groundGeo);
  const farGrass = materials.grass.clone();
  farGrass.color = new THREE.Color(0xa9b78e);
  farGrass.userData = { metricUV: true };
  const ground = new THREE.Mesh(groundGeo, farGrass);
  ground.position.y = gY - 0.1;
  ground.receiveShadow = true;
  far.add(ground);

  /* ---------- roads, verge and the driveway apron ---------- */
  const roadMat = (repX, repY, dashed) => {
    const tex = asphaltTexture(materials, dashed);
    tex.repeat.set(repX, repY);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  };
  const flatQuad = (w, d, material, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    far.add(m);
    return m;
  };
  // South road (runs east-west) and east road (runs north-south)
  const south = flatQuad(6.6, 300, roadMat(1, 42, true), 0, gY - 0.04, 27.9);
  south.rotation.z = Math.PI / 2;
  flatQuad(6.6, 196, roadMat(1, 27, true), 38.6, gY - 0.045, -73.4);
  // Kerbs + footpath along the south road, grass verge up to the berm
  far.add(box(185.2, 0.16, 0.2, S.curb, -57.4, gY - 0.02, 24.5));
  far.add(box(108, 0.16, 0.2, S.curb, 96, gY - 0.02, 24.5));
  far.add(box(300, 0.16, 0.2, S.curb, 0, gY - 0.02, 31.3));
  far.add(box(64, 0.05, 1.6, S.sidewalk, 3, gY - 0.03, 23.6, { cast: false }));
  const verge = box(64, 0.05, 3.0, materials.grass, 3, gY - 0.035, 21.4, { cast: false });
  far.add(verge);
  far.add(box(0.2, 0.16, 196, S.curb, 35.2, gY - 0.02, -73.4));
  far.add(box(0.2, 0.16, 196, S.curb, 42.0, gY - 0.02, -73.4));
  // Apron linking the paved yard to the east road
  far.add(box(7.4, 0.03, 5.0, materials.paver, 31.6, gY - 0.016, 11.0, { cast: false }));

  /* ---------- neighbouring dormitory blocks ---------- */
  const facadeA = facadeTextures(materials, { bays: 12, floors: 4, seed: 101 });
  const facadeB = facadeTextures(materials, { bays: 12, floors: 3, seed: 202 });
  const facadeMat = (f) =>
    glow(
      new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.88 }),
      0.0,
      1.5
    );
  const fmA = facadeMat(facadeA);
  const fmB = facadeMat(facadeB);
  const blocks = [
    { x: 0, z: -47, rotY: 0, length: 50, floors: 4, facade: fmA },
    { x: -54, z: -28, rotY: Math.PI / 2, length: 44, floors: 4, facade: fmA },
    { x: -52, z: 22, rotY: Math.PI / 2, length: 38, floors: 3, facade: fmB },
    { x: -30, z: 52, rotY: Math.PI, length: 46, floors: 4, facade: fmA },
    { x: 28, z: 54, rotY: Math.PI, length: 44, floors: 3, facade: fmB },
    { x: 62, z: -6, rotY: -Math.PI / 2, length: 48, floors: 4, facade: fmA },
    { x: 60, z: -62, rotY: -Math.PI / 2, length: 40, floors: 3, facade: fmB }
  ];
  const footprints = [];
  for (const b of blocks) {
    const block = dormBlock(S, b);
    block.position.set(b.x, gY - 0.05, b.z);
    block.rotation.y = b.rotY;
    far.add(block);
    const alongX = Math.abs(Math.sin(b.rotY)) < 0.5;
    footprints.push({ x: b.x, z: b.z, hx: (alongX ? b.length / 2 : 8) + 6, hz: (alongX ? 8 : b.length / 2) + 6 });
  }

  /* ---------- yellow boundary wall with red roster blocks ---------- */
  const wallMat = new THREE.MeshStandardMaterial({ map: rosterWallTexture(materials), roughness: 0.9 });
  wallMat.userData.metricUV = true;
  const wallSeg = (x, z0, z1) => {
    far.add(box(0.24, 2.3, z1 - z0, wallMat, x, gY + 1.15, (z0 + z1) / 2));
    for (let z = z0; z <= z1 + 0.01; z += 3.2) far.add(box(0.36, 2.45, 0.36, S.dormWall, x, gY + 1.225, z));
  };
  wallSeg(33.6, -30.4, 8.0);
  wallSeg(33.6, 14.0, 23.6);
  const wallNorth = box(60, 2.3, 0.24, wallMat, 3.6, gY + 1.15, -30.4);
  far.add(wallNorth);
  // Gate posts and a sliding steel gate left open
  for (const z of [8.0, 14.0]) far.add(box(0.5, 2.8, 0.5, S.dormBand, 33.6, gY + 1.4, z));
  const gate = new THREE.Group();
  gate.add(box(0.05, 0.06, 5.6, S.poleGreen, 0, 1.75, 0));
  gate.add(box(0.05, 0.06, 5.6, S.poleGreen, 0, 0.18, 0));
  for (let i = 0; i <= 22; i++) gate.add(box(0.025, 1.6, 0.025, S.poleGreen, 0, 0.96, -2.8 + i * 0.2545, { cast: false }));
  gate.position.set(33.95, gY, 17.2);
  far.add(gate);

  /* ---------- vehicles ---------- */
  const truck = pickupTruck(S);
  truck.position.set(14.9, gY + 0.008, 6.25);
  truck.rotation.y = 0.05;
  group.add(truck);

  const trike = cargoTrike(S);
  trike.position.set(24.0, gY + 0.008, 5.4);
  trike.rotation.y = Math.PI / 2 + 0.2;
  group.add(trike);

  const bikeMats = [S.bikeBlack, S.bikeRed, S.bikeWhite, S.bikeBlue, S.bikeBlack];
  bikeMats.forEach((mat, i) => {
    const bike = motorbike(S, mat);
    bike.position.set(18.3 + i * 0.82, gY + 0.008, 4.75 + (i % 2) * 0.12);
    bike.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.25;
    group.add(bike);
  });
  for (let i = 0; i < 3; i++) {
    const bike = motorbike(S, bikeMats[(i + 2) % 5]);
    bike.position.set(-15.4 - i * 0.85, gY + 0.008, 9.6);
    bike.rotation.y = -Math.PI / 2 + (rng() - 0.5) * 0.3;
    group.add(bike);
  }

  const silver = car(S, S.carSilver);
  silver.position.set(26.3, gY + 0.008, 8.3);
  silver.rotation.y = Math.PI / 2 - 0.04;
  group.add(silver);
  const dark = car(S, S.carDark);
  dark.position.set(36.6, gY - 0.03, -9);
  dark.rotation.y = -Math.PI / 2;
  group.add(dark);

  /* ---------- direction signpost ---------- */
  const post = new THREE.Group();
  post.add(cyl(0.045, 0.045, 3.1, S.poleGrey, 0, 1.55, 0, 10));
  post.add(cyl(0.16, 0.2, 0.12, S.curb, 0, 0.06, 0, 10));
  const boards = [
    ["KANTIN & HALL", "left"],
    ["ASRAMA BLOK A – D", "right"],
    ["KANTOR ASRAMA", "left"]
  ];
  boards.forEach(([text, arrow], i) => {
    const mat = new THREE.MeshStandardMaterial({ map: signBoardTexture(materials, text, arrow), roughness: 0.45, side: THREE.DoubleSide });
    const y = 2.85 - i * 0.34;
    post.add(box(1.34, 0.3, 0.02, S.poleGreen, 0, y, -0.012));
    post.add(card(1.3, 0.285, mat, 0, y, 0.002));
  });
  post.position.set(12.7, gY, 13.1);
  post.rotation.y = -0.35;
  group.add(post);

  /* ---------- street lamps ---------- */
  const nightLights = [];
  const lampPost = (x, z, facing) => {
    const l = new THREE.Group();
    l.add(cyl(0.05, 0.075, 4.6, S.poleGreen, 0, 2.3, 0, 10));
    l.add(cyl(0.11, 0.13, 0.5, S.poleGreen, 0, 0.25, 0, 10));
    l.add(rod([0, 4.55, 0], [0.5, 4.9, 0], 0.03, S.poleGreen, { radial: 6, cast: true }));
    l.add(rod([0.5, 4.9, 0], [1.1, 4.92, 0], 0.03, S.poleGreen, { radial: 6, cast: true }));
    l.add(box(0.56, 0.09, 0.24, S.poleGrey, 1.25, 4.9, 0));
    l.add(box(0.44, 0.02, 0.18, S.lampLens, 1.25, 4.85, 0, { cast: false, receive: false }));
    l.position.set(x, gY, z);
    l.rotation.y = facing;
    group.add(l);
    nightLights.push([x + Math.cos(facing) * 1.25, gY + 4.7, z - Math.sin(facing) * 1.25]);
  };
  lampPost(-14.5, 13.2, Math.PI / 2);
  lampPost(4.5, 13.2, Math.PI / 2);
  lampPost(21.5, 13.2, Math.PI / 2);
  lampPost(29.2, -4.0, Math.PI);
  lampPost(-22.5, -4.0, 0);
  group.userData.nightLights = nightLights;

  /* ---------- grass tufts on the real lawns ---------- */
  if (outdoorGroup) {
    outdoorGroup.updateMatrixWorld(true);
    const grassMeshes = [];
    const blockers = [];
    outdoorGroup.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === materials.grass) grassMeshes.push(o);
      else blockers.push(o);
    });
    // Blade cluster: five tapered blades fanning out
    const blades = 5;
    const pos = [];
    const uv = [];
    const nor = [];
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + 0.4;
      const lean = 0.05 + (b % 3) * 0.03;
      const hgt = 0.75 + (b % 2) * 0.25;
      const cx = Math.cos(a) * 0.03;
      const cz = Math.sin(a) * 0.03;
      const px = -Math.sin(a) * 0.024;
      const pz = Math.cos(a) * 0.024;
      pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean);
      uv.push(0, 0, 1, 0, 0.5, 1);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const tuftGeo = new THREE.BufferGeometry();
    tuftGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    tuftGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    tuftGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    const tuftMat = applyGrassWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), 0.09);

    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    const spots = [];
    const tmpBox = new THREE.Box3();
    // Only compact things that actually stand on the turf count (trunks, bins, kerbs, benches);
    // sprawling meshes and overhanging crowns would wrongly clear whole lawns.
    const lawnBoxes = grassMeshes.map((o) => new THREE.Box3().setFromObject(o));
    const blockerBoxes = blockers
      .map((o) => new THREE.Box3().setFromObject(o))
      .filter((bb) => {
        const footprint = (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z);
        if (footprint > 14) return false;
        return lawnBoxes.some((lb) => bb.intersectsBox(lb) || (bb.min.y < lb.max.y + 0.35 && bb.max.y > lb.max.y + 0.02 && bb.max.x > lb.min.x && bb.min.x < lb.max.x && bb.max.z > lb.min.z && bb.min.z < lb.max.z));
      });
    for (const lawn of grassMeshes) {
      tmpBox.setFromObject(lawn);
      const area = (tmpBox.max.x - tmpBox.min.x) * (tmpBox.max.z - tmpBox.min.z);
      const count = Math.min(9000, Math.round(area * 20));
      const top = tmpBox.max.y;
      for (let i = 0; i < count; i++) {
        const x = tmpBox.min.x + rng() * (tmpBox.max.x - tmpBox.min.x);
        const z = tmpBox.min.z + rng() * (tmpBox.max.z - tmpBox.min.z);
        // Skip anything with a path, curb, wall, bin or trunk standing on this spot
        let blocked = false;
        for (let k = 0; k < blockerBoxes.length; k++) {
          const bb = blockerBoxes[k];
          if (x > bb.min.x - 0.05 && x < bb.max.x + 0.05 && z > bb.min.z - 0.05 && z < bb.max.z + 0.05) {
            // Tree crowns overhang the lawn without touching it: only count things that reach the ground
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        origin.set(x, top + 5, z);
        ray.set(origin, down);
        ray.far = 6;
        const hit = ray.intersectObject(lawn, false)[0];
        if (!hit) continue;
        spots.push([x, hit.point.y, z]);
      }
    }
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, spots.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    spots.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const s = 0.14 + rng() * 0.16;
      dummy.scale.set(s * 2.2, s, s * 2.2);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
      const t = rng();
      col.setRGB(0.1 + t * 0.12, 0.2 + t * 0.14, 0.045 + t * 0.06);
      tufts.setColorAt(i, col);
    });
    tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    tufts.receiveShadow = true;
    tufts.castShadow = false;
    tufts.name = "GrassTufts";
    tufts.userData.noAO = true;
    far.add(tufts);
  }

  /* ---------- ring of distant trees ---------- */
  const farCount = 150;
  const crownMat = applyWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true }), { strength: 0.1, minY: 2.5, maxY: 11, leaf: 2.4 });
  const crowns = new THREE.InstancedMesh(foliageBlob(2, 1), crownMat, farCount * 3);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 6), materials.bark, farCount);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < farCount && guard++ < 4000) {
    const angle = rng() * Math.PI * 2;
    const radius = 36 + Math.pow(rng(), 0.7) * 120;
    const x = 4 + Math.cos(angle) * radius;
    const z = -3 + Math.sin(angle) * radius * 0.9;
    if (x > -27 && x < 33 && z > -29 && z < 23.5) continue; // the site itself
    if (z > 22.4 && z < 32.4) continue; // south road and footpath
    if (x > 34.5 && x < 42.8 && z < 32) continue; // east road
    if (footprints.some((f) => Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz)) continue;
    const h = 3.2 + rng() * 3.4;
    const s = 2.2 + rng() * 2.2;
    dummy.position.set(x, gY - 0.1 + h / 2, z);
    dummy.rotation.set(0, rng() * 6.28, (rng() - 0.5) * 0.08);
    dummy.scale.set(1 + rng() * 0.6, h, 1 + rng() * 0.6);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      dummy.position.set(x + (rng() - 0.5) * s * 0.9, gY + h + s * (0.25 + k * 0.22) + (rng() - 0.5) * 0.6, z + (rng() - 0.5) * s * 0.9);
      dummy.rotation.set(rng() * 0.5, rng() * 6.28, rng() * 0.5);
      const cs = s * (0.75 + rng() * 0.45) * (k === 2 ? 0.75 : 1);
      dummy.scale.set(cs * (1 + rng() * 0.25), cs * (0.72 + rng() * 0.2), cs * (1 + rng() * 0.25));
      dummy.updateMatrix();
      crowns.setMatrixAt(placed * 3 + k, dummy.matrix);
      const t = rng();
      col.setRGB(0.2 + t * 0.2, 0.42 + t * 0.22, 0.14 + t * 0.12);
      crowns.setColorAt(placed * 3 + k, col);
    }
    placed++;
  }
  crowns.count = placed * 3;
  trunks.count = placed;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  crowns.castShadow = false;
  crowns.receiveShadow = false;
  crowns.name = "DistantCrowns";
  trunks.name = "DistantTrunks";
  far.add(crowns, trunks);

  /* ---------- a few birds wheeling over the roofs ---------- */
  const flock = new THREE.Group();
  flock.name = "Birds";
  markDynamic(flock);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.08, 0, 0, -0.1, 0.42, 0, -0.04], 3));
  wingGeo.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const bird = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, S.bird);
    const r = new THREE.Mesh(wingGeo, S.bird);
    r.scale.x = -1;
    bird.add(l, r);
    flock.add(bird);
    birds.push({ bird, l, r, radius: 16 + rng() * 22, speed: 0.16 + rng() * 0.1, phase: rng() * 6.28, y: 15 + rng() * 9, cx: -4 + rng() * 16, cz: -4 + rng() * 10, flap: 7 + rng() * 4 });
  }
  registerAnimator((time) => {
    for (const b of birds) {
      const a = time * b.speed + b.phase;
      b.bird.position.set(b.cx + Math.cos(a) * b.radius, b.y + Math.sin(a * 2.3) * 1.2, b.cz + Math.sin(a) * b.radius * 0.8);
      b.bird.rotation.y = -a + Math.PI;
      const glide = Math.sin(time * 0.4 + b.phase) > 0.55 ? 0.15 : 1;
      const f = Math.sin(time * b.flap + b.phase) * 0.75 * glide;
      b.l.rotation.z = f;
      b.r.rotation.z = -f;
      b.bird.rotation.z = 0.25;
    }
  });
  far.add(flock);

  far.traverse((o) => o.layers.set(1));
  return group;
}
