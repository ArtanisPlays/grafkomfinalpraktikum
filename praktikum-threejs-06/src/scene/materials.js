import * as THREE from "three";
import { createRng, fbm, lerp, clamp01, smoothstep, makeCanvas, paintPixels } from "./noise.js";

/**
 * Procedural material library.
 *
 * Every surface is generated at load time from seeded noise - no image files - and most
 * come as a colour map plus a matching bump and/or roughness map so they respond to the
 * sky environment and the sun instead of reading as flat colour.
 *
 * Materials flagged `userData.metricUV` expect UVs in metres (see geomUtils.applyMetricUV);
 * their texture `repeat` is therefore 1 / (size of one texture tile in metres).
 */

const ANISO = 8;

function toTexture(canvas, { srgb = true, repeat = null, wrap = true, aniso = ANISO } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

/* ------------------------------------------------------------------ */
/* Glossy white ceramic floor: 8 x 8 tiles (4 m) per texture repeat    */
/* ------------------------------------------------------------------ */

const FLOOR_TILES = 8;
const FLOOR_METRES = 4;

function buildFloorTileMaps() {
  const size = 1024;
  const rng = createRng(9001);
  const tilePx = size / FLOOR_TILES;

  // Per-tile tone, gloss and "this tile was replaced / is stained" variation
  const tiles = [];
  for (let i = 0; i < FLOOR_TILES * FLOOR_TILES; i++) {
    tiles.push({
      tone: (rng() - 0.5) * 9,
      warm: (rng() - 0.5) * 5,
      gloss: rng(),
      stained: rng() < 0.08 ? 0.5 + rng() * 0.5 : 0
    });
  }

  const [map, rough, bump] = paintPixels(size, size, 3, (u, v, out, x, y) => {
    const tx = Math.floor(x / tilePx);
    const ty = Math.floor(y / tilePx);
    const lx = x - tx * tilePx;
    const ly = y - ty * tilePx;
    const edge = Math.min(lx, tilePx - 1 - lx, ly, tilePx - 1 - ly);
    const t = tiles[ty * FLOOR_TILES + tx];

    const mottle = fbm(u, v, 24, 24, 3, 11) - 0.5;
    const grime = fbm(u, v, 6, 6, 4, 23);
    const dirt = smoothstep(0.58, 0.82, grime);

    if (edge < 1.5) {
      // Dark, dirty cement grout
      const g = 92 + mottle * 40 - dirt * 18;
      out[0][0] = g;
      out[0][1] = g + 1;
      out[0][2] = g + 3;
      out[1][0] = out[1][1] = out[1][2] = 228;
      out[2][0] = out[2][1] = out[2][2] = 70;
      return;
    }

    // Pillowed tile edge: faint darkening + bevel in the bump map over the outer 5 px
    const bevel = smoothstep(1.5, 6.5, edge);
    const edgeGrime = (1 - smoothstep(1.5, 12, edge)) * (6 + dirt * 16);
    let base = 238 + t.tone + mottle * 5 - edgeGrime - dirt * 9 - t.stained * 12 * (0.5 + grime);
    base = Math.min(base, 250);
    out[0][0] = base + t.warm * 0.6;
    out[0][1] = base + 1;
    out[0][2] = base + 3 - t.warm;

    // Glazed tile: very smooth with smeary footprints where people walk
    const r = 0.1 + t.gloss * 0.08 + dirt * 0.22 + (fbm(u, v, 40, 40, 2, 5) - 0.5) * 0.08 + (1 - bevel) * 0.25;
    const rv = clamp01(r) * 255;
    out[1][0] = out[1][1] = out[1][2] = rv;

    const b = 150 + bevel * 70;
    out[2][0] = out[2][1] = out[2][2] = b;
  });

  // Scuffs, drips and the odd paint speck (the real floor is full of them)
  const ctx = map.getContext("2d");
  for (let i = 0; i < 140; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const kind = rng();
    if (kind < 0.55) {
      ctx.fillStyle = `rgba(60, 62, 66, ${0.12 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.8 + rng() * 2.2, 0.6 + rng() * 1.6, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind < 0.85) {
      ctx.strokeStyle = `rgba(70, 72, 78, ${0.08 + rng() * 0.16})`;
      ctx.lineWidth = 0.6 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const a = rng() * Math.PI * 2;
      const len = 6 + rng() * 26;
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rng() - 0.5) * 8, y + Math.sin(a) * len * 0.5 + (rng() - 0.5) * 8, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = rng() < 0.5 ? "rgba(40, 110, 70, 0.55)" : "rgba(190, 60, 40, 0.45)";
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rng() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const repeat = [1 / FLOOR_METRES, 1 / FLOOR_METRES];
  return {
    map: toTexture(map, { repeat, aniso: 16 }),
    roughnessMap: toTexture(rough, { srgb: false, repeat, aniso: 16 }),
    bumpMap: toTexture(bump, { srgb: false, repeat, aniso: 16 })
  };
}

export function createTiledFloorTexture({ repeatX = 20, repeatY = 20 } = {}) {
  const { map } = buildFloorTileMaps();
  map.repeat.set(repeatX / FLOOR_TILES, repeatY / FLOOR_TILES);
  return map;
}

/* ------------------------------------------------------------------ */
/* Weathered orange-red divider wall with peeling paint                */
/* ------------------------------------------------------------------ */

const RED_WALL_METRES = 6.4;

function buildRedWallMaps() {
  const w = 1024;
  const h = 256;
  const [map, bump] = paintPixels(w, h, 2, (u, v, out) => {
    const broad = fbm(u, v, 10, 3, 5, 201);
    const ragged = fbm(u, v, 44, 11, 3, 207);
    const fine = fbm(u, v, 160, 40, 2, 213);
    const brush = fbm(u, v, 6, 60, 2, 219);

    // Paint lifts first along the damp base and along the top edge under the ledge
    const bias = 0.2 * smoothstep(0.45, 1.0, v) + 0.1 * (1 - smoothstep(0.0, 0.16, v));
    const val = broad * 0.7 + ragged * 0.3 + bias;
    const threshold = 0.615;

    const grimeBase = smoothstep(0.86, 1.0, v);

    if (val > threshold) {
      // Exposed render: cream plaster, grey skim patches and green-grey mould
      const tone = fbm(u, v, 30, 8, 3, 231);
      const mould = smoothstep(0.52, 0.78, fbm(u, v, 14, 4, 3, 241));
      let r = lerp(212, 176, tone);
      let g = lerp(206, 172, tone);
      let b = lerp(188, 160, tone);
      r = lerp(r, 128, mould * 0.6);
      g = lerp(g, 134, mould * 0.6);
      b = lerp(b, 118, mould * 0.6);
      // Lit lip just inside the flake edge
      const lip = 1 - smoothstep(threshold, threshold + 0.012, val);
      r += lip * 18;
      g += lip * 16;
      b += lip * 12;
      const dk = 1 - grimeBase * 0.3;
      out[0][0] = r * dk;
      out[0][1] = g * dk;
      out[0][2] = b * dk;
      out[1][0] = out[1][1] = out[1][2] = 70 + tone * 40;
      return;
    }

    // Orange-red emulsion with roller streaks and chalky fading
    const fade = fbm(u, v, 5, 2, 3, 251);
    const k = 0.9 + brush * 0.12 + (fade - 0.5) * 0.22;
    let r = 206 * k;
    let g = 70 * k + (fade - 0.5) * 16;
    let b = 42 * k;

    // Shadow line where the paint film is about to let go
    const crack = smoothstep(threshold - 0.02, threshold, val);
    r *= 1 - crack * 0.35;
    g *= 1 - crack * 0.4;
    b *= 1 - crack * 0.4;

    // Pin-prick chips
    if (fine > 0.9 && ragged > 0.5) {
      r = 205;
      g = 198;
      b = 182;
    }

    const dk = 1 - grimeBase * 0.38;
    out[0][0] = Math.min(255, r) * dk;
    out[0][1] = Math.min(255, g) * dk;
    out[0][2] = Math.min(255, b) * dk;
    out[1][0] = out[1][1] = out[1][2] = 165 + brush * 30;
  });

  // A couple of rectangular repainted patches + drilled anchor holes
  const ctx = map.getContext("2d");
  const rng = createRng(77);
  for (let i = 0; i < 3; i++) {
    const x = 60 + rng() * (w - 160);
    ctx.fillStyle = "rgba(214, 78, 46, 0.42)";
    ctx.fillRect(x, 30 + rng() * 40, 26 + rng() * 22, 90 + rng() * 70);
  }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = "rgba(30, 20, 18, 0.8)";
    ctx.beginPath();
    ctx.arc(rng() * w, 30 + rng() * 200, 1.2 + rng() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  return { map, bump };
}

export function createWeatheredRedWallTexture() {
  const { map } = buildRedWallMaps();
  return toTexture(map, { repeat: [1 / RED_WALL_METRES, 1 / 0.92] });
}

/* ------------------------------------------------------------------ */
/* Wood-grain PVC ceiling panels with red-brown trim joints            */
/* ------------------------------------------------------------------ */

const SOFFIT_PANEL_M = 1.25;
const SOFFIT_LENGTH_M = 2.5;

function buildSoffitMaps() {
  const w = 512;
  const h = 512;
  const [map, bump] = paintPixels(w, h, 2, (u, v, out, x) => {
    // Printed grain: streaks running across the panel (along u), stacked in fine rows
    const grain = fbm(u, v, 3, 90, 3, 301);
    const weave = fbm(u, v, 28, 220, 2, 307);
    const patch = fbm(u, v, 3, 3, 3, 311);
    const tone = 0.86 + grain * 0.2 + (weave - 0.5) * 0.16 + (patch - 0.5) * 0.08;
    let r = 158 * tone;
    let g = 131 * tone;
    let b = 114 * tone;

    // Tongue-and-groove seams between the 20 cm planks
    const plank = ((x * 6) / 512) % 1 < 0.014 ? 1 : 0;
    r -= plank * 26;
    g -= plank * 24;
    b -= plank * 22;

    // Red-brown aluminium trim strip at each panel run
    let height = 150 + (weave - 0.5) * 16 - plank * 60;
    if (x < 9) {
      const lit = x < 2 ? 0.75 : x > 6 ? 1.2 : 1.0;
      r = 118 * lit;
      g = 62 * lit;
      b = 52 * lit;
      height = 230;
    }
    out[0][0] = r;
    out[0][1] = g;
    out[0][2] = b;
    out[1][0] = out[1][1] = out[1][2] = height;
  });
  const repeat = [1 / SOFFIT_PANEL_M, 1 / SOFFIT_LENGTH_M];
  return {
    map: toTexture(map, { repeat }),
    bumpMap: toTexture(bump, { srgb: false, repeat })
  };
}

export function createWoodSoffitTexture() {
  return buildSoffitMaps().map;
}

/* ------------------------------------------------------------------ */
/* Timber: weathered planks (lesehan tables, benches) and plywood      */
/* ------------------------------------------------------------------ */

function buildTimberMaps(baseHex = "#5c402c", seed = 401) {
  const [br, bg, bb] = hexToRgb(baseHex);
  const w = 512;
  const h = 256;
  const [map, bump] = paintPixels(w, h, 2, (u, v, out) => {
    const grain = fbm(u, v, 2, 40, 4, seed);
    const pores = fbm(u, v, 30, 200, 2, seed + 7);
    const wear = fbm(u, v, 4, 3, 4, seed + 13);
    const stain = smoothstep(0.6, 0.85, fbm(u, v, 6, 5, 3, seed + 19));

    const k = 0.66 + grain * 0.62 + (pores - 0.5) * 0.2;
    let r = br * k;
    let g = bg * k;
    let b = bb * k;

    // Sun-bleached, hand-worn zones drift toward dusty grey-tan
    const bleach = smoothstep(0.5, 0.82, wear) * 0.55;
    r = lerp(r, 150, bleach);
    g = lerp(g, 132, bleach);
    b = lerp(b, 110, bleach);

    r *= 1 - stain * 0.45;
    g *= 1 - stain * 0.48;
    b *= 1 - stain * 0.5;

    out[0][0] = r;
    out[0][1] = g;
    out[0][2] = b;
    out[1][0] = out[1][1] = out[1][2] = 90 + grain * 110 + (pores - 0.5) * 60;
  });

  const ctx = map.getContext("2d");
  const rng = createRng(seed);
  // Knots
  for (let i = 0; i < 3; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const grd = ctx.createRadialGradient(x, y, 1, x, y, 9 + rng() * 6);
    grd.addColorStop(0, "rgba(22, 14, 9, 0.85)");
    grd.addColorStop(1, "rgba(22, 14, 9, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Knife scratches, pen marks and paint flecks
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const a = (rng() - 0.5) * 1.2;
    const len = 8 + rng() * 60;
    ctx.strokeStyle = rng() < 0.7 ? `rgba(205, 185, 160, ${0.08 + rng() * 0.2})` : `rgba(15, 10, 8, ${0.2 + rng() * 0.3})`;
    ctx.lineWidth = 0.5 + rng();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(232, 232, 226, ${0.4 + rng() * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 2, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return { map: toTexture(map), bumpMap: toTexture(bump, { srgb: false }) };
}

export function createTimberTexture(baseHex = "#5c402c") {
  return buildTimberMaps(baseHex).map;
}

function buildPlywoodTexture() {
  const [map] = paintPixels(512, 512, 1, (u, v, out) => {
    // Rotary-cut "cathedral" figure: bands bent by low-frequency noise
    const warp = fbm(u, v, 2, 2, 3, 501) * 7 + fbm(u, v, 5, 2, 2, 507) * 1.5;
    const bands = Math.sin((u * 5 + warp) * Math.PI * 2) * 0.5 + 0.5;
    const pores = fbm(u, v, 12, 180, 2, 513);
    const k = 0.8 + bands * 0.26 + (pores - 0.5) * 0.14;
    const dirty = fbm(u, v, 3, 3, 3, 519);
    out[0][0] = 186 * k * (0.88 + dirty * 0.2);
    out[0][1] = 136 * k * (0.86 + dirty * 0.2);
    out[0][2] = 88 * k * (0.84 + dirty * 0.2);
  });
  return toTexture(map);
}

/* ------------------------------------------------------------------ */
/* Concrete, plaster, steel                                            */
/* ------------------------------------------------------------------ */

function buildColumnTexture() {
  const w = 256;
  const h = 512;
  const [map] = paintPixels(w, h, 1, (u, v, out) => {
    const mottle = fbm(u, v, 6, 12, 4, 601) - 0.5;
    const streak = fbm(u, v, 40, 3, 3, 607) - 0.5;
    // Hand-height polish band and kicked, mopped base
    const base = smoothstep(0.9, 1.0, v);
    const k = 1 + mottle * 0.16 + streak * 0.1 - base * 0.22;
    out[0][0] = 124 * k;
    out[0][1] = 132 * k;
    out[0][2] = 134 * k;
  });
  const ctx = map.getContext("2d");
  const rng = createRng(611);
  // Chipped paint showing pale filler, mostly at shoulder/bag height
  for (let i = 0; i < 18; i++) {
    const x = rng() * w;
    const y = h * (0.55 + rng() * 0.42);
    const tone = 176 + rng() * 34;
    ctx.fillStyle = `rgba(${tone}, ${tone + 3}, ${tone}, ${0.3 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.8 + rng() * 2.2, 0.4 + rng() * 0.9, rng() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Old tape ghosts where posters used to be
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(150, 158, 160, 0.5)`;
    ctx.fillRect(rng() * w, h * (0.5 + rng() * 0.3), 10 + rng() * 14, 3 + rng() * 3);
  }
  return toTexture(map);
}

function buildPlasterMaps() {
  const size = 512;
  const [map, bump] = paintPixels(size, size, 2, (u, v, out) => {
    const trowel = fbm(u, v, 8, 8, 5, 701);
    const cloud = fbm(u, v, 2, 2, 3, 709) - 0.5;
    const damp = smoothstep(0.62, 0.9, fbm(u, v, 3, 5, 4, 719));
    const base = 240 + cloud * 9 - damp * 13 + (trowel - 0.5) * 5;
    out[0][0] = base;
    out[0][1] = base + 0.5 - damp * 1.5;
    out[0][2] = base + 1 - damp * 6;
    out[1][0] = out[1][1] = out[1][2] = 100 + trowel * 110;
  });
  // Hairline cracks
  const ctx = map.getContext("2d");
  const rng = createRng(733);
  ctx.strokeStyle = "rgba(120, 120, 118, 0.28)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (rng() - 0.5) * 26;
      y += 6 + rng() * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const repeat = [1 / 3.2, 1 / 3.2];
  return {
    map: toTexture(map, { repeat }),
    bumpMap: toTexture(bump, { srgb: false, repeat })
  };
}

function buildPlinthTexture() {
  const [map] = paintPixels(256, 256, 1, (u, v, out) => {
    const n = fbm(u, v, 8, 8, 5, 801);
    const s = fbm(u, v, 3, 3, 3, 811);
    const k = 0.78 + n * 0.3 + (s - 0.5) * 0.2;
    out[0][0] = 152 * k;
    out[0][1] = 154 * k;
    out[0][2] = 152 * k;
  });
  return toTexture(map, { repeat: [1 / 2.5, 1 / 2.5] });
}

function buildBrushedSteelMaps() {
  const size = 256;
  const [map, rough] = paintPixels(size, size, 2, (u, v, out) => {
    const brush = fbm(u, v, 2, 120, 2, 901);
    const wear = fbm(u, v, 4, 4, 4, 907);
    const dull = smoothstep(0.45, 0.8, wear);
    const k = 0.82 + brush * 0.14 + (wear - 0.5) * 0.14;
    out[0][0] = 198 * k;
    out[0][1] = 202 * k;
    out[0][2] = 206 * k;
    const r = 0.3 + dull * 0.34 + (brush - 0.5) * 0.12;
    out[1][0] = out[1][1] = out[1][2] = clamp01(r) * 255;
  });
  const ctx = map.getContext("2d");
  const rng = createRng(911);
  for (let i = 0; i < 90; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const a = rng() * Math.PI * 2;
    const len = 4 + rng() * 40;
    ctx.strokeStyle = `rgba(${rng() < 0.5 ? "245,247,250" : "90,95,102"}, ${0.08 + rng() * 0.16})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return { map: toTexture(map), roughnessMap: toTexture(rough, { srgb: false }) };
}

/** Cream-painted perforated cable tray panels eaten by rust. One texture tile = one 0.6 m panel. */
function buildRustTrayTexture() {
  const size = 256;
  const [map] = paintPixels(size, size, 1, (u, v, out, x, y) => {
    const rust = fbm(u, v, 7, 7, 5, 1001);
    const speck = fbm(u, v, 60, 60, 2, 1009);
    // Rust blooms from the panel centre, paint survives near the folded rim
    const cx = Math.abs(u - 0.5) * 2;
    const cy = Math.abs(v - 0.5) * 2;
    const rim = Math.max(cx, cy);
    const amount = smoothstep(0.38, 0.62, rust + (1 - rim) * 0.22 + (speck - 0.5) * 0.25);
    let r = lerp(226, 150, amount);
    let g = lerp(217, 84, amount);
    let b = lerp(192, 42, amount);
    const depth = 0.75 + speck * 0.4;
    r *= lerp(1, depth, amount);
    g *= lerp(1, depth, amount);
    b *= lerp(1, depth, amount);
    // Punched ventilation dots
    if (x % 8 < 2 && y % 8 < 2 && rim < 0.86) {
      r *= 0.55;
      g *= 0.55;
      b *= 0.55;
    }
    // Panel frame
    if (rim > 0.94) {
      r = 196;
      g = 188;
      b = 168;
    }
    out[0][0] = r;
    out[0][1] = g;
    out[0][2] = b;
  });
  return toTexture(map, { repeat: [1 / 0.6, 1 / 0.36] });
}

/** Corrugated roof sheeting: weathered colour + sine-rib bump (one rib every 19 cm). */
function buildRoofMetalMaps() {
  const [map] = paintPixels(256, 256, 1, (u, v, out) => {
    const streak = fbm(u, v, 30, 2, 3, 1101);
    const patch = fbm(u, v, 4, 4, 4, 1109);
    const k = 0.8 + streak * 0.28 + (patch - 0.5) * 0.24;
    const lichen = smoothstep(0.66, 0.86, fbm(u, v, 9, 9, 3, 1117));
    out[0][0] = lerp(92 * k, 126, lichen * 0.5);
    out[0][1] = lerp(101 * k, 128, lichen * 0.5);
    out[0][2] = lerp(112 * k, 112, lichen * 0.5);
  });
  const bumpCanvas = makeCanvas(64, 4);
  const bctx = bumpCanvas.getContext("2d");
  for (let x = 0; x < 64; x++) {
    const val = Math.round((Math.sin((x / 64) * Math.PI * 2) * 0.5 + 0.5) * 255);
    bctx.fillStyle = `rgb(${val},${val},${val})`;
    bctx.fillRect(x, 0, 1, 4);
  }
  return {
    map: toTexture(map, { repeat: [1 / 3.8, 1 / 3.8] }),
    bumpMap: toTexture(bumpCanvas, { srgb: false, repeat: [1 / 0.19, 1] })
  };
}

/* ------------------------------------------------------------------ */
/* Outdoor ground                                                      */
/* ------------------------------------------------------------------ */

const PAVER_METRES = 2.4;

function buildPaverMaps() {
  const size = 512;
  const rng = createRng(1201);
  const map = makeCanvas(size, size);
  const bump = makeCanvas(size, size);
  const ctx = map.getContext("2d");
  const bctx = bump.getContext("2d");
  ctx.fillStyle = "#4a4c4b";
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = "#2a2a2a";
  bctx.fillRect(0, 0, size, size);

  // 20 x 10 cm blocks laid in a running bond
  const cols = 12;
  const rows = 24;
  const bw = size / cols;
  const bh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let c = -1; c <= cols; c++) {
      const v = 118 + Math.floor(rng() * 34);
      const warm = rng() < 0.18 ? 10 : 0;
      ctx.fillStyle = `rgb(${v + warm}, ${v + 1}, ${v - warm * 0.4})`;
      ctx.fillRect(c * bw + offset + 1.2, r * bh + 1.2, bw - 2.4, bh - 2.4);
      const bv = 170 + Math.floor(rng() * 50);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(c * bw + offset + 1.6, r * bh + 1.6, bw - 3.2, bh - 3.2);
    }
  }

  // Tyre dust, damp patches and moss creeping along the joints
  const [grime] = paintPixels(256, 256, 1, (u, v, out) => {
    const n = fbm(u, v, 5, 5, 5, 1211);
    const moss = smoothstep(0.6, 0.85, fbm(u, v, 7, 7, 4, 1217));
    const k = 0.72 + n * 0.5;
    out[0][0] = lerp(255 * k, 120, moss * 0.5);
    out[0][1] = lerp(255 * k, 150, moss * 0.5);
    out[0][2] = lerp(255 * k, 105, moss * 0.5);
  });
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(grime, 0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const repeat = [1 / PAVER_METRES, 1 / PAVER_METRES];
  return {
    map: toTexture(map, { repeat }),
    bumpMap: toTexture(bump, { srgb: false, repeat })
  };
}

export function createPaverTexture() {
  return buildPaverMaps().map;
}

export function createGrassTexture() {
  const [map] = paintPixels(512, 512, 1, (u, v, out) => {
    const broad = fbm(u, v, 4, 4, 4, 1301);
    const dry = smoothstep(0.52, 0.8, fbm(u, v, 6, 6, 4, 1307));
    const blade = fbm(u, v, 110, 110, 2, 1313);
    const bare = smoothstep(0.72, 0.9, fbm(u, v, 9, 9, 3, 1319));
    let r = lerp(58, 112, broad);
    let g = lerp(104, 150, broad);
    let b = lerp(40, 58, broad);
    r = lerp(r, 158, dry * 0.55);
    g = lerp(g, 152, dry * 0.55);
    b = lerp(b, 78, dry * 0.55);
    r = lerp(r, 118, bare * 0.6);
    g = lerp(g, 98, bare * 0.6);
    b = lerp(b, 70, bare * 0.6);
    const k = 0.78 + blade * 0.44;
    out[0][0] = r * k;
    out[0][1] = g * k;
    out[0][2] = b * k;
  });
  return toTexture(map, { repeat: [1 / 7, 1 / 7] });
}

/* ------------------------------------------------------------------ */
/* Signage helper (unchanged API, used by props.js & stalls.js)        */
/* ------------------------------------------------------------------ */

export function createSignTexture({
  width = 512,
  height = 256,
  bg = "#f5c542",
  border = "#1e293b",
  titleColor = "#111827",
  textColor = "#1f2937",
  title = "",
  subtitle = "",
  lines = []
} = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(6, Math.round(height * 0.04));
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (title) {
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${Math.round(height * 0.22)}px Arial, sans-serif`;
    ctx.fillText(title, width / 2, height * (subtitle || lines.length ? 0.25 : 0.5));
  }

  if (subtitle) {
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(height * 0.11)}px Arial, sans-serif`;
    ctx.fillText(subtitle, width / 2, height * 0.45);
  }

  if (lines.length) {
    ctx.fillStyle = textColor;
    ctx.font = `600 ${Math.round(height * 0.09)}px Arial, sans-serif`;
    const startY = height * (subtitle ? 0.62 : 0.5);
    const step = (height * 0.34) / Math.max(1, lines.length);
    lines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, startY + idx * step);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}

/** Free-form canvas texture for one-off signs, posters and decals. */
/**
 * The hall's lamps hang just under the roof sheets and cast no shadows. With a strong bump
 * map, the corrugation's tilted normals would catch that light on the *top* of the roof at
 * night. This rejects point lights that sit behind the true (un-bumped) surface.
 */
function blockLightFromBehind(material) {
  material.onBeforeCompile = (shader) => {
    const call = "getPointLightInfo( pointLight, geometryPosition, directLight );";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_begin>",
      THREE.ShaderChunk.lights_fragment_begin.replace(
        call,
        call + " directLight.color *= step( 0.0, dot( nonPerturbedNormal, directLight.direction ) );"
      )
    );
  };
  material.customProgramCacheKey = () => "blockLightFromBehind";
  return material;
}

export function createCanvasTexture(width, height, draw, { transparent = false } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!transparent) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Material library                                                    */
/* ------------------------------------------------------------------ */

export function createMaterials() {
  const floor = buildFloorTileMaps();
  const redWall = buildRedWallMaps();
  const soffit = buildSoffitMaps();
  const darkTimber = buildTimberMaps("#5c402c", 401);
  const benchTimber = buildTimberMaps("#4a3a30", 433);
  const plywoodTex = buildPlywoodTexture();
  const plaster = buildPlasterMaps();
  const steel = buildBrushedSteelMaps();
  const roof = buildRoofMetalMaps();
  const paver = buildPaverMaps();
  const grassTex = createGrassTexture();

  const redRepeat = [1 / RED_WALL_METRES, 1 / 0.92];
  const metric = (mat) => {
    mat.userData.metricUV = true;
    return mat;
  };

  const materials = {
    // ---- Structure & architecture ----
    floorTile: metric(
      new THREE.MeshStandardMaterial({
        map: floor.map,
        roughnessMap: floor.roughnessMap,
        bumpMap: floor.bumpMap,
        bumpScale: 0.6,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.55
      })
    ),
    stairTile: new THREE.MeshStandardMaterial({
      color: 0xeceef0,
      roughness: 0.22,
      metalness: 0.0,
      envMapIntensity: 0.6
    }),
    concreteColumn: new THREE.MeshStandardMaterial({
      map: buildColumnTexture(),
      roughness: 0.74,
      metalness: 0.0
    }),
    concretePlinth: metric(
      new THREE.MeshStandardMaterial({
        map: buildPlinthTexture(),
        roughness: 0.9,
        metalness: 0.0
      })
    ),
    whitePlaster: metric(
      new THREE.MeshStandardMaterial({
        map: plaster.map,
        bumpMap: plaster.bumpMap,
        bumpScale: 0.35,
        roughness: 0.86,
        metalness: 0.0
      })
    ),
    orangeBeam: new THREE.MeshStandardMaterial({
      color: 0xd0431f,
      roughness: 0.58,
      metalness: 0.0
    }),
    redCounterWall: metric(
      new THREE.MeshStandardMaterial({
        map: toTexture(redWall.map, { repeat: redRepeat }),
        bumpMap: toTexture(redWall.bump, { srgb: false, repeat: redRepeat }),
        bumpScale: 1.4,
        roughness: 0.82,
        metalness: 0.0
      })
    ),
    woodSoffit: new THREE.MeshStandardMaterial({
      map: soffit.map,
      bumpMap: soffit.bumpMap,
      bumpScale: 0.5,
      roughness: 0.62,
      metalness: 0.0
    }),
    roofMetal: blockLightFromBehind(
      new THREE.MeshStandardMaterial({
        map: roof.map,
        bumpMap: roof.bumpMap,
        bumpScale: 1.1,
        roughness: 0.52,
        metalness: 0.5
      })
    ),
    blackMullion: new THREE.MeshStandardMaterial({
      color: 0x1c2026,
      roughness: 0.42,
      metalness: 0.55
    }),
    blueHandrail: new THREE.MeshStandardMaterial({
      color: 0x1b3558,
      roughness: 0.4,
      metalness: 0.45
    }),
    clearGlass: new THREE.MeshStandardMaterial({
      color: 0xcfe3ea,
      transparent: true,
      opacity: 0.2,
      roughness: 0.04,
      metalness: 0.0,
      envMapIntensity: 2.4,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    frostedGlass: new THREE.MeshStandardMaterial({
      color: 0xeef4f8,
      transparent: true,
      opacity: 0.74,
      roughness: 0.7,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    lampShade: new THREE.MeshStandardMaterial({
      color: 0xf1f1ec,
      roughness: 0.32,
      metalness: 0.08,
      side: THREE.DoubleSide
    }),
    lampEmissive: new THREE.MeshStandardMaterial({
      color: 0xfff7e6,
      emissive: 0xffe9bd,
      emissiveIntensity: 1.6,
      roughness: 0.2
    }),

    // ---- Furniture & stalls ----
    darkWood: new THREE.MeshStandardMaterial({
      map: darkTimber.map,
      bumpMap: darkTimber.bumpMap,
      bumpScale: 0.9,
      roughness: 0.7,
      metalness: 0.0
    }),
    benchWood: new THREE.MeshStandardMaterial({
      map: benchTimber.map,
      bumpMap: benchTimber.bumpMap,
      bumpScale: 0.8,
      roughness: 0.62,
      metalness: 0.0
    }),
    lightWood: new THREE.MeshStandardMaterial({
      map: plywoodTex,
      roughness: 0.6,
      metalness: 0.0
    }),
    whiteTableTop: new THREE.MeshStandardMaterial({
      color: 0xe9ecef,
      roughness: 0.36,
      metalness: 0.0,
      envMapIntensity: 0.7
    }),
    steelFrame: new THREE.MeshStandardMaterial({
      color: 0xb4bcc4,
      roughness: 0.42,
      metalness: 0.7,
      envMapIntensity: 0.7
    }),
    // Blue-grey painted angle iron of the canteen picnic sets
    picnicFrame: new THREE.MeshStandardMaterial({
      color: 0x7f8f9c,
      roughness: 0.5,
      metalness: 0.35,
      envMapIntensity: 0.6
    }),
    picnicTop: new THREE.MeshStandardMaterial({
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      roughness: 1.0,
      metalness: 0.85,
      envMapIntensity: 0.75
    }),
    stainlessSteel: new THREE.MeshStandardMaterial({
      color: 0xd4dae0,
      roughness: 0.28,
      metalness: 0.9,
      envMapIntensity: 0.8
    }),
    cabinetWhite: new THREE.MeshStandardMaterial({
      color: 0xeceeea,
      roughness: 0.5,
      metalness: 0.1
    }),
    rustyTray: metric(
      new THREE.MeshStandardMaterial({
        map: buildRustTrayTexture(),
        roughness: 0.88,
        metalness: 0.15
      })
    ),

    // ---- Outdoor ----
    paver: metric(
      new THREE.MeshStandardMaterial({
        map: paver.map,
        bumpMap: paver.bumpMap,
        bumpScale: 1.2,
        roughness: 0.9,
        metalness: 0.0
      })
    ),
    grass: metric(
      new THREE.MeshStandardMaterial({
        map: grassTex,
        roughness: 0.95,
        metalness: 0.0
      })
    ),
    foliageDark: new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.85, metalness: 0.0 }),
    foliageBright: new THREE.MeshStandardMaterial({ color: 0x4c8c38, roughness: 0.82, metalness: 0.0 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.92, metalness: 0.0 }),

    // Helper factories for signage / accents
    createSignTexture,
    createCanvasTexture,
    createTiledFloorTexture,
    createTimberTexture
  };

  return materials;
}

