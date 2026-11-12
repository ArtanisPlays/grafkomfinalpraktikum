/**
 * Deterministic noise + canvas helpers shared by every procedural texture and scatter routine.
 * Everything here is seeded so the scene builds identically on every reload.
 */

export function createRng(seed = 1337) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Smooth value noise on an integer lattice that wraps every (px, py) cells,
 * which makes anything built from it seamlessly tileable.
 */
export function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % px) + px) % px;
  const xb = (xa + 1) % px;
  const ya = ((y0 % py) + py) % py;
  const yb = (ya + 1) % py;
  const a = hash2(xa, ya, seed);
  const b = hash2(xb, ya, seed);
  const c = hash2(xa, yb, seed);
  const d = hash2(xb, yb, seed);
  return a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy;
}

/**
 * Tileable fractal noise over the unit square. (fu, fv) are the base lattice
 * frequencies along u and v, so non-square textures keep isotropic features.
 */
export function fbm(u, v, fu, fv, octaves = 4, seed = 1, gain = 0.5) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let pu = fu;
  let pv = fv;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(u * pu, v * pv, pu, pv, seed + i * 31);
    norm += amp;
    amp *= gain;
    pu *= 2;
    pv *= 2;
  }
  return sum / norm;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function makeCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Fills one or more same-sized canvases per pixel. `fn(u, v, out)` writes RGB triples
 * into out[0..n-1] (each a 3-element array), one per requested layer.
 */
export function paintPixels(w, h, layers, fn) {
  const canvases = [];
  const images = [];
  const outs = [];
  for (let i = 0; i < layers; i++) {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    canvases.push(canvas);
    images.push(ctx.createImageData(w, h));
    outs.push([0, 0, 0]);
  }
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      fn((x + 0.5) / w, v, outs, x, y);
      const idx = (y * w + x) * 4;
      for (let l = 0; l < layers; l++) {
        const d = images[l].data;
        const o = outs[l];
        d[idx] = o[0];
        d[idx + 1] = o[1];
        d[idx + 2] = o[2];
        d[idx + 3] = 255;
      }
    }
  }
  for (let i = 0; i < layers; i++) {
    canvases[i].getContext("2d").putImageData(images[i], 0, 0);
  }
  return canvases;
}
