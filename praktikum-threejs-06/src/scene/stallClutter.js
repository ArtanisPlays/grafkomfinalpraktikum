import * as THREE from "three";
import { box, cyl, rod, card, flatMat, decalMat } from "./geomUtils.js";
import { createRng } from "./noise.js";

/**
 * Everything that makes the three food stalls look like they are trading:
 * strip lights, cooking gear, fridges, stock on shelves, sachet strips hanging off the
 * header, plates, cups, fruit, calendars, plus the stools customers perch on outside.
 */

function sachetStripTexture(materials, seed, palette) {
  return materials.createCanvasTexture(
    64,
    512,
    (ctx, w, h) => {
      const rng = createRng(seed);
      const n = 10;
      const sh = h / n;
      for (let i = 0; i < n; i++) {
        const y = i * sh;
        const col = palette[Math.floor(rng() * palette.length)];
        ctx.fillStyle = col;
        ctx.fillRect(6, y + 3, w - 12, sh - 6);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(12, y + 10, w - 24, 9);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(w / 2, y + sh * 0.62, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(6, y + 3, 5, sh - 6);
      }
    },
    { transparent: true }
  );
}

function calendarTexture(materials) {
  return materials.createCanvasTexture(256, 360, (ctx, w, h) => {
    ctx.fillStyle = "#fdfdfb";
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 150);
    g.addColorStop(0, "#1c6fb5");
    g.addColorStop(1, "#58b368");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BANK JATIM", w / 2, 60);
    ctx.font = "bold 40px Arial";
    ctx.fillText("2026", w / 2, 112);
    ctx.fillStyle = "#b91c1c";
    ctx.font = "bold 22px Arial";
    ctx.fillText("NOVEMBER", w / 2, 182);
    ctx.font = "15px Arial";
    let day = 1;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        if (day > 30) break;
        ctx.fillStyle = c === 0 ? "#b91c1c" : "#1f2937";
        ctx.fillText(String(day), 30 + c * 33, 216 + r * 30);
        day++;
      }
    }
  });
}

function menuCardTexture(materials, seed, bg, items) {
  return materials.createCanvasTexture(180, 256, (ctx, w, h) => {
    const rng = createRng(seed);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `hsl(${Math.floor(rng() * 50) + 15}, 70%, 45%)`;
    ctx.beginPath();
    ctx.arc(w / 2, 78, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${Math.floor(rng() * 60) + 60}, 60%, 50%)`;
    ctx.beginPath();
    ctx.arc(w / 2 + 18, 70, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.font = "bold 20px Arial";
    ctx.fillText(items[0], w / 2, 166);
    ctx.fillStyle = "#b91c1c";
    ctx.font = "bold 30px Arial";
    ctx.fillText(items[1], w / 2, 206);
    ctx.fillStyle = "#374151";
    ctx.font = "13px Arial";
    ctx.fillText(items[2] || "", w / 2, 234);
  });
}

function fridgeFrontTexture(materials) {
  return materials.createCanvasTexture(256, 640, (ctx, w, h) => {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, w, h);
    const rng = createRng(31);
    const rows = 5;
    const rowH = (h - 40) / rows;
    const colours = ["#e0312b", "#1f8f4a", "#f2b01e", "#2a6fc9", "#f4f4f0", "#e86a1c", "#7b3fa0", "#35b8c9"];
    for (let r = 0; r < rows; r++) {
      const y0 = 20 + r * rowH;
      ctx.fillStyle = "rgba(210,225,235,0.9)";
      ctx.fillRect(8, y0 + rowH - 8, w - 16, 6);
      const col = colours[Math.floor(rng() * colours.length)];
      const col2 = colours[Math.floor(rng() * colours.length)];
      for (let i = 0; i < 9; i++) {
        const x = 14 + i * 26;
        const bh = rowH * (0.55 + rng() * 0.2);
        ctx.fillStyle = i < 5 ? col : col2;
        ctx.fillRect(x, y0 + rowH - 8 - bh, 20, bh);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x, y0 + rowH - 8 - bh * 0.62, 20, bh * 0.24);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x + 2, y0 + rowH - 8 - bh, 4, bh);
        ctx.fillStyle = "#e5e7eb";
        ctx.fillRect(x + 5, y0 + rowH - 14 - bh, 10, 7);
      }
    }
  });
}

function plasticStool(M, colour) {
  const s = new THREE.Group();
  s.add(box(0.3, 0.03, 0.3, colour, 0, 0.44, 0));
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ]) {
    s.add(rod([sx * 0.12, 0.43, sz * 0.12], [sx * 0.17, 0, sz * 0.17], 0.018, colour, { radial: 5, cast: true }));
  }
  s.add(box(0.3, 0.03, 0.02, colour, 0, 0.2, 0.15, { cast: false }));
  s.add(box(0.3, 0.03, 0.02, colour, 0, 0.2, -0.15, { cast: false }));
  s.add(box(0.02, 0.03, 0.3, colour, 0.15, 0.2, 0, { cast: false }));
  s.add(box(0.02, 0.03, 0.3, colour, -0.15, 0.2, 0, { cast: false }));
  return s;
}

function lpgCylinder(M) {
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.13, 0.03, M.lpgGreen, 0, 0.015, 0, 14));
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M.lpgGreen);
  body.scale.set(1, 0.92, 1);
  body.position.y = 0.17;
  body.castShadow = true;
  g.add(body);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 14, 1, true), M.lpgGreen);
  collar.position.y = 0.345;
  g.add(collar);
  g.add(cyl(0.02, 0.025, 0.05, M.brass, 0, 0.33, 0, 8));
  return g;
}

function standingFan(M) {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.22, 0.03, M.dark, 0, 0.015, 0, 18));
  g.add(rod([0, 0.03, 0], [0, 1.15, 0], 0.016, M.dark, { radial: 8, cast: true }));
  g.add(cyl(0.05, 0.06, 0.13, M.dark, 0, 1.2, -0.04, 12));
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 22), M.dark);
  cage.position.set(0, 1.22, 0.06);
  g.add(cage);
  const cage2 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.005, 5, 18), M.dark);
  cage2.position.set(0, 1.22, 0.08);
  g.add(cage2);
  for (let i = 0; i < 8; i++) {
    const sp = box(0.4, 0.004, 0.004, M.dark, 0, 1.22, 0.075, { cast: false });
    sp.rotation.z = (i * Math.PI) / 8;
    g.add(sp);
  }
  for (let b = 0; b < 3; b++) {
    const a = (b * Math.PI * 2) / 3;
    const blade = box(0.07, 0.16, 0.005, M.fanBlade, Math.cos(a) * 0.09, 1.22 + Math.sin(a) * 0.09, 0.04, { cast: false });
    blade.rotation.z = a - Math.PI / 2;
    g.add(blade);
  }
  return g;
}

export function createStallClutter(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "StallClutter";
  const glow = materials.registerNightGlow || ((m) => m);
  const { stalls } = layoutSpec;
  const backZ = stalls.backWallZ;
  const frontZ = stalls.frontCounterZ;
  const top = stalls.counterHeight;
  const rng = createRng(1717);

  const M = {
    dark: flatMat(0x1b1e22, { roughness: 0.55, metalness: 0.3 }),
    white: flatMat(0xeeeeea, { roughness: 0.5 }),
    appliance: flatMat(0xe9e9e4, { roughness: 0.45, metalness: 0.05 }),
    alu: flatMat(0xbfc4c8, { roughness: 0.35, metalness: 0.8 }),
    aluDull: flatMat(0xa9adb0, { roughness: 0.55, metalness: 0.7 }),
    wokBlack: flatMat(0x18181a, { roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }),
    lpgGreen: flatMat(0x5fb04a, { roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }),
    brass: flatMat(0xb8963c, { roughness: 0.4, metalness: 0.8 }),
    fanBlade: flatMat(0x4a6fb0, { roughness: 0.4 }),
    plate: flatMat(0xf5f3ec, { roughness: 0.25 }),
    bowlBlue: flatMat(0x3f7fc0, { roughness: 0.35 }),
    paperBrown: flatMat(0xb98e5c, { roughness: 0.9 }),
    plasticBag: new THREE.MeshStandardMaterial({ color: 0xf3f3f0, roughness: 0.3, transparent: true, opacity: 0.8 }),
    clearTin: new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.1, transparent: true, opacity: 0.45, envMapIntensity: 1.6 }),
    kerupuk: flatMat(0xf2e3c0, { roughness: 0.9 }),
    lidRed: flatMat(0xc8281f, { roughness: 0.4 }),
    lidBlue: flatMat(0x2760b8, { roughness: 0.4 }),
    friedGold: flatMat(0xc98a2e, { roughness: 0.85 }),
    friedDark: flatMat(0xa8651f, { roughness: 0.85 }),
    sambal: flatMat(0xa8261a, { roughness: 0.5 }),
    greens: flatMat(0x4f8a35, { roughness: 0.8 }),
    tempe: flatMat(0xb98a4a, { roughness: 0.85 }),
    egg: flatMat(0xe9c24a, { roughness: 0.7 }),
    curry: flatMat(0xc98a1c, { roughness: 0.5 }),
    rice: flatMat(0xf4f1e4, { roughness: 0.95 }),
    warmerOrange: flatMat(0xd9722a, { roughness: 0.4 }),
    cupClear: new THREE.MeshStandardMaterial({ color: 0xf2f6f7, roughness: 0.08, transparent: true, opacity: 0.5, envMapIntensity: 1.8 }),
    jar: new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: 0.05, transparent: true, opacity: 0.4, envMapIntensity: 2 }),
    juiceOrange: flatMat(0xf08a1c, { roughness: 0.3 }),
    juiceGreen: flatMat(0x8fbf4a, { roughness: 0.3 }),
    juicePink: flatMat(0xd9488f, { roughness: 0.3 }),
    syrupRed: flatMat(0xb8141f, { roughness: 0.2 }),
    syrupGreen: flatMat(0x2f9a4a, { roughness: 0.2 }),
    milkTin: flatMat(0xf1efe6, { roughness: 0.3, metalness: 0.4 }),
    orange: flatMat(0xf0921e, { roughness: 0.6 }),
    avocado: flatMat(0x3d5a26, { roughness: 0.6 }),
    dragon: flatMat(0xd0346f, { roughness: 0.6 }),
    banana: flatMat(0xe9cf3a, { roughness: 0.6 }),
    coolerOrange: flatMat(0xe2661c, { roughness: 0.5 }),
    stoolRed: flatMat(0xc62a2a, { roughness: 0.42 }),
    stoolBlue: flatMat(0x2a5fb4, { roughness: 0.42 }),
    stoolGreen: flatMat(0x2f8a52, { roughness: 0.42 }),
    woodShelf: materials.lightWood,
    batten: flatMat(0xe9e9e4, { roughness: 0.5 }),
    tube: glow(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.4, roughness: 0.3 }), 2.4, 4.2),
    fridgeGlow: glow(new THREE.MeshStandardMaterial({ map: fridgeFrontTexture(materials), emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.25 }), 0.0, 0.0),
    calendar: decalMat(calendarTexture(materials), { roughness: 0.6 }),
    sachetsCoffee: new THREE.MeshStandardMaterial({
      map: sachetStripTexture(materials, 3, ["#7a3b12", "#c8281f", "#1f6fb5", "#e0a11a", "#3a2a20", "#1f8f4a"]),
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.35
    }),
    sachetsSnack: new THREE.MeshStandardMaterial({
      map: sachetStripTexture(materials, 9, ["#e86a1c", "#f2c21a", "#d9488f", "#35b8c9", "#7b3fa0", "#e0312b"]),
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.35
    })
  };
  // The fridge front glows from its own texture
  M.fridgeGlow.emissiveMap = M.fridgeGlow.map;
  M.fridgeGlow.emissiveIntensity = 0.85;

  const booth = Object.fromEntries(stalls.booths.map((b) => [b.id, b]));

  /* ---------- common to every booth ---------- */

  for (const b of stalls.booths) {
    const cx = (b.minX + b.maxX) / 2;
    // Twin fluorescent batten on the soffit
    for (const z of [-4.0, -5.6]) {
      group.add(box(1.24, 0.045, 0.1, M.batten, cx, 3.105, z, { cast: false }));
      const tube = cyl(0.014, 0.014, 1.18, M.tube, cx, 3.07, z, 8, { cast: false, receive: false });
      tube.rotation.z = Math.PI / 2;
      group.add(tube);
    }
    // Calendar on the east partition, a bag of plastic bags on a nail
    group.add(card(0.3, 0.42, M.calendar, b.maxX - 0.066, 1.65, -5.0 - rng() * 0.6, -Math.PI / 2));
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M.plasticBag);
    bag.scale.set(0.6, 1.2, 1);
    bag.position.set(b.minX + 0.1, 1.5, -4.2 - rng() * 0.4);
    group.add(bag);
  }

  /* ---------- ExSoe: fried chicken ---------- */
  {
    const b = booth.exsoe;
    const cx = (b.minX + b.maxX) / 2;

    // Chicken in the warmer, on two shelves
    for (const [sy, n] of [
      [0.07, 9],
      [0.36, 7]
    ]) {
      for (let i = 0; i < n; i++) {
        const piece = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + rng() * 0.02, 0), rng() < 0.5 ? M.friedGold : M.friedDark);
        piece.scale.set(1.2, 0.7, 0.9);
        piece.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        piece.position.set(cx + 0.35 - 0.36 + (i / (n - 1)) * 0.72, top + sy, frontZ - 0.28 + (rng() - 0.5) * 0.2);
        group.add(piece);
      }
    }

    // Takeaway boxes, paper wraps and a calculator on the counter
    for (let i = 0; i < 6; i++) {
      const bx = box(0.2, 0.045, 0.14, i % 2 ? M.paperBrown : M.white, b.maxX - 0.42 + (rng() - 0.5) * 0.02, top + 0.023 + i * 0.045, frontZ - 0.26 + (rng() - 0.5) * 0.02);
      bx.rotation.y = (rng() - 0.5) * 0.2;
      group.add(bx);
    }
    group.add(box(0.1, 0.02, 0.15, M.dark, b.minX + 1.25, top + 0.01, frontZ - 0.18, { cast: false }));
    group.add(box(0.26, 0.09, 0.3, M.dark, b.minX + 1.25, top + 0.045, frontZ - 0.42));
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.paperBrown);
      wrap.scale.set(1.2, 0.6, 0.9);
      wrap.position.set(b.minX + 1.75 + (i % 3) * 0.13, top + 0.04 + Math.floor(i / 3) * 0.06, frontZ - 0.4 + (rng() - 0.5) * 0.05);
      group.add(wrap);
    }

    // Twin-basket deep fryer on the back prep counter, oil bottle, flour tub
    const fx = b.maxX - 1.25;
    const fz = backZ + 0.45;
    group.add(box(0.5, 0.26, 0.42, M.alu, fx, 0.78 + 0.13, fz));
    for (const s of [-0.12, 0.12]) {
      group.add(box(0.19, 0.02, 0.3, M.friedGold, fx + s, 1.045, fz, { cast: false }));
      group.add(rod([fx + s, 1.05, fz + 0.12], [fx + s, 1.12, fz + 0.3], 0.008, M.dark, { radial: 5 }));
    }
    group.add(cyl(0.01, 0.01, 0.03, M.lidRed, fx - 0.18, 0.86, fz + 0.215, 6));
    group.add(cyl(0.045, 0.045, 0.24, M.juiceOrange, fx + 0.4, 0.9, fz + 0.1, 10));
    group.add(cyl(0.11, 0.1, 0.16, M.white, b.maxX - 0.2, 0.86, fz - 0.05, 12));

    // Chest freezer on the west side with a stack of trays on top
    group.add(box(0.62, 0.84, 0.95, M.appliance, b.minX + 0.42, 0.42, backZ + 0.62));
    group.add(box(0.63, 0.04, 0.96, M.white, b.minX + 0.42, 0.86, backZ + 0.62));
    group.add(box(0.44, 0.06, 0.3, M.alu, b.minX + 0.42, 0.91, backZ + 0.55));
    group.add(box(0.14, 0.05, 0.01, M.dark, b.minX + 0.74, 0.3, backZ + 0.3, { cast: false }));

    // Gas bottle and hose
    const lpg = lpgCylinder(M);
    lpg.position.set(b.maxX - 1.72, 0, backZ + 1.0);
    group.add(lpg);
    group.add(rod([b.maxX - 1.72, 0.36, backZ + 1.0], [fx - 0.2, 0.74, fz + 0.2], 0.008, M.dark, { radial: 5 }));

    // Hanging menu cards under the header
    const menu = [
      ["Paket Nasi 1", "12K", "ayam + nasi + teh"],
      ["Hot Spicy", "15K", "pedas level 1-5"],
      ["Chicken Chop", "18K", "saus lada hitam"]
    ];
    menu.forEach((m, i) => {
      const mat = decalMat(menuCardTexture(materials, 40 + i, "#fff8e6", m), { roughness: 0.45, side: THREE.DoubleSide });
      const x = b.minX + 1.5 + i * 0.75;
      group.add(card(0.21, 0.3, mat, x, 2.02, frontZ - 0.04));
      group.add(rod([x, 2.17, frontZ - 0.04], [x, 2.26, frontZ - 0.04], 0.002, M.dark, { radial: 3 }));
    });
  }

  /* ---------- WARAS: rice dishes ---------- */
  {
    const b = booth.waras;

    // Side dishes in the glass case
    const dishMats = [M.sambal, M.greens, M.tempe, M.egg, M.curry, M.friedGold];
    for (const [sy, n] of [
      [0.03, 3],
      [0.3, 3]
    ]) {
      for (let i = 0; i < n; i++) {
        const x = b.minX + 0.75 - 0.22 + i * 0.22;
        group.add(cyl(0.09, 0.07, 0.05, M.alu, x, top + sy + 0.025, frontZ - 0.28, 12));
        group.add(cyl(0.08, 0.08, 0.02, dishMats[(i + (sy > 0.1 ? 3 : 0)) % dishMats.length], x, top + sy + 0.052, frontZ - 0.28, 10, { cast: false }));
      }
    }

    // Counter: kerupuk tin, plates, cutlery jar, rice warmer
    const kx = b.minX + 1.75;
    group.add(box(0.24, 0.3, 0.24, M.clearTin, kx, top + 0.15, frontZ - 0.3, { cast: false }));
    group.add(box(0.2, 0.2, 0.2, M.kerupuk, kx, top + 0.11, frontZ - 0.3, { cast: false }));
    group.add(box(0.25, 0.03, 0.25, M.lidRed, kx, top + 0.315, frontZ - 0.3));
    for (let i = 0; i < 12; i++) group.add(cyl(0.11, 0.07, 0.01, M.plate, b.minX + 2.1, top + 0.006 + i * 0.011, frontZ - 0.3, 16));
    group.add(cyl(0.05, 0.045, 0.13, M.alu, b.minX + 2.32, top + 0.065, frontZ - 0.18, 10));
    for (let i = 0; i < 6; i++) {
      group.add(rod([b.minX + 2.32, top + 0.1, frontZ - 0.18], [b.minX + 2.32 + (rng() - 0.5) * 0.05, top + 0.22, frontZ - 0.18 + (rng() - 0.5) * 0.05], 0.004, M.alu, { radial: 4 }));
    }
    group.add(cyl(0.19, 0.17, 0.28, M.warmerOrange, b.maxX - 1.25, top + 0.14, frontZ - 0.32, 18));
    group.add(cyl(0.2, 0.2, 0.03, M.white, b.maxX - 1.25, top + 0.295, frontZ - 0.32, 18));
    group.add(cyl(0.025, 0.03, 0.03, M.dark, b.maxX - 1.25, top + 0.325, frontZ - 0.32, 8));

    // Cooking bench along the west partition: two-burner stove, wok, stock pot, kettle
    const tx = b.minX + 0.44;
    const tz = -5.25;
    group.add(box(0.6, 0.03, 1.4, M.alu, tx, 0.78, tz));
    group.add(box(0.56, 0.02, 1.36, M.aluDull, tx, 0.3, tz, { cast: false }));
    for (const sx of [-0.27, 0.27]) for (const sz of [-0.67, 0.67]) group.add(box(0.035, 0.78, 0.035, M.aluDull, tx + sx, 0.39, tz + sz));
    group.add(box(0.36, 0.1, 0.68, M.alu, tx, 0.85, tz - 0.2));
    for (const sz of [-0.37, -0.03]) {
      group.add(cyl(0.1, 0.1, 0.02, M.dark, tx, 0.91, tz + sz, 12, { cast: false }));
    }
    const wok = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.wokBlack);
    wok.scale.set(1, 0.5, 1);
    wok.position.set(tx, 1.02, tz - 0.37);
    wok.castShadow = true;
    group.add(wok);
    group.add(rod([tx + 0.18, 1.01, tz - 0.37], [tx + 0.4, 1.05, tz - 0.3], 0.012, M.dark, { radial: 5 }));
    group.add(cyl(0.15, 0.15, 0.02, M.rice, tx, 0.985, tz - 0.37, 12, { cast: false }));
    group.add(cyl(0.14, 0.14, 0.2, M.aluDull, tx, 1.02, tz - 0.03, 16));
    group.add(cyl(0.145, 0.145, 0.015, M.alu, tx, 1.125, tz - 0.03, 16));
    group.add(cyl(0.09, 0.11, 0.15, M.alu, tx + 0.03, 0.87, tz + 0.45, 12));
    group.add(rod([tx + 0.11, 0.9, tz + 0.45], [tx + 0.2, 0.96, tz + 0.45], 0.012, M.alu, { radial: 5 }));
    const lpg = lpgCylinder(M);
    lpg.position.set(tx + 0.05, 0.31, tz + 0.2);
    group.add(lpg);
    // Bowls + seasoning bottles on the bench
    group.add(cyl(0.07, 0.04, 0.05, M.bowlBlue, tx - 0.12, 0.82, tz + 0.6, 10));
    for (let i = 0; i < 4; i++) group.add(cyl(0.025, 0.028, 0.16, [M.sambal, M.dark, M.syrupGreen, M.juiceOrange][i], tx + 0.18, 0.875, tz + 0.22 + i * 0.07, 8));

    // Shelf of stock on the back wall
    const shelfX = b.maxX - 0.9;
    group.add(box(1.3, 0.025, 0.24, M.woodShelf, shelfX, 1.6, backZ + 0.27));
    for (const sx of [-0.55, 0.55]) group.add(box(0.02, 0.18, 0.2, M.dark, shelfX + sx, 1.5, backZ + 0.25, { cast: false }));
    for (let i = 0; i < 8; i++) {
      const h = 0.12 + rng() * 0.12;
      const mats = [M.jar, M.milkTin, M.lidRed, M.syrupGreen, M.paperBrown, M.jar];
      group.add(cyl(0.045, 0.045, h, mats[Math.floor(rng() * mats.length)], shelfX - 0.55 + i * 0.155, 1.613 + h / 2, backZ + 0.27, 10));
    }

    const fan = standingFan(M);
    fan.position.set(b.maxX - 0.42, 0, backZ + 0.5);
    fan.rotation.y = -0.6;
    group.add(fan);

    // Snack strips hanging from the header on the customer side
    for (let i = 0; i < 4; i++) {
      const x = b.minX + 0.5 + i * 0.16;
      group.add(card(0.09, 0.85, M.sachetsSnack, x, 1.82, frontZ + 0.03 + (i % 2) * 0.012));
    }
  }

  /* ---------- Kedai Minuman: drinks ---------- */
  {
    const b = booth.kedai;

    // Two blenders, one mid-juice
    for (const [x, juice] of [
      [b.minX + 2.55, M.juiceGreen],
      [b.minX + 2.82, M.juiceOrange]
    ]) {
      const z = frontZ - 0.34;
      group.add(cyl(0.075, 0.085, 0.14, M.white, x, top + 0.07, z, 12));
      group.add(cyl(0.065, 0.05, 0.2, M.jar, x, top + 0.24, z, 12, { cast: false }));
      group.add(cyl(0.055, 0.045, 0.11, juice, x, top + 0.2, z, 10, { cast: false }));
      group.add(cyl(0.068, 0.068, 0.02, M.dark, x, top + 0.35, z, 12));
    }

    // Towers of plastic cups, a jar of straws, sealed-cup lids
    for (const x of [b.minX + 1.02, b.minX + 1.12]) {
      for (let i = 0; i < 14; i++) group.add(cyl(0.04, 0.03, 0.02, M.cupClear, x, top + 0.16 + i * 0.022, frontZ - 0.36, 10, { cast: false }));
    }
    group.add(cyl(0.035, 0.035, 0.16, M.jar, b.minX + 0.98, top + 0.08, frontZ - 0.12, 10, { cast: false }));
    for (let i = 0; i < 9; i++) {
      const col = [M.lidRed, M.juiceGreen, M.lidBlue, M.juicePink][i % 4];
      group.add(rod([b.minX + 0.98, top + 0.02, frontZ - 0.12], [b.minX + 0.98 + (rng() - 0.5) * 0.05, top + 0.25, frontZ - 0.12 + (rng() - 0.5) * 0.05], 0.003, col, { radial: 4 }));
    }

    // Fruit: a net of oranges hung from the header, avocados and dragon fruit in a basket
    const nx = b.maxX - 0.7;
    group.add(rod([nx, 2.25, frontZ - 0.1], [nx, 1.98, frontZ - 0.1], 0.003, M.dark, { radial: 3 }));
    for (let i = 0; i < 9; i++) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), M.orange);
      o.position.set(nx + (rng() - 0.5) * 0.1, 1.94 - Math.floor(i / 3) * 0.075, frontZ - 0.1 + (rng() - 0.5) * 0.1);
      o.castShadow = true;
      group.add(o);
    }
    const bx = b.maxX - 0.28;
    group.add(cyl(0.16, 0.12, 0.08, M.paperBrown, bx, top + 0.04, frontZ - 0.14, 14));
    for (let i = 0; i < 7; i++) {
      const isDragon = i > 4;
      const f = new THREE.Mesh(new THREE.SphereGeometry(isDragon ? 0.05 : 0.04, 10, 8), isDragon ? M.dragon : i % 2 ? M.avocado : M.banana);
      f.scale.set(1, isDragon ? 1.25 : 1.3, 1);
      f.rotation.z = rng() * 1.5;
      f.position.set(bx + (rng() - 0.5) * 0.2, top + 0.1 + rng() * 0.03, frontZ - 0.14 + (rng() - 0.5) * 0.16);
      group.add(f);
    }

    // Glass-door display fridge at the back, cooler box, syrup shelf, condensed-milk tins
    const fx = b.maxX - 0.42;
    const fz = backZ + 0.42;
    group.add(box(0.62, 1.86, 0.6, M.appliance, fx, 0.93, fz));
    group.add(box(0.52, 1.5, 0.012, M.fridgeGlow, fx, 0.98, fz + 0.304, { cast: false }));
    group.add(box(0.54, 1.52, 0.012, materials.clearGlass, fx, 0.98, fz + 0.315, { cast: false }));
    group.add(box(0.02, 0.5, 0.03, M.alu, fx - 0.24, 1.0, fz + 0.335, { cast: false }));
    group.add(box(0.6, 0.2, 0.012, M.lidRed, fx, 1.75, fz + 0.305, { cast: false }));

    group.add(box(0.55, 0.36, 0.36, M.coolerOrange, b.minX + 1.5, 0.18, -4.5));
    group.add(box(0.57, 0.05, 0.38, M.white, b.minX + 1.5, 0.385, -4.5));

    const sx0 = b.minX + 2.2;
    group.add(box(1.1, 0.025, 0.22, M.woodShelf, sx0, 1.55, backZ + 0.26));
    for (let i = 0; i < 7; i++) {
      const mats = [M.syrupRed, M.syrupGreen, M.juiceOrange, M.syrupRed, M.milkTin, M.milkTin, M.juicePink];
      const tin = i === 4 || i === 5;
      group.add(cyl(tin ? 0.04 : 0.032, tin ? 0.04 : 0.036, tin ? 0.1 : 0.26, mats[i], sx0 - 0.45 + i * 0.15, 1.563 + (tin ? 0.05 : 0.13), backZ + 0.26, 10));
    }

    // Work table behind the counter with a water boiler and sugar jar
    group.add(box(0.9, 0.03, 0.5, M.alu, b.minX + 2.9, 0.8, -4.6));
    for (const dx of [-0.42, 0.42]) for (const dz of [-0.22, 0.22]) group.add(box(0.03, 0.8, 0.03, M.aluDull, b.minX + 2.9 + dx, 0.4, -4.6 + dz));
    group.add(cyl(0.12, 0.12, 0.3, M.alu, b.minX + 3.1, 0.965, -4.6, 14));
    group.add(cyl(0.125, 0.125, 0.03, M.dark, b.minX + 3.1, 1.125, -4.6, 14));
    group.add(cyl(0.07, 0.07, 0.16, M.jar, b.minX + 2.7, 0.895, -4.55, 12, { cast: false }));
    group.add(cyl(0.062, 0.062, 0.1, M.rice, b.minX + 2.7, 0.87, -4.55, 10, { cast: false }));
    group.add(cyl(0.072, 0.072, 0.02, M.lidRed, b.minX + 2.7, 0.985, -4.55, 12));

    // Coffee sachet strips all along the header
    for (let i = 0; i < 9; i++) {
      const x = b.minX + 1.35 + i * 0.17;
      group.add(card(0.09, 0.82, i % 3 === 2 ? M.sachetsSnack : M.sachetsCoffee, x, 1.83, frontZ + 0.03 + (i % 2) * 0.012));
    }
  }

  /* ---------- customer side: stools and a queue rope of tape ---------- */
  const stoolSpots = [
    [-7.9, -2.55, M.stoolRed],
    [-6.2, -2.6, M.stoolRed],
    [-4.4, -2.5, M.stoolBlue],
    [-3.6, -2.62, M.stoolRed],
    [0.3, -2.55, M.stoolGreen],
    [1.2, -2.6, M.stoolRed]
  ];
  for (const [x, z, colour] of stoolSpots) {
    const s = plasticStool(M, colour);
    s.position.set(x, 0, z);
    s.rotation.y = rng() * 1.5;
    group.add(s);
  }

  return group;
}
