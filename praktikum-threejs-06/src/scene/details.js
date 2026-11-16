import * as THREE from "three";
import { box, cyl, rod, card, floorDecal, columnWrap, slopedBarZ, flatMat, decalMat } from "./geomUtils.js";
import { createRng } from "./noise.js";
import { getStairMetrics } from "./layoutSpec.js";
import { registerAnimator, markDynamic } from "./animation.js";

/**
 * Architectural wear, wiring, signage and housekeeping clutter.
 *
 * Everything the photos show that is not "structure" or "furniture": roof trim and gutters,
 * exposed conduit and floodlights, the half-finished ceiling above the skylight slot,
 * stickers on the columns, the boarded-up transoms of the office, the cleaning corner by the
 * stairs, tape and stains on the floor.
 */

/* ------------------------------------------------------------------ */
/* Shared geometry helpers                                             */
/* ------------------------------------------------------------------ */

function roofYA(z) {
  if (z >= 3.5) return 3.15 + ((8.5 - z) / 5.0) * (5.45 - 3.15);
  if (z >= -1.8) return 5.45 + ((3.5 - z) / 5.3) * (7.0 - 5.45);
  return 7.0 + ((-1.8 - z) / 4.7) * (7.45 - 7.0);
}

function roofYB(x, z) {
  const ridgeX = 15.5;
  const ridgeY = 6.4;
  if (x >= ridgeX) return ridgeY + ((x - ridgeX) / 6.0) * (4.85 - ridgeY);
  const westEaveY = z <= -6.5 ? 4.85 + Math.max(0, (z + 14.2) / 7.7) * (6.2 - 4.85) : 6.2;
  return ridgeY + ((ridgeX - x) / 4.0) * (westEaveY - ridgeY);
}

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

function textures(materials) {
  const make = materials.createCanvasTexture;

  const evacuation = make(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0b7a43";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#ffffff";
    // Arrow
    ctx.beginPath();
    ctx.moveTo(52, 92);
    ctx.lineTo(120, 40);
    ctx.lineTo(120, 72);
    ctx.lineTo(200, 72);
    ctx.lineTo(200, 112);
    ctx.lineTo(120, 112);
    ctx.lineTo(120, 144);
    ctx.closePath();
    ctx.fill();
    // Running figure
    ctx.beginPath();
    ctx.arc(292, 52, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(286, 76);
    ctx.lineTo(268, 116);
    ctx.lineTo(244, 140);
    ctx.moveTo(268, 116);
    ctx.lineTo(300, 138);
    ctx.moveTo(280, 86);
    ctx.lineTo(250, 92);
    ctx.moveTo(284, 86);
    ctx.lineTo(318, 100);
    ctx.stroke();
    // Door
    ctx.lineWidth = 8;
    ctx.strokeRect(360, 34, 90, 116);
    ctx.font = "bold 44px Arial";
    ctx.textAlign = "center";
    ctx.fillText("JALUR EVAKUASI", w / 2, 212);
  });

  const noSmoking = make(256, 320, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c81e1e";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(w / 2, 118, 82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(74, 108, 92, 20);
    ctx.fillStyle = "#b45309";
    ctx.fillRect(166, 108, 16, 20);
    ctx.beginPath();
    ctx.moveTo(70, 60);
    ctx.lineTo(186, 176);
    ctx.stroke();
    ctx.fillStyle = "#c81e1e";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText("KAWASAN", w / 2, 242);
    ctx.fillText("TANPA ROKOK", w / 2, 274);
    ctx.fillStyle = "#374151";
    ctx.font = "13px Arial";
    ctx.fillText("Asrama Mahasiswa ITS", w / 2, 300);
  });

  const beberes = make(256, 360, (ctx, w, h) => {
    ctx.fillStyle = "#fdfdfb";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BUDAYAKAN", w / 2, 36);
    ctx.fillStyle = "#b91c1c";
    ctx.font = "bold 40px Arial";
    ctx.fillText("BEBERES", w / 2, 112);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 23px Arial";
    ctx.fillText("SETELAH MAKAN !!", w / 2, 150);
    // Plate + cutlery pictogram
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, 232, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, 232, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#374151";
    ctx.font = "15px Arial";
    ctx.fillText("Kembalikan piring & gelas", w / 2, 314);
    ctx.fillText("ke penjual. Terima kasih!", w / 2, 334);
  });

  const wifi = make(256, 180, (ctx, w, h) => {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f3d7a";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("FREE Wi-Fi", w / 2, 44);
    ctx.strokeStyle = "#0f3d7a";
    ctx.lineWidth = 7;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, 118, i * 16, Math.PI * 1.22, Math.PI * 1.78);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(w / 2, 118, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 17px Arial";
    ctx.fillText("ITS-Asrama  ·  myITS SSO", w / 2, 158);
  });

  // A handful of different A4 notices
  const notice = (seed, accent, headline) =>
    make(180, 256, (ctx, w, h) => {
      const rng = createRng(seed);
      ctx.fillStyle = "#fbfbf8";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(12, 12, w - 24, 34);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px Arial";
      ctx.textAlign = "center";
      ctx.fillText(headline, w / 2, 36);
      ctx.fillStyle = "#374151";
      for (let y = 66; y < h - 40; y += 13) {
        if (rng() < 0.12) continue;
        ctx.fillRect(16, y, (w - 32) * (0.45 + rng() * 0.55), 3);
      }
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(w - 62, h - 54, 46, 40);
      ctx.globalAlpha = 1;
    });

  const cork = make(512, 340, (ctx, w, h) => {
    const rng = createRng(88);
    ctx.fillStyle = "#b98a56";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(${90 + rng() * 80}, ${60 + rng() * 50}, ${30 + rng() * 30}, 0.35)`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2.5, 1 + rng() * 2.5);
    }
    ctx.fillStyle = "#12365f";
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAPAN INFORMASI ASRAMA", w / 2, 28);
    const papers = ["#ffffff", "#fff7c2", "#ffffff", "#d7f0ff", "#ffe1e1", "#ffffff", "#e3ffd9", "#ffffff"];
    let px = 18;
    let row = 0;
    for (let i = 0; i < 9; i++) {
      const pw = 70 + rng() * 48;
      const ph = 96 + rng() * 34;
      if (px + pw > w - 14) {
        px = 24 + rng() * 14;
        row++;
      }
      const py = 54 + row * 142 + rng() * 10;
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((rng() - 0.5) * 0.1);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(-pw / 2 + 3, -ph / 2 + 3, pw, ph);
      ctx.fillStyle = papers[i % papers.length];
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.fillStyle = ["#b91c1c", "#1d4ed8", "#0f766e", "#7c3aed"][i % 4];
      ctx.fillRect(-pw / 2 + 7, -ph / 2 + 8, pw - 14, 12);
      ctx.fillStyle = "#4b5563";
      for (let y = -ph / 2 + 30; y < ph / 2 - 10; y += 8) {
        ctx.fillRect(-pw / 2 + 7, y, (pw - 14) * (0.5 + rng() * 0.5), 2);
      }
      ctx.fillStyle = ["#dc2626", "#2563eb", "#facc15", "#16a34a"][i % 4];
      ctx.beginPath();
      ctx.arc(0, -ph / 2 + 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      px += pw + 12;
    }
  });

  const officeSign = make(512, 200, (ctx, w, h) => {
    ctx.fillStyle = "#0f3d7a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5c518";
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 50px Arial";
    ctx.fillText("KANTOR PELAYANAN", w / 2, 78);
    ctx.font = "bold 34px Arial";
    ctx.fillText("ASRAMA MAHASISWA ITS", w / 2, 132);
  });

  const buka = make(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#c81e1e";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 76px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BUKA", w / 2, 92);
  });

  const xBanner = make(256, 680, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0f3d7a");
    g.addColorStop(0.55, "#1859a8");
    g.addColorStop(1, "#0b2c5a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5c518";
    ctx.fillRect(0, 150, w, 8);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px Arial";
    ctx.fillText("ASRAMA", w / 2, 60);
    ctx.fillText("MAHASISWA", w / 2, 98);
    ctx.font = "bold 44px Arial";
    ctx.fillStyle = "#f5c518";
    ctx.fillText("ITS", w / 2, 142);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("LAYANAN PENGHUNI", w / 2, 206);
    ctx.font = "19px Arial";
    const lines = ["Registrasi kamar", "Laporan kerusakan", "Peminjaman fasilitas", "Pengambilan paket", "", "Senin – Jumat", "08.00 – 16.00 WIB"];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, 260 + i * 36));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(78, 520, 100, 100);
    ctx.fillStyle = "#111827";
    const rng = createRng(5);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (rng() > 0.5) ctx.fillRect(83 + x * 9, 525 + y * 9, 9, 9);
    ctx.fillStyle = "#ffffff";
    ctx.font = "15px Arial";
    ctx.fillText("its.id/asrama", w / 2, 648);
  });

  const wetFloor = make(256, 384, (ctx, w, h) => {
    ctx.fillStyle = "#f6c90e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.font = "bold 46px Arial";
    ctx.fillText("AWAS", w / 2, 70);
    ctx.beginPath();
    ctx.moveTo(w / 2, 100);
    ctx.lineTo(w / 2 + 84, 244);
    ctx.lineTo(w / 2 - 84, 244);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f6c90e";
    ctx.beginPath();
    ctx.arc(w / 2 + 6, 150, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#f6c90e";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w / 2, 172);
    ctx.lineTo(w / 2 - 22, 206);
    ctx.lineTo(w / 2 - 44, 216);
    ctx.moveTo(w / 2 - 22, 206);
    ctx.lineTo(w / 2 + 20, 226);
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 34px Arial";
    ctx.fillText("LANTAI LICIN", w / 2, 300);
    ctx.font = "bold 20px Arial";
    ctx.fillText("CAUTION WET FLOOR", w / 2, 340);
  });

  // Soft-edged dirt / spill blot with alpha
  const stain = make(
    256,
    256,
    (ctx, w, h) => {
      const rng = createRng(4711);
      for (let i = 0; i < 26; i++) {
        const x = w / 2 + (rng() - 0.5) * w * 0.5;
        const y = h / 2 + (rng() - 0.5) * h * 0.5;
        const r = 18 + rng() * 52;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(70, 62, 50, ${0.1 + rng() * 0.12})`);
        g.addColorStop(1, "rgba(70, 62, 50, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
    { transparent: true }
  );

  // Rain streaks that run down from a ledge
  const drips = make(
    512,
    256,
    (ctx, w, h) => {
      const rng = createRng(909);
      for (let i = 0; i < 46; i++) {
        const x = rng() * w;
        const len = h * (0.25 + rng() * 0.75);
        const width = 3 + rng() * 14;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        const a = 0.1 + rng() * 0.2;
        g.addColorStop(0, `rgba(84, 78, 66, ${a})`);
        g.addColorStop(0.5, `rgba(96, 90, 76, ${a * 0.55})`);
        g.addColorStop(1, "rgba(96, 90, 76, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, width, len);
      }
      const top = ctx.createLinearGradient(0, 0, 0, 26);
      top.addColorStop(0, "rgba(70, 66, 58, 0.34)");
      top.addColorStop(1, "rgba(70, 66, 58, 0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, w, 26);
    },
    { transparent: true }
  );

  const cardboard = make(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#b08552";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(90, 60, 30, 0.25)";
    for (let x = 0; x < w; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(214, 196, 150, 0.85)";
    ctx.fillRect(0, h / 2 - 9, w, 18);
    ctx.fillStyle = "rgba(60, 40, 20, 0.7)";
    ctx.font = "bold 13px Arial";
    ctx.fillText("AQUA 600ml", 10, 28);
    ctx.fillText("24 BTL", 10, 112);
  });

  const meter = make(128, 160, (ctx, w, h) => {
    ctx.fillStyle = "#e7e7e2";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#111827";
    ctx.fillRect(18, 22, w - 36, 44);
    ctx.fillStyle = "#86efac";
    ctx.font = "bold 22px monospace";
    ctx.fillText("04182.6", 22, 52);
    ctx.fillStyle = "#374151";
    ctx.font = "bold 11px Arial";
    ctx.fillText("kWh  PLN", 22, 86);
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(18, 100, 40, 40);
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.arc(94, 120, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  return {
    evacuation,
    noSmoking,
    beberes,
    wifi,
    notices: [
      notice(11, "#b91c1c", "PENGUMUMAN"),
      notice(23, "#1d4ed8", "JADWAL PIKET"),
      notice(37, "#0f766e", "TATA TERTIB"),
      notice(41, "#7c3aed", "INFO KEGIATAN")
    ],
    cork,
    officeSign,
    buka,
    xBanner,
    wetFloor,
    stain,
    drips,
    cardboard,
    meter
  };
}

/* ------------------------------------------------------------------ */
/* Roof trim, gutters and downpipes                                    */
/* ------------------------------------------------------------------ */

function buildRoofTrim(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "RoofTrim";
  const mh = spec.wings.mainHall;
  const minX = mh.minX - 0.35;
  const maxX = mh.maxX + 0.25;
  const lenA = maxX - minX;
  const cxA = (minX + maxX) / 2;
  const off = 0.26;

  // Barge boards closing the truss cavity on both gable ends of Wing A
  for (const x of [minX - 0.02, maxX + 0.02]) {
    const segs = [
      [8.7, 3.5],
      [3.5, -1.8],
      [-1.8, -6.7]
    ];
    for (const [z1, z2] of segs) {
      g.add(slopedBarZ(x, z1, roofYA(z1) + 0.13, z2, roofYA(z2) + 0.13, 0.035, 0.36, materials.orangeBeam));
    }
  }

  // Top flashing along the high north edge and a box gutter along the low south eave
  const yTop = roofYA(-6.7) + off + 0.07;
  g.add(box(lenA + 0.1, 0.035, 0.34, M.flashing, cxA, yTop, -6.62));
  g.add(box(lenA + 0.1, 0.22, 0.03, M.flashing, cxA, yTop - 0.11, -6.79));

  const yEave = roofYA(8.7) + off - 0.06;
  g.add(box(lenA, 0.02, 0.15, M.gutter, cxA, yEave - 0.06, 8.8, { cast: false }));
  g.add(box(lenA, 0.12, 0.012, M.gutter, cxA, yEave, 8.875));
  g.add(box(lenA, 0.12, 0.012, M.gutter, cxA, yEave, 8.727, { cast: false }));
  for (let x = minX + 0.6; x < maxX; x += 2.4) {
    g.add(box(0.02, 0.012, 0.16, M.gutter, x, yEave + 0.055, 8.8, { cast: false }));
  }

  // PVC downpipes with offsets back to the end columns
  for (const x of [-13.5, 11.5]) {
    const px = x + (x < 0 ? 0.33 : -0.33);
    g.add(rod([px, yEave - 0.05, 8.8], [px, yEave - 0.32, 8.47], 0.045, M.pvc, { radial: 8, cast: true }));
    g.add(rod([px, yEave - 0.3, 8.47], [px, -0.18, 8.47], 0.045, M.pvc, { radial: 8, cast: true }));
    g.add(rod([px, -0.16, 8.45], [px, -0.22, 8.72], 0.045, M.pvc, { radial: 8 }));
    for (const y of [0.5, 1.7, 2.7]) g.add(box(0.12, 0.03, 0.02, M.steelDark, px, y, 8.43, { cast: false }));
  }

  // Roofing screws: faint dotted rows across the big south slope read as fixing lines from above
  // (kept as a few dark purlin shadows rather than thousands of screws)
  for (const z of [7.6, 6.2, 4.8]) {
    g.add(box(lenA - 0.2, 0.012, 0.04, M.roofLine, cxA, roofYA(z) + off + 0.052, z, { cast: false }));
  }
  for (const z of [2.2, 0.6, -0.9, -3.4, -5.2]) {
    g.add(box(lenA - 0.2, 0.012, 0.04, M.roofLine, cxA, roofYA(z) + off + 0.052, z, { cast: false }));
  }

  // Wing B ridge capping, east gutter and downpipes
  const sw = spec.wings.steelWing;
  const zMin = sw.minZ - 0.25;
  const zMax = sw.maxZ + 0.25;
  const lenB = zMax - zMin;
  const czB = (zMin + zMax) / 2;
  const ridgeY = sw.ridgeY + 0.22 + 0.075;
  const capE = box(0.34, 0.02, lenB + 0.06, M.flashing, sw.ridgeX + 0.16, ridgeY - 0.035, czB);
  capE.rotation.z = -0.25;
  const capW = box(0.34, 0.02, lenB + 0.06, M.flashing, sw.ridgeX - 0.16, ridgeY - 0.02, czB);
  capW.rotation.z = 0.08;
  g.add(capE, capW);

  const eastX = sw.maxX + 0.35;
  const yEaveB = roofYB(eastX, -10) + 0.22 - 0.07;
  g.add(box(0.15, 0.02, lenB, M.gutter, eastX + 0.09, yEaveB - 0.06, czB, { cast: false }));
  g.add(box(0.012, 0.12, lenB, M.gutter, eastX + 0.165, yEaveB, czB));
  g.add(box(0.012, 0.12, lenB, M.gutter, eastX + 0.015, yEaveB, czB, { cast: false }));
  for (const z of [-14.2, 0.5]) {
    g.add(rod([eastX + 0.09, yEaveB - 0.05, z + 0.3], [21.45, yEaveB - 0.45, z + 0.3], 0.04, M.pvc, { radial: 8, cast: true }));
    g.add(rod([21.45, yEaveB - 0.43, z + 0.3], [21.45, -0.2, z + 0.3], 0.04, M.pvc, { radial: 8, cast: true }));
  }
  // Barge boards on the two Wing B gables (east slope only: the west slope dies into Wing A)
  for (const z of [zMin - 0.02, zMax + 0.02]) {
    const b = box(Math.hypot(eastX - sw.ridgeX, 1.6), 0.3, 0.035, materials.orangeBeam, (eastX + sw.ridgeX) / 2, (sw.ridgeY + roofYB(eastX, z)) / 2 + 0.12, z);
    b.rotation.z = Math.atan2(roofYB(eastX, z) - sw.ridgeY, eastX - sw.ridgeX);
    g.add(b);
  }

  // Split AC condensers and their pipe runs on the back (north) wall
  for (const [x, y] of [
    [6.4, 0.55],
    [8.1, 0.55],
    [-11.6, 3.9],
    [-4.0, 3.9]
  ]) {
    const unit = new THREE.Group();
    unit.add(box(0.82, 0.56, 0.3, M.appliance, 0, 0, 0));
    const grille = cyl(0.21, 0.21, 0.012, M.steelDark, -0.14, 0, -0.156, 20, { cast: false });
    grille.rotation.x = Math.PI / 2;
    unit.add(grille);
    const hubCap = cyl(0.05, 0.05, 0.02, M.appliance, -0.14, 0, -0.165, 12, { cast: false });
    hubCap.rotation.x = Math.PI / 2;
    unit.add(hubCap);
    unit.add(box(0.05, 0.04, 0.34, M.steelDark, -0.3, -0.3, 0.0));
    unit.add(box(0.05, 0.04, 0.34, M.steelDark, 0.3, -0.3, 0.0));
    unit.position.set(x, y + (y < 1 ? -0.25 + 0.3 : 0), -6.9);
    g.add(unit);
    g.add(rod([x + 0.36, y, -6.78], [x + 0.36, y + 1.4, -6.72], 0.02, M.pvc, { radial: 6 }));
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* Skylight slot: unfinished ceiling                                   */
/* ------------------------------------------------------------------ */

function buildSkylightDetails(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "SkylightDetails";
  const gap = spec.wings.mainHall.skylightGap;

  // Light steel truss webs zig-zagging between the purlins
  for (let x = gap.minX + 0.6; x < gap.maxX - 0.4; x += 2.1) {
    const y0 = roofYA(1.9) + 0.03;
    const y1 = roofYA(0.1) + 0.22;
    g.add(rod([x, y0, 1.9], [x + 1.05, y1, 0.1], 0.014, materials.blackMullion, { radial: 5 }));
    g.add(rod([x + 1.05, y1, 0.1], [x + 2.1, y0, 1.9], 0.014, materials.blackMullion, { radial: 5 }));
  }

  // Trim angle around the opening where the panels were cut back
  const yN = roofYA(gap.minZ) - 0.03;
  const yS = roofYA(gap.maxZ) - 0.03;
  g.add(box(gap.maxX - gap.minX, 0.05, 0.03, M.trimBrown, 0, yN, gap.minZ, { cast: false }));
  g.add(box(gap.maxX - gap.minX, 0.05, 0.03, M.trimBrown, 0, yS, gap.maxZ, { cast: false }));

  // One ceiling panel has let go along three edges and hangs by the fourth, swaying in the draught
  const hinge = new THREE.Group();
  hinge.position.set(3.35, roofYA(gap.minZ) - 0.03, gap.minZ - 0.01);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.05, 0.012), materials.woodSoffit);
  panel.position.set(0, -0.525, 0);
  panel.castShadow = true;
  hinge.add(panel);
  hinge.rotation.set(0.2, 0, 0.07);
  markDynamic(hinge);
  registerAnimator((time) => {
    hinge.rotation.x = 0.2 + Math.sin(time * 0.9) * 0.035 + Math.sin(time * 2.3 + 1.0) * 0.012;
    hinge.rotation.z = 0.07 + Math.sin(time * 0.6 + 2.0) * 0.012;
  });
  g.add(hinge);

  // A second panel sags at one corner; loose wires hang out of the cavity
  const sag = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.012, 0.6), materials.woodSoffit);
  sag.position.set(-5.2, roofYA(2.0) - 0.12, 2.28);
  sag.rotation.set(-0.29 - 0.16, 0, 0.1);
  g.add(sag);
  for (const [x, z, len] of [
    [-2.4, 0.5, 0.9],
    [-2.25, 0.62, 0.55],
    [6.3, 1.4, 0.7]
  ]) {
    const yTop = roofYA(z) + 0.14;
    g.add(rod([x, yTop, z], [x + 0.04, yTop - len, z + 0.03], 0.005, M.cableBlack, { radial: 4 }));
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Electrical: floodlights, conduit, speaker, CCTV, panel              */
/* ------------------------------------------------------------------ */

function buildElectrical(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "Electrical";

  const floodlight = (x, y, z, facing, tilt) => {
    const f = new THREE.Group();
    f.add(box(0.05, 0.1, 0.03, M.steelDark, 0, 0.02, 0.015, { cast: false }));
    const headGroup = new THREE.Group();
    headGroup.position.set(0, -0.02, 0.07);
    headGroup.rotation.x = tilt;
    headGroup.add(box(0.21, 0.16, 0.045, M.steelDark, 0, 0, 0));
    for (let i = -2; i <= 2; i++) headGroup.add(box(0.008, 0.14, 0.02, M.steelDark, i * 0.04, 0, -0.03, { cast: false }));
    headGroup.add(box(0.18, 0.13, 0.006, M.floodLens, 0, 0, 0.025, { cast: false }));
    f.add(headGroup);
    f.position.set(x, y, z);
    f.rotation.y = facing;
    g.add(f);
    g.add(box(0.07, 0.07, 0.04, M.pvc, x + 0.2, y + 0.02, z + (facing === 0 ? 0.02 : -0.02), { cast: false }));
  };

  // Central spine beam (z = 3.5): floodlights aimed at the lesehan floor, conduit strapped along the beam
  for (const x of [-11, -6, -1, 4, 9]) floodlight(x, 5.14, 3.675, 0, 0.75);
  g.add(rod([-13.4, 5.16, 3.685], [11.3, 5.16, 3.685], 0.011, M.pvc, { radial: 6 }));
  for (let x = -12.2; x < 11; x += 1.9) g.add(box(0.03, 0.035, 0.012, M.pvc, x, 5.16, 3.69, { cast: false }));

  // Mezzanine edge beam (z = -1.8): two more washing the canteen aisle
  for (const x of [-6, 4]) floodlight(x, 6.74, -1.615, 0, 0.9);
  g.add(rod([-13.3, 6.76, -1.61], [11.3, 6.76, -1.61], 0.011, M.pvc, { radial: 6 }));

  // Conduit drops down two spine columns to sockets used for charging laptops
  for (const x of [-8.5, 1.5]) {
    g.add(rod([x + 0.12, 5.02, 3.74], [x + 0.12, 0.42, 3.74], 0.011, M.pvc, { radial: 6 }));
    g.add(box(0.12, 0.085, 0.04, M.pvc, x + 0.12, 0.38, 3.75, { cast: false }));
    g.add(box(0.035, 0.035, 0.008, M.socketDark, x + 0.095, 0.38, 3.772, { cast: false }));
    g.add(box(0.035, 0.035, 0.008, M.socketDark, x + 0.145, 0.38, 3.772, { cast: false }));
  }

  // White conduit just under the cap of the red wall feeding its socket strips
  const rw = spec.furniture.redDividerWall.mainSegment;
  const faceZ = rw.z + rw.thickness / 2 + 0.014;
  g.add(rod([rw.minX + 0.3, 0.8, faceZ], [rw.maxX - 0.15, 0.8, faceZ], 0.011, M.pvc, { radial: 6 }));
  for (let x = rw.minX + 0.9; x < rw.maxX - 0.3; x += 1.6) g.add(box(0.03, 0.035, 0.012, M.pvc, x, 0.8, faceZ + 0.004, { cast: false }));
  // Extra four-gang socket strips with a charger or two plugged in
  for (const x of [-10.2, -6.9, -3.6, -0.3]) {
    g.add(rod([x, 0.8, faceZ], [x, 0.52, faceZ], 0.009, M.pvc, { radial: 6 }));
    g.add(box(0.3, 0.07, 0.03, M.pvc, x, 0.48, faceZ + 0.008, { cast: false }));
    for (let i = 0; i < 4; i++) g.add(box(0.04, 0.035, 0.006, M.socketDark, x - 0.105 + i * 0.07, 0.48, faceZ + 0.025, { cast: false }));
  }

  // PA speaker and Wi-Fi access point high on the mezzanine back wall
  const speaker = new THREE.Group();
  speaker.add(box(0.3, 0.46, 0.26, M.speaker, 0, 0, 0));
  speaker.add(box(0.26, 0.42, 0.01, M.speakerGrille, 0, 0, 0.132, { cast: false }));
  const woofer = cyl(0.1, 0.1, 0.008, M.steelDark, 0, -0.07, 0.139, 18, { cast: false });
  woofer.rotation.x = Math.PI / 2;
  speaker.add(woofer);
  speaker.position.set(-2.4, 6.1, -6.26);
  speaker.rotation.x = 0.3;
  g.add(speaker);
  g.add(box(0.06, 0.05, 0.16, M.steelDark, -2.4, 6.25, -6.4));

  const ap = new THREE.Group();
  ap.add(box(0.2, 0.2, 0.035, M.appliance, 0, 0, 0, { cast: false }));
  ap.add(rod([-0.07, 0.08, 0], [-0.1, 0.24, 0.01], 0.006, M.appliance, { radial: 5 }));
  ap.add(rod([0.07, 0.08, 0], [0.1, 0.24, 0.01], 0.006, M.appliance, { radial: 5 }));
  ap.add(box(0.012, 0.012, 0.004, M.ledGreen, 0.06, -0.07, 0.02, { cast: false }));
  ap.position.set(2.2, 6.2, -6.44);
  g.add(ap);

  // Conduit runs on the back wall linking them
  g.add(rod([-13.2, 6.5, -6.455], [10.8, 6.5, -6.455], 0.011, M.pvc, { radial: 6 }));
  g.add(rod([-2.4, 6.5, -6.455], [-2.4, 6.3, -6.455], 0.011, M.pvc, { radial: 6 }));
  g.add(rod([2.2, 6.5, -6.455], [2.2, 6.3, -6.455], 0.011, M.pvc, { radial: 6 }));
  for (const x of [-9.6, 4.9]) g.add(rod([x, 6.5, -6.455], [x, 3.4, -6.455], 0.011, M.pvc, { radial: 6 }));

  // Dome CCTV cameras under the mezzanine and on the south beam
  for (const [x, y, z] of [
    [3.1, 3.13, -1.95],
    [-11.8, 3.13, -2.0],
    [12.3, 3.13, -5.2]
  ]) {
    g.add(cyl(0.06, 0.065, 0.03, M.appliance, x, y - 0.015, z, 14, { cast: false }));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.domeDark);
    dome.position.set(x, y - 0.03, z);
    g.add(dome);
  }

  // Cables lying in the rusty tray under the mezzanine, with a few drops to the stalls
  const trayY = 3.0;
  const cables = [
    [M.cableBlack, -2.36, 0.013],
    [M.cableBlack, -2.31, 0.01],
    [M.cableGrey, -2.24, 0.016],
    [M.cableBlue, -2.18, 0.009],
    [M.cableBlack, -2.13, 0.012]
  ];
  for (const [mat, z, r] of cables) g.add(rod([-13.6, trayY + r, z], [10.6, trayY + r, z], r, mat, { radial: 5 }));
  for (const x of [-7.2, -3.4, 0.2]) {
    g.add(rod([x, trayY, -2.4], [x, 3.08, -3.15], 0.009, M.cableBlack, { radial: 5 }));
  }

  // Distribution board + kWh meter on the solid north-west wall
  const wx = spec.wings.mainHall.minX + 0.13;
  g.add(box(0.13, 0.66, 0.46, M.panelGrey, wx + 0.065, 1.55, -3.3));
  g.add(box(0.012, 0.6, 0.4, M.panelDoor, wx + 0.136, 1.55, -3.3, { cast: false }));
  g.add(box(0.02, 0.07, 0.025, M.steelDark, wx + 0.15, 1.55, -3.13, { cast: false }));
  g.add(box(0.1, 0.26, 0.2, M.appliance, wx + 0.05, 2.18, -3.3));
  const meterFace = card(0.18, 0.24, M.meterFace, wx + 0.102, 2.18, -3.3, Math.PI / 2);
  g.add(meterFace);
  g.add(rod([wx + 0.02, 2.31, -3.3], [wx + 0.02, 3.1, -3.3], 0.013, M.pvc, { radial: 6 }));
  g.add(rod([wx + 0.02, 1.22, -3.4], [wx + 0.02, 0.1, -3.4], 0.013, M.pvc, { radial: 6 }));
  // Hazard sticker
  g.add(card(0.14, 0.14, M.hazard, wx + 0.143, 1.7, -3.3, Math.PI / 2));

  return g;
}

/* ------------------------------------------------------------------ */
/* Stickers, posters and signs                                         */
/* ------------------------------------------------------------------ */

function buildSignage(spec, materials, M, T) {
  const g = new THREE.Group();
  g.name = "Signage";
  const r = spec.columns.radiusMain + 0.004;

  // Columns along the mezzanine edge face the hall (south, +Z)
  g.add(columnWrap(r, 0.42, 0.21, M.evacuation, 1.5, 2.25, -1.8, 0));
  g.add(columnWrap(r, 0.42, 0.21, M.evacuation, -13.5, 2.25, 3.5, Math.PI / 2));
  g.add(columnWrap(r, 0.26, 0.325, M.noSmoking, -8.5, 1.72, -1.8, 0.2));
  g.add(columnWrap(r, 0.26, 0.325, M.noSmoking, 6.5, 1.7, 3.5, Math.PI));
  g.add(columnWrap(r, 0.3, 0.42, M.beberes, -3.5, 1.62, -1.8, -0.15));
  g.add(columnWrap(r, 0.3, 0.42, M.beberes, 6.5, 1.6, -1.8, 0.1));
  g.add(columnWrap(r, 0.3, 0.21, M.wifi, -3.5, 1.5, 3.5, Math.PI + 0.3));
  g.add(columnWrap(r, 0.3, 0.21, M.wifi, 1.5, 1.52, 3.5, 0.4));
  g.add(columnWrap(r, 0.21, 0.297, M.notices[0], -8.5, 1.55, 3.5, Math.PI - 0.2));
  g.add(columnWrap(r, 0.21, 0.297, M.notices[3], 1.5, 1.5, -1.8, 0.9));
  g.add(columnWrap(r, 0.21, 0.297, M.notices[1], 11.5, 1.55, 3.5, -Math.PI / 2));
  // Wing B columns
  const rb = spec.columns.radiusSecondary + 0.004;
  g.add(columnWrap(rb, 0.26, 0.325, M.noSmoking, 16.0, 1.7, -9.5, 0.3));
  g.add(columnWrap(rb, 0.3, 0.42, M.beberes, 16.0, 1.6, -4.5, -0.3));
  g.add(columnWrap(rb, 0.42, 0.21, M.evacuation, 16.0, 2.3, -4.5, Math.PI));

  // Cork notice board on the back wall, west of the stalls
  const nx = -11.9;
  const nz = spec.wings.mainHall.minZ + 0.035;
  g.add(box(1.72, 1.16, 0.035, M.frameAlu, nx, 1.58, nz + 0.012));
  g.add(card(1.64, 1.08, M.cork, nx, 1.58, nz + 0.031));

  // Office: name board over the door, OPEN tag, notices taped inside the glass
  const off = spec.officeRoom;
  const bayW = (off.maxX - off.minX) / 5;
  const gz = off.maxZ + 0.045;
  g.add(box(bayW - 0.1, 0.5, 0.02, M.frameAlu, off.minX + bayW * 0.5, 2.68, gz));
  g.add(card(bayW - 0.14, 0.46, M.officeSign, off.minX + bayW * 0.5, 2.68, gz + 0.012));
  g.add(card(0.24, 0.12, M.buka, off.minX + bayW * 0.5 + 0.2, 1.52, off.maxZ + 0.022));
  g.add(rod([off.minX + bayW * 0.5 + 0.2, 1.58, off.maxZ + 0.02], [off.minX + bayW * 0.5 + 0.2, 1.72, off.maxZ + 0.02], 0.002, M.cableBlack, { radial: 4 }));
  const taped = [
    [1, -0.25, 1.62, 0],
    [1, 0.05, 1.6, 1],
    [2, -0.1, 1.66, 2],
    [3, 0.2, 1.58, 3],
    [3, -0.12, 1.6, 0],
    [4, 0.0, 1.64, 1]
  ];
  for (const [bay, dx, y, n] of taped) {
    g.add(card(0.21, 0.297, M.notices[n], off.minX + bayW * (bay + 0.5) + dx, y, off.maxZ + 0.02));
  }

  // Plywood sheets where the transom glazing above the office front was never fitted,
  // and the one aluminium tube that has slipped diagonally across the open bay
  for (const bay of [1, 2, 4]) {
    const cx = off.minX + bayW * (bay + 0.5);
    g.add(box(bayW - 0.07, 0.8, 0.016, materials.lightWood, cx, 2.69, off.maxZ + 0.05));
    g.add(box(bayW - 0.05, 0.03, 0.03, M.frameAlu, cx, 2.3, off.maxZ + 0.06, { cast: false }));
    g.add(box(bayW - 0.05, 0.03, 0.03, M.frameAlu, cx, 3.08, off.maxZ + 0.06, { cast: false }));
  }
  const openCx = off.minX + bayW * 3.5;
  g.add(rod([openCx - 0.56, 3.05, off.maxZ + 0.06], [openCx + 0.52, 2.34, off.maxZ + 0.07], 0.016, M.frameAlu, { radial: 6, cast: true }));

  // Roll-up banner outside the office and a wet-floor sign left out by the cleaners
  const banner = new THREE.Group();
  banner.add(card(0.6, 1.6, M.xBanner, 0, 0.92, 0));
  const back = card(0.6, 1.6, M.bannerBack, 0, 0.92, -0.004, Math.PI);
  banner.add(back);
  banner.add(box(0.66, 0.05, 0.1, M.frameAlu, 0, 0.06, 0));
  banner.add(rod([0, 0.06, -0.05], [0, 1.72, -0.02], 0.008, M.frameAlu, { radial: 5 }));
  banner.add(box(0.62, 0.02, 0.02, M.frameAlu, 0, 1.73, -0.008, { cast: false }));
  banner.position.set(8.55, 0, -1.78);
  banner.rotation.y = -0.12;
  g.add(banner);

  const wet = new THREE.Group();
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.add(box(0.3, 0.62, 0.012, M.wetYellow, 0, 0.31, 0));
    leaf.add(card(0.28, 0.42, M.wetFloor, 0, 0.36, 0.008));
    leaf.rotation.x = s * -0.24;
    leaf.rotation.y = s === 1 ? 0 : Math.PI;
    leaf.position.z = s * 0.14;
    wet.add(leaf);
  }
  wet.position.set(8.7, 0, 2.7);
  wet.rotation.y = 0.5;
  g.add(wet);

  return g;
}

/* ------------------------------------------------------------------ */
/* Office interior and its doorstep                                    */
/* ------------------------------------------------------------------ */

function buildOfficeDetails(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "OfficeDetails";
  const off = spec.officeRoom;
  const desk = spec.furniture.officeInteriorTable;
  const top = 0.75;

  // Two workstations on the big desk
  for (const [dx, dz, facing] of [
    [-0.75, -0.2, 0],
    [0.7, 0.2, Math.PI]
  ]) {
    const ws = new THREE.Group();
    ws.add(cyl(0.09, 0.1, 0.012, M.steelDark, 0, 0.006, -0.12, 14, { cast: false }));
    ws.add(box(0.03, 0.2, 0.02, M.steelDark, 0, 0.11, -0.13));
    ws.add(box(0.54, 0.33, 0.022, M.steelDark, 0, 0.33, -0.12));
    ws.add(box(0.5, 0.29, 0.004, M.screen, 0, 0.33, -0.107, { cast: false }));
    ws.add(box(0.36, 0.016, 0.12, M.steelDark, 0, 0.008, 0.12, { cast: false }));
    ws.add(box(0.06, 0.02, 0.1, M.steelDark, 0.3, 0.01, 0.13, { cast: false }));
    ws.position.set(desk.x + dx, top, desk.z + dz);
    ws.rotation.y = facing;
    g.add(ws);
  }
  // Paper trays, files, stamp pad, a mug
  const rng = createRng(77);
  for (let i = 0; i < 7; i++) {
    const p = box(0.21, 0.004 + rng() * 0.03, 0.297, M.paper, desk.x - 0.1 + (rng() - 0.5) * 1.6, top + 0.012, desk.z + (rng() - 0.5) * 0.7, { cast: false });
    p.rotation.y = (rng() - 0.5) * 0.7;
    g.add(p);
  }
  for (let i = 0; i < 4; i++) {
    g.add(box(0.06, 0.3, 0.24, [M.binderBlue, M.binderRed, M.binderGreen, M.steelDark][i], desk.x + 1.15, top + 0.15, desk.z - 0.3 + i * 0.065));
  }
  g.add(cyl(0.04, 0.035, 0.09, M.mug, desk.x - 0.3, top + 0.045, desk.z + 0.3, 12));

  // Split AC, wall clock and calendar on the back wall; LED panel on the ceiling
  const wallZ = off.minZ + 0.04;
  g.add(box(0.86, 0.28, 0.2, M.appliance, 8.9, 2.72, wallZ + 0.1));
  g.add(box(0.8, 0.02, 0.06, M.steelDark, 8.9, 2.6, wallZ + 0.17, { cast: false }));
  const clock = cyl(0.15, 0.15, 0.03, M.steelDark, 10.2, 2.35, wallZ + 0.02, 24, { cast: false });
  clock.rotation.x = Math.PI / 2;
  g.add(clock);
  const face = cyl(0.135, 0.135, 0.032, M.paper, 10.2, 2.35, wallZ + 0.022, 24, { cast: false });
  face.rotation.x = Math.PI / 2;
  g.add(face);
  g.add(box(0.008, 0.1, 0.004, M.steelDark, 10.2, 2.39, wallZ + 0.04, { cast: false }));
  g.add(box(0.07, 0.008, 0.004, M.steelDark, 10.23, 2.35, wallZ + 0.04, { cast: false }));
  g.add(box(0.6, 0.03, 0.6, materials.lampEmissive, 7.3, 3.105, -4.4, { cast: false, receive: false }));
  g.add(box(0.6, 0.03, 0.6, materials.lampEmissive, 9.4, 3.105, -4.4, { cast: false, receive: false }));

  // Low cabinet with a printer and a water dispenser inside the east wall
  g.add(box(0.5, 0.7, 1.0, materials.cabinetWhite, off.maxX - 0.38, 0.35, -3.0));
  g.add(box(0.42, 0.2, 0.46, M.appliance, off.maxX - 0.38, 0.8, -3.1));
  g.add(box(0.3, 0.012, 0.22, M.paper, off.maxX - 0.4, 0.906, -3.1, { cast: false }));
  g.add(box(0.3, 0.95, 0.3, M.appliance, off.minX + 0.35, 0.475, -5.9));
  g.add(cyl(0.135, 0.135, 0.34, M.gallon, off.minX + 0.35, 1.14, -5.9, 16));
  g.add(cyl(0.05, 0.135, 0.06, M.gallon, off.minX + 0.35, 0.98, -5.9, 16));

  // Door mat on the hall side of the office doors
  const bayW = (off.maxX - off.minX) / 5;
  g.add(box(0.95, 0.012, 0.58, M.mat, off.minX + bayW * 0.5, 0.008, off.maxZ + 0.42, { cast: false }));
  g.add(box(0.85, 0.013, 0.48, M.matInner, off.minX + bayW * 0.5, 0.009, off.maxZ + 0.42, { cast: false }));
  g.add(box(0.75, 0.012, 0.5, M.mat, 4.34, 0.008, -4.25, { cast: false }));
  return g;
}

/* ------------------------------------------------------------------ */
/* Stairwell: skirting, conduit and the cleaners' corner               */
/* ------------------------------------------------------------------ */

function buildStairwellDetails(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "StairwellDetails";
  const sm = getStairMetrics(spec);
  const { drumX, drumZ, drumR, northZ } = sm;

  // Dark painted skirting around the drum and along the store wall facing the hall
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(drumR + 0.012, drumR + 0.012, 0.11, 40, 1, true, -Math.PI / 2, Math.PI), M.skirting);
  skirt.position.set(drumX, 0.055, drumZ);
  skirt.receiveShadow = true;
  g.add(skirt);
  g.add(box(0.012, 0.11, drumZ - 1.05 - northZ, M.skirting, sm.westFaceX - 0.006, 0.055, (northZ + drumZ - 1.05) / 2, { cast: false }));

  // Scuffed band where trolleys and feet rub the drum
  const scuff = new THREE.Mesh(new THREE.CylinderGeometry(drumR + 0.008, drumR + 0.008, 0.5, 40, 1, true, -Math.PI / 2, Math.PI), M.dripWide);
  scuff.position.set(drumX, 1.42, drumZ);
  g.add(scuff);

  // Conduit climbing the drum to the alarm bell beside the PERHATIAN boards
  const th = -0.42;
  const cx = drumX + Math.sin(th) * (drumR + 0.014);
  const cz = drumZ + Math.cos(th) * (drumR + 0.014);
  g.add(rod([cx, 0.12, cz], [cx, 2.5, cz], 0.012, M.pvc, { radial: 6 }));
  g.add(box(0.07, 0.07, 0.04, M.pvc, cx, 1.35, cz + 0.01, { cast: false }));

  // Cleaners' corner beside the store door: broom, mop + bucket, dustpan, cardboard cartons
  const wx = sm.westFaceX;
  const z0 = drumZ - 1.1; // just north of the door
  g.add(rod([wx - 0.05, 1.32, z0 - 0.5], [wx - 0.3, 0.06, z0 - 0.58], 0.012, M.broomStick, { radial: 6, cast: true }));
  const bristle = box(0.3, 0.1, 0.05, M.bristle, wx - 0.31, 0.06, z0 - 0.58);
  bristle.rotation.y = 1.45;
  g.add(bristle);

  g.add(cyl(0.15, 0.12, 0.26, M.bucket, wx - 0.3, 0.13, z0 - 0.95, 16));
  g.add(rod([wx - 0.3, 0.1, z0 - 0.95], [wx - 0.06, 1.38, z0 - 1.03], 0.012, M.frameAlu, { radial: 6, cast: true }));
  g.add(cyl(0.07, 0.09, 0.1, M.mopHead, wx - 0.3, 0.09, z0 - 0.95, 10));

  const pan = new THREE.Group();
  pan.add(box(0.24, 0.012, 0.22, M.panRed, 0, 0.006, 0));
  pan.add(box(0.24, 0.07, 0.012, M.panRed, 0, 0.035, -0.11));
  pan.add(box(0.012, 0.05, 0.22, M.panRed, -0.12, 0.025, 0));
  pan.add(box(0.012, 0.05, 0.22, M.panRed, 0.12, 0.025, 0));
  pan.add(rod([0, 0.06, -0.11], [0, 0.62, -0.2], 0.01, M.panRed, { radial: 6 }));
  pan.position.set(wx - 0.22, 0, z0 - 0.2);
  pan.rotation.y = 1.9;
  g.add(pan);

  const carton = box(0.42, 0.3, 0.32, M.cardboard, wx - 0.34, 0.15, z0 - 1.38);
  carton.rotation.y = 0.2;
  g.add(carton);
  const carton2 = box(0.36, 0.24, 0.28, M.cardboard, wx - 0.32, 0.42, z0 - 1.36);
  carton2.rotation.y = -0.15;
  g.add(carton2);

  return g;
}

/* ------------------------------------------------------------------ */
/* Housekeeping near the stalls: sink, dish trolley, bin               */
/* ------------------------------------------------------------------ */

function buildWashCorner(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "WashCorner";
  const wz = spec.wings.mainHall.minZ + 0.03;

  // Wall-hung basin with mirror, tap, soap and its trap
  const sx = -10.75;
  g.add(box(0.52, 0.15, 0.42, M.ceramic, sx, 0.8, wz + 0.21));
  g.add(box(0.4, 0.02, 0.3, M.ceramicShade, sx, 0.871, wz + 0.2, { cast: false }));
  g.add(rod([sx, 0.88, wz + 0.06], [sx, 1.02, wz + 0.06], 0.012, materials.stainlessSteel, { radial: 8 }));
  g.add(rod([sx, 1.02, wz + 0.06], [sx, 0.99, wz + 0.17], 0.01, materials.stainlessSteel, { radial: 8 }));
  g.add(rod([sx, 0.72, wz + 0.18], [sx, 0.5, wz + 0.18], 0.02, M.pvc, { radial: 8 }));
  g.add(rod([sx, 0.5, wz + 0.18], [sx, 0.5, wz + 0.02], 0.02, M.pvc, { radial: 8 }));
  g.add(box(0.46, 0.6, 0.012, M.frameAlu, sx, 1.52, wz + 0.008, { cast: false }));
  g.add(box(0.42, 0.56, 0.006, M.mirror, sx, 1.52, wz + 0.017, { cast: false }));
  g.add(cyl(0.03, 0.03, 0.14, M.soap, sx + 0.2, 0.95, wz + 0.1, 10));
  g.add(cyl(0.008, 0.008, 0.04, M.steelDark, sx + 0.2, 1.04, wz + 0.1, 6));
  // Tiled splashback
  g.add(box(0.9, 0.9, 0.008, M.splashTile, sx, 1.1, wz + 0.004, { cast: false }));

  // Stainless dish-return trolley with stacked plates, glasses and a washing-up tub
  const t = new THREE.Group();
  const steel = materials.stainlessSteel;
  for (const y of [0.28, 0.62, 0.92]) t.add(box(0.78, 0.018, 0.46, steel, 0, y, 0));
  for (const sxx of [-0.38, 0.38]) for (const szz of [-0.22, 0.22]) {
    t.add(rod([sxx, 0.07, szz], [sxx, 0.98, szz], 0.012, steel, { radial: 6, cast: true }));
    t.add(cyl(0.035, 0.035, 0.03, M.steelDark, sxx, 0.035, szz, 10));
  }
  t.add(rod([-0.38, 0.98, -0.22], [-0.38, 0.98, 0.22], 0.012, steel, { radial: 6 }));
  for (let i = 0; i < 9; i++) t.add(cyl(0.11, 0.07, 0.012, M.plate, -0.2, 0.94 + i * 0.012, 0.03, 18));
  for (let i = 0; i < 5; i++) t.add(cyl(0.11, 0.07, 0.012, M.plateGreen, 0.1, 0.94 + i * 0.012, -0.06, 18));
  for (const [gx, gz] of [
    [0.28, 0.12],
    [0.2, 0.15],
    [0.31, 0.02]
  ]) t.add(cyl(0.032, 0.026, 0.1, M.glassCup, gx, 0.98, gz, 10, { cast: false }));
  t.add(box(0.5, 0.16, 0.34, M.tubBlue, 0, 0.71, 0));
  t.add(box(0.44, 0.02, 0.28, M.plate, 0, 0.775, 0, { cast: false }));
  t.add(cyl(0.16, 0.14, 0.2, M.bucket, 0.05, 0.39, 0, 14));
  t.position.set(-10.35, 0, -2.75);
  t.rotation.y = 0.12;
  g.add(t);

  // Swing-lid bin and a stack of red plastic stools
  g.add(box(0.36, 0.56, 0.3, M.binGrey, -11.3, 0.28, -2.78));
  const lid = box(0.38, 0.16, 0.32, M.binLid, -11.3, 0.64, -2.78);
  g.add(lid);
  g.add(box(0.26, 0.012, 0.2, M.steelDark, -11.3, 0.66, -2.62, { cast: false }));
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group();
    s.add(cyl(0.15, 0.17, 0.035, M.stoolRed, 0, 0.44, 0, 14));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      s.add(rod([Math.cos(a) * 0.12, 0.43, Math.sin(a) * 0.12], [Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18], 0.016, M.stoolRed, { radial: 5, cast: true }));
    }
    s.position.set(-12.2, i * 0.09, -5.8);
    s.rotation.y = i * 0.2;
    g.add(s);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Floor: tape, stains, leaves; walls: rain streaks                    */
/* ------------------------------------------------------------------ */

function buildSurfaceWear(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "SurfaceWear";
  const rng = createRng(2024);
  const y = spec.floorY + 0.0022;

  const tape = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.048), M.tape);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.receiveShadow = true;
    m.renderOrder = 2;
    g.add(m);
  };
  // Tape boxes marking where the lesehan tables belong (the tables have long since drifted off them)
  for (const t of spec.furniture.lesehanTables) {
    if (rng() < 0.35) continue;
    const cx = t.x + (rng() - 0.5) * 0.5;
    const cz = t.z + (rng() - 0.5) * 0.4;
    const hw = 0.82;
    const hd = 0.55;
    const corners = [
      [cx - hw, cz - hd],
      [cx + hw, cz - hd],
      [cx + hw, cz + hd],
      [cx - hw, cz + hd]
    ];
    for (let i = 0; i < 4; i++) {
      if (rng() < 0.12) continue; // a side has peeled off
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      tape(a[0], a[1], b[0], b[1]);
    }
  }
  // "Shoes off beyond this line" strip along the south edge of the study area
  tape(-12.8, 7.35, 10.6, 7.35);

  // Dirt and spills where people actually walk and eat
  const stainAt = (x, z, w, d, opacityMat) => {
    const m = floorDecal(w, d, opacityMat, x, y - 0.0006, z, rng() * 6.28);
    m.renderOrder = 1;
    g.add(m);
  };
  for (let i = 0; i < 16; i++) stainAt(-9 + rng() * 11, -2.6 + rng() * 1.6, 1.2 + rng() * 1.6, 0.9 + rng() * 1.2, M.stain);
  for (let i = 0; i < 12; i++) stainAt(-12 + rng() * 22, 7.3 + rng() * 1.0, 1.4 + rng() * 2.0, 0.8 + rng() * 0.8, M.stain);
  for (let i = 0; i < 10; i++) stainAt(12.5 + rng() * 8, -13 + rng() * 14, 1.2 + rng() * 1.8, 1.0 + rng() * 1.4, M.stain);
  for (let i = 0; i < 6; i++) stainAt(20.2 + rng() * 0.8, -7 + rng() * 3, 0.9 + rng() * 0.8, 0.8 + rng() * 0.8, M.stainDark);
  stainAt(-10.4, -2.7, 1.6, 1.3, M.stainDark);
  stainAt(-10.75, -6.0, 1.1, 0.9, M.stainDark);

  // Dry leaves blown in along the open south and east edges
  const leafGeo = new THREE.CircleGeometry(0.035, 5);
  const leafMats = [M.leafBrown, M.leafYellow, M.leafOlive];
  const scatter = (count, x0, x1, z0, z1, bias) => {
    for (let i = 0; i < count; i++) {
      const u = rng();
      const v = Math.pow(rng(), bias);
      const leaf = new THREE.Mesh(leafGeo, leafMats[Math.floor(rng() * 3)]);
      leaf.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.5, 0, rng() * 6.28);
      leaf.scale.set(0.7 + rng() * 0.9, 0.35 + rng() * 0.3, 1);
      leaf.position.set(x0 + (x1 - x0) * u, y + 0.004 + rng() * 0.006, z1 - (z1 - z0) * v);
      leaf.receiveShadow = true;
      g.add(leaf);
    }
  };
  scatter(90, -13.6, 11.2, 5.6, 8.4, 2.4);
  scatter(40, 11.8, 21.0, -14.2, 3.3, 1.0);

  // Rain streaks: below the mezzanine parapet coping, on the stair drum and under the south beam
  const streak = (w, h, x, yy, z, rotY, mat = M.drips) => {
    const m = card(w, h, mat, x, yy, z, rotY);
    m.renderOrder = 1;
    g.add(m);
  };
  const mh = spec.wings.mainHall;
  for (let x = -13.2; x < 1.0; x += 3.6) streak(3.6, 0.8, x + 1.8, 3.88, mh.mezzanineEdgeZ + 0.084, 0);
  streak(4.6, 0.8, 9.0, 3.88, mh.mezzanineEdgeZ + 0.084, 0);
  // Mezzanine slab edge / fascia
  for (let x = -13.0; x < 11.0; x += 4.0) streak(4.0, 0.2, x + 2, 3.24, mh.mezzanineEdgeZ + 0.004, 0, M.dripsFaint);
  // Back wall, high up under the roof
  for (let x = -13.5; x < 11; x += 4.9) streak(4.9, 1.5, x + 2.45, 6.65, mh.minZ + 0.034, 0, M.dripsFaint);
  // West spandrel beam, outside face
  streak(10.2, 0.56, mh.minX - 0.142, 2.36, 3.3, -Math.PI / 2);
  // South beam orange fascia: grime line (outside face)
  for (let x = -13.5; x < 11; x += 5.1) streak(5.1, 0.4, x + 2.55, 2.86, 8.425, 0, M.dripsFaint);
  // Wing B spandrels, outside faces
  const sw = spec.wings.steelWing;
  streak(17.7, 0.56, 21.322, 2.36, -5.35, Math.PI / 2);
  streak(9.9, 0.56, 16.5, 2.36, sw.maxZ + 0.122, 0);

  return g;
}

/* ------------------------------------------------------------------ */
/* Mezzanine deck                                                      */
/* ------------------------------------------------------------------ */

function buildMezzanineDeck(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "MezzanineDeck";
  const mh = spec.wings.mainHall;
  const y = mh.mezzanineFloorY;

  // Tiled finish on top of the bare slab
  const depth = mh.mezzanineEdgeZ - mh.minZ - 0.2;
  g.add(box(mh.maxX - mh.minX - 0.3, 0.012, depth, materials.floorTile, (mh.minX + mh.maxX) / 2, y + 0.006, mh.minZ + 0.1 + depth / 2, { cast: false }));
  const bridge = spec.wings.steelWing.mezzanineBridge;
  g.add(box(bridge.maxX - bridge.minX - 0.25, 0.012, depth, materials.floorTile, (bridge.minX + bridge.maxX) / 2 - 0.02, y + 0.006, mh.minZ + 0.1 + depth / 2, { cast: false }));

  // Outside each first-floor door: mat, shoe rack with pairs of shoes, a potted plant
  const rng = createRng(5150);
  const shoeMats = [M.shoeBlack, M.shoeWhite, M.shoeBlue, M.shoeRed, M.shoeGrey];
  for (const dx of [-6.0, 1.5, 8.2]) {
    g.add(box(1.2, 0.012, 0.5, M.mat, dx, y + 0.018, mh.minZ + 0.45, { cast: false }));
    const rx = dx + 1.45;
    const rack = new THREE.Group();
    for (const sy of [0.14, 0.4, 0.66]) rack.add(box(0.8, 0.016, 0.3, materials.lightWood, 0, sy, 0));
    for (const sx of [-0.4, 0.4]) rack.add(box(0.02, 0.7, 0.3, materials.lightWood, sx, 0.35, 0));
    for (const sy of [0.148, 0.408, 0.668]) {
      for (let k = 0; k < 3; k++) {
        if (rng() < 0.25) continue;
        const mat = shoeMats[Math.floor(rng() * shoeMats.length)];
        for (const off of [-0.045, 0.045]) {
          const shoe = box(0.075, 0.06, 0.24, mat, -0.26 + k * 0.26 + off, sy + 0.03, 0.01);
          rack.add(shoe);
        }
      }
    }
    rack.position.set(rx, y + 0.012, mh.minZ + 0.3);
    g.add(rack);
  }

  // A drying rack with laundry near the rail, and two benches
  const dry = new THREE.Group();
  for (const sx of [-0.6, 0.6]) {
    dry.add(rod([sx, 0, -0.3], [sx, 1.1, 0], 0.012, M.frameAlu, { radial: 5, cast: true }));
    dry.add(rod([sx, 0, 0.3], [sx, 1.1, 0], 0.012, M.frameAlu, { radial: 5, cast: true }));
  }
  for (const [yy, zz] of [
    [1.1, 0],
    [0.86, -0.07],
    [0.86, 0.07]
  ]) dry.add(rod([-0.6, yy, zz], [0.6, yy, zz], 0.008, M.frameAlu, { radial: 5 }));
  const cloth = [M.clothBlue, M.clothWhite, M.clothRed, M.clothGrey, M.clothWhite];
  for (let i = 0; i < 5; i++) {
    const w = 0.16 + rng() * 0.08;
    const h = 0.36 + rng() * 0.2;
    const c = box(w, h, 0.012, cloth[i], -0.46 + i * 0.23, 1.1 - h / 2, 0.006);
    dry.add(c);
    const c2 = box(w, h * 0.7, 0.012, cloth[i], -0.46 + i * 0.23, 1.1 - (h * 0.7) / 2, -0.012);
    dry.add(c2);
  }
  dry.position.set(-10.5, y + 0.012, -2.7);
  dry.rotation.y = 0.15;
  g.add(dry);

  for (const bx of [-3.2, 9.0]) {
    g.add(box(1.5, 0.045, 0.36, materials.benchWood, bx, y + 0.43, -2.25));
    for (const s of [-0.62, 0.62]) g.add(box(0.05, 0.42, 0.32, M.steelDark, bx + s, y + 0.22, -2.25));
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Wing B extras                                                       */
/* ------------------------------------------------------------------ */

function buildSteelWingExtras(spec, materials, M) {
  const g = new THREE.Group();
  g.name = "SteelWingExtras";
  const rng = createRng(606);

  // Tissue boxes, sambal and kecap bottles, a toothpick jar on each picnic table
  for (const t of spec.furniture.steelPicnicTables) {
    const set = new THREE.Group();
    set.add(box(0.2, 0.07, 0.11, M.tissue, 0.12, 0.035, -0.05));
    set.add(box(0.07, 0.004, 0.02, M.paper, 0.12, 0.072, -0.05, { cast: false }));
    set.add(cyl(0.026, 0.03, 0.15, M.sauceRed, -0.1, 0.075, 0.04, 10));
    set.add(cyl(0.012, 0.02, 0.03, M.sauceCap, -0.1, 0.165, 0.04, 8));
    set.add(cyl(0.026, 0.03, 0.15, M.kecap, -0.17, 0.075, -0.02, 10));
    set.add(cyl(0.012, 0.02, 0.03, M.capYellow, -0.17, 0.165, -0.02, 8));
    set.add(cyl(0.022, 0.022, 0.06, M.glassCup, -0.02, 0.03, -0.1, 10, { cast: false }));
    set.position.set(t.x + (rng() - 0.5) * 0.3, t.height + 0.002, t.z + (rng() - 0.5) * 0.3);
    set.rotation.y = rng() * 6.28;
    g.add(set);
  }

  // A meal someone left behind on one table
  const t3 = spec.furniture.steelPicnicTables[3];
  g.add(cyl(0.12, 0.08, 0.014, M.plate, t3.x + 0.3, t3.height + 0.008, t3.z + 0.36, 18));
  g.add(cyl(0.07, 0.07, 0.012, M.riceLeft, t3.x + 0.3, t3.height + 0.018, t3.z + 0.36, 12, { cast: false }));
  g.add(cyl(0.035, 0.028, 0.11, M.glassCup, t3.x + 0.08, t3.height + 0.056, t3.z + 0.42, 10, { cast: false }));
  g.add(cyl(0.03, 0.025, 0.07, M.tea, t3.x + 0.08, t3.height + 0.04, t3.z + 0.42, 10, { cast: false }));

  // Water dispenser by the white counter + a hand-wash basin on the north gable column
  g.add(box(0.31, 0.98, 0.31, M.appliance, 12.05, 0.49, -12.9));
  g.add(box(0.2, 0.14, 0.02, M.steelDark, 12.05, 0.7, -12.74, { cast: false }));
  g.add(cyl(0.135, 0.135, 0.34, M.gallon, 12.05, 1.17, -12.9, 16));
  g.add(cyl(0.05, 0.135, 0.06, M.gallon, 12.05, 1.01, -12.9, 16));

  // Wall fan on a Wing B spine column (static blades, the two hall fans do the moving)
  return g;
}

/* ------------------------------------------------------------------ */
/* Orange cat asleep on a picnic table                                 */
/* ------------------------------------------------------------------ */

function buildSleepingCat(M) {
  const cat = new THREE.Group();
  cat.name = "SleepingCat";
  const fur = M.catOrange;
  const pale = M.catCream;

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), fur);
  body.scale.set(1.25, 0.62, 0.95);
  body.position.set(0, 0.085, 0);
  body.castShadow = true;
  cat.add(body);
  // Tabby stripes
  for (let i = -2; i <= 2; i++) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.128 - Math.abs(i) * 0.012, 0.009, 5, 14, Math.PI), M.catStripe);
    stripe.position.set(i * 0.055, 0.086, 0);
    stripe.rotation.y = Math.PI / 2;
    stripe.scale.set(0.95, 0.66, 1);
    cat.add(stripe);
  }
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), fur);
  haunch.scale.set(1.0, 0.75, 0.9);
  haunch.position.set(-0.12, 0.075, 0.06);
  cat.add(haunch);

  // Head tucked down on the front paws, eyes shut
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), fur);
  skull.scale.set(1.0, 0.86, 1.02);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), pale);
  muzzle.scale.set(1.1, 0.7, 0.9);
  muzzle.position.set(0, -0.02, 0.058);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), M.catNose);
  nose.position.set(0, -0.008, 0.094);
  head.add(nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur);
    ear.position.set(s * 0.048, 0.068, -0.005);
    ear.rotation.set(0.1, Math.PI / 4, s * -0.3);
    head.add(ear);
    const lidLine = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 8, Math.PI), M.catStripe);
    lidLine.position.set(s * 0.032, 0.008, 0.07);
    lidLine.rotation.set(0.2, s * 0.35, Math.PI);
    head.add(lidLine);
  }
  head.position.set(0.19, 0.07, 0.035);
  head.rotation.set(0.25, 0.5, 0.12);
  cat.add(head);

  for (const s of [-1, 1]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), pale);
    paw.scale.set(1.5, 0.6, 0.9);
    paw.position.set(0.2, 0.02, 0.02 + s * 0.045);
    cat.add(paw);
  }

  // Tail wrapped around the body
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0.05, 0.0),
    new THREE.Vector3(-0.24, 0.035, 0.1),
    new THREE.Vector3(-0.14, 0.03, 0.17),
    new THREE.Vector3(0.0, 0.028, 0.17),
    new THREE.Vector3(0.1, 0.026, 0.14)
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 14, 0.022, 7, false), fur);
  tail.castShadow = true;
  cat.add(tail);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), pale);
  tip.position.set(0.1, 0.026, 0.14);
  cat.add(tip);

  markDynamic(cat);
  registerAnimator((time) => {
    const breath = 1 + Math.sin(time * 1.25) * 0.035;
    body.scale.y = 0.62 * breath;
    haunch.scale.y = 0.75 * (1 + Math.sin(time * 1.25 - 0.3) * 0.02);
    // The occasional ear twitch
    const twitch = Math.max(0, Math.sin(time * 0.7) - 0.985) * 40;
    head.rotation.z = 0.12 + twitch * 0.05;
  });
  return cat;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function createDetails(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "Details";
  const T = textures(materials);
  const glow = materials.registerNightGlow || ((m) => m);

  const sticker = (map) => decalMat(map, { roughness: 0.55, side: THREE.DoubleSide });
  const M = {
    flashing: flatMat(0x59636b, { roughness: 0.45, metalness: 0.6 }),
    gutter: flatMat(0xd9dcda, { roughness: 0.55, metalness: 0.2 }),
    pvc: flatMat(0xecebe4, { roughness: 0.55 }),
    steelDark: flatMat(0x1d2126, { roughness: 0.5, metalness: 0.4 }),
    roofLine: flatMat(0x3a434b, { roughness: 0.6, metalness: 0.4 }),
    appliance: flatMat(0xe9e9e4, { roughness: 0.45, metalness: 0.05 }),
    trimBrown: flatMat(0x7a4a36, { roughness: 0.6 }),
    cableBlack: flatMat(0x16181b, { roughness: 0.7 }),
    cableGrey: flatMat(0x7d8288, { roughness: 0.7 }),
    cableBlue: flatMat(0x2a55a6, { roughness: 0.6 }),
    socketDark: flatMat(0x3b4046, { roughness: 0.6 }),
    speaker: flatMat(0x17191c, { roughness: 0.75 }),
    speakerGrille: flatMat(0x2a2d31, { roughness: 0.9, metalness: 0.3 }),
    ledGreen: flatMat(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 2.5 }),
    domeDark: flatMat(0x0d0f12, { roughness: 0.08, metalness: 0.3 }),
    panelGrey: flatMat(0x9da3a6, { roughness: 0.55, metalness: 0.35 }),
    panelDoor: flatMat(0xb3b8ba, { roughness: 0.5, metalness: 0.35 }),
    frameAlu: flatMat(0xc3c7c9, { roughness: 0.38, metalness: 0.75 }),
    wetYellow: flatMat(0xf6c90e, { roughness: 0.5 }),
    paper: flatMat(0xf6f5ef, { roughness: 0.85 }),
    binderBlue: flatMat(0x1f4f9c, { roughness: 0.6 }),
    binderRed: flatMat(0xa32424, { roughness: 0.6 }),
    binderGreen: flatMat(0x1f7a4a, { roughness: 0.6 }),
    mug: flatMat(0xd9482b, { roughness: 0.35 }),
    gallon: new THREE.MeshStandardMaterial({ color: 0x6fb7e6, roughness: 0.12, transparent: true, opacity: 0.72, envMapIntensity: 1.6 }),
    mat: flatMat(0x2c3a33, { roughness: 0.95 }),
    matInner: flatMat(0x4a5d50, { roughness: 0.98 }),
    skirting: flatMat(0x3a4046, { roughness: 0.7, side: THREE.DoubleSide }),
    broomStick: flatMat(0x2f7d4f, { roughness: 0.5 }),
    bristle: flatMat(0xb9924c, { roughness: 0.95 }),
    bucket: flatMat(0x2c6fb8, { roughness: 0.45 }),
    mopHead: flatMat(0xcfcfc4, { roughness: 0.98 }),
    panRed: flatMat(0xc92a2a, { roughness: 0.45 }),
    ceramic: flatMat(0xf4f4f0, { roughness: 0.12, envMapIntensity: 1.3 }),
    ceramicShade: flatMat(0xd9dcd9, { roughness: 0.2 }),
    mirror: flatMat(0xdfe6ea, { roughness: 0.03, metalness: 1.0, envMapIntensity: 1.4 }),
    soap: flatMat(0x3fa66b, { roughness: 0.3 }),
    splashTile: flatMat(0xe3ecee, { roughness: 0.15, envMapIntensity: 1.2 }),
    plate: flatMat(0xf5f3ec, { roughness: 0.25 }),
    plateGreen: flatMat(0x8fc9a1, { roughness: 0.35 }),
    glassCup: new THREE.MeshStandardMaterial({ color: 0xdff1f5, roughness: 0.05, transparent: true, opacity: 0.38, envMapIntensity: 2 }),
    tubBlue: flatMat(0x2a7fc4, { roughness: 0.5 }),
    binGrey: flatMat(0x8a9096, { roughness: 0.6 }),
    binLid: flatMat(0x2f6f4a, { roughness: 0.55 }),
    stoolRed: flatMat(0xc62a2a, { roughness: 0.42 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xc02a20, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    leafBrown: flatMat(0x7a5a30, { roughness: 0.9, side: THREE.DoubleSide }),
    leafYellow: flatMat(0xb89a3c, { roughness: 0.9, side: THREE.DoubleSide }),
    leafOlive: flatMat(0x6f7a34, { roughness: 0.9, side: THREE.DoubleSide }),
    shoeBlack: flatMat(0x1c1c1f, { roughness: 0.7 }),
    shoeWhite: flatMat(0xe9e9e6, { roughness: 0.7 }),
    shoeBlue: flatMat(0x2a4f8f, { roughness: 0.7 }),
    shoeRed: flatMat(0x9c2b2b, { roughness: 0.7 }),
    shoeGrey: flatMat(0x74787d, { roughness: 0.7 }),
    clothBlue: flatMat(0x35619e, { roughness: 0.95, side: THREE.DoubleSide }),
    clothWhite: flatMat(0xecebe6, { roughness: 0.95, side: THREE.DoubleSide }),
    clothRed: flatMat(0xa8323a, { roughness: 0.95, side: THREE.DoubleSide }),
    clothGrey: flatMat(0x6f747b, { roughness: 0.95, side: THREE.DoubleSide }),
    tissue: flatMat(0x4fb3d9, { roughness: 0.6 }),
    sauceRed: flatMat(0xc0271f, { roughness: 0.35 }),
    sauceCap: flatMat(0xe9e9e4, { roughness: 0.4 }),
    kecap: flatMat(0x2a1a12, { roughness: 0.3 }),
    capYellow: flatMat(0xf2c21a, { roughness: 0.4 }),
    riceLeft: flatMat(0xefe9d6, { roughness: 0.9 }),
    tea: flatMat(0x9a5a1c, { roughness: 0.2 }),
    catOrange: flatMat(0xd98a3d, { roughness: 0.92 }),
    catCream: flatMat(0xf1dfc4, { roughness: 0.92 }),
    catStripe: flatMat(0xa85f22, { roughness: 0.92 }),
    catNose: flatMat(0xd98a8f, { roughness: 0.6 }),

    floodLens: glow(new THREE.MeshStandardMaterial({ color: 0xe6ebf0, emissive: 0xfff3da, emissiveIntensity: 0.05, roughness: 0.2 }), 0.03, 7),
    screen: glow(new THREE.MeshStandardMaterial({ color: 0x1b2430, emissive: 0x9fc4ee, emissiveIntensity: 0.5, roughness: 0.2 }), 0.45, 1.1),

    evacuation: sticker(T.evacuation),
    noSmoking: sticker(T.noSmoking),
    beberes: sticker(T.beberes),
    wifi: sticker(T.wifi),
    notices: T.notices.map((t) => sticker(t)),
    cork: decalMat(T.cork, { roughness: 0.9 }),
    officeSign: decalMat(T.officeSign, { roughness: 0.4 }),
    buka: decalMat(T.buka, { roughness: 0.4, side: THREE.DoubleSide }),
    xBanner: new THREE.MeshStandardMaterial({ map: T.xBanner, roughness: 0.5 }),
    bannerBack: flatMat(0xd8d8d2, { roughness: 0.7 }),
    wetFloor: decalMat(T.wetFloor, { roughness: 0.5 }),
    cardboard: new THREE.MeshStandardMaterial({ map: T.cardboard, roughness: 0.9 }),
    meterFace: decalMat(T.meter, { roughness: 0.3 }),
    hazard: decalMat(
      materials.createCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#f6c90e";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.moveTo(w / 2, 14);
        ctx.lineTo(w - 14, h - 18);
        ctx.lineTo(14, h - 18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f6c90e";
        ctx.beginPath();
        ctx.moveTo(70, 40);
        ctx.lineTo(52, 74);
        ctx.lineTo(66, 74);
        ctx.lineTo(56, 102);
        ctx.lineTo(82, 64);
        ctx.lineTo(68, 64);
        ctx.closePath();
        ctx.fill();
      }),
      { roughness: 0.5 }
    ),
    stain: decalMat(T.stain, { transparent: true, opacity: 0.75, roughness: 0.6 }),
    stainDark: decalMat(T.stain, { transparent: true, opacity: 1.0, roughness: 0.5, color: 0x8a8378 }),
    drips: decalMat(T.drips, { transparent: true, opacity: 0.9, roughness: 0.9, side: THREE.DoubleSide }),
    dripsFaint: decalMat(T.drips, { transparent: true, opacity: 0.5, roughness: 0.9, side: THREE.DoubleSide }),
    dripWide: decalMat(T.stain, { transparent: true, opacity: 0.5, roughness: 0.9, side: THREE.DoubleSide })
  };

  group.add(buildRoofTrim(layoutSpec, materials, M));
  group.add(buildSkylightDetails(layoutSpec, materials, M));
  group.add(buildElectrical(layoutSpec, materials, M));
  group.add(buildSignage(layoutSpec, materials, M, T));
  group.add(buildOfficeDetails(layoutSpec, materials, M));
  group.add(buildStairwellDetails(layoutSpec, materials, M));
  group.add(buildWashCorner(layoutSpec, materials, M));
  group.add(buildSurfaceWear(layoutSpec, materials, M));
  group.add(buildMezzanineDeck(layoutSpec, materials, M));
  group.add(buildSteelWingExtras(layoutSpec, materials, M));

  // The orange cat that owns the steel tables
  const napTable = layoutSpec.furniture.steelPicnicTables[2];
  const cat = buildSleepingCat(M);
  cat.position.set(napTable.x + 0.12, napTable.height + 0.004, napTable.z - 0.1);
  cat.rotation.y = -0.6;
  group.add(cat);

  return group;
}
