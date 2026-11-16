import * as THREE from "three";
import { registerAnimator } from "./animation.js";

/**
 * Wind and foliage helpers.
 *
 * - foliageBlob(): a lumpy, leafy-looking crown mesh (displaced icosphere that keeps soft
 *   spherical normals, so clumps shade like volumes of leaves instead of faceted balls)
 * - applyWind(): patches a standard material so its vertices sway with a shared wind clock;
 *   works on statically batched geometry because the sway is derived from world position
 */

export const windUniforms = { uWindTime: { value: 0 } };
registerAnimator((time) => {
  windUniforms.uWindTime.value = time;
});

const glsl = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const LEAF_NOISE = `
  varying vec3 vLeafPos;
  float leafHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float leafNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(leafHash(i), leafHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(leafHash(i + vec3(0.0, 1.0, 0.0)), leafHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(leafHash(i + vec3(0.0, 0.0, 1.0)), leafHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(leafHash(i + vec3(0.0, 1.0, 1.0)), leafHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }
`;

/**
 * `leaf` > 0 additionally gives the surface a leafy look: world-space clumps of lighter and
 * darker foliage, and a ragged, see-through fringe along the silhouette (fragments near the
 * rim are discarded by the same noise), so crowns stop reading as smooth blobs.
 */
export function applyWind(material, { strength = 0.05, minY = 1.2, maxY = 6.0, leaf = 0 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.vertexShader =
      "uniform float uWindTime;\n" +
      (leaf > 0 ? "varying vec3 vLeafPos;\n" : "") +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec4 windPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #else
            vec4 windPos = modelMatrix * vec4(transformed, 1.0);
          #endif
          ${leaf > 0 ? "vLeafPos = windPos.xyz;" : ""}
          float sway = smoothstep(${glsl(minY)}, ${glsl(maxY)}, windPos.y) * ${glsl(strength)};
          float ph = windPos.x * 0.35 + windPos.z * 0.27;
          float gust = 0.6 + 0.4 * sin(uWindTime * 0.31 + ph * 0.2);
          transformed.x += (sin(uWindTime * 1.1 + ph) + 0.5 * sin(uWindTime * 2.7 + ph * 2.3)) * sway * gust;
          transformed.z += cos(uWindTime * 0.9 + ph * 1.3) * sway * 0.7 * gust;
          transformed.y += sin(uWindTime * 3.1 + ph * 4.0 + windPos.y) * sway * 0.22;
        }`
      );
    if (leaf > 0) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + LEAF_NOISE)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec3 lp = vLeafPos * ${glsl(leaf)};
            float leafA = leafNoise(lp);
            float leafB = leafNoise(lp * 2.9 + 17.0);
            float leafC = leafNoise(lp * 7.3 + 41.0);
            float leafMix = leafA * 0.6 + leafB * 0.4;
            // Clumps of leaves catching the light, with dark gaps between them
            float clump = smoothstep(0.32, 0.62, leafMix);
            float speck = smoothstep(0.35, 0.75, leafC);
            diffuseColor.rgb *= (0.42 + clump * 0.72) * (0.8 + speck * 0.42);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.1, 0.62), smoothstep(0.55, 0.85, leafB) * 0.7);
            float rim = abs(dot(normalize(vNormal), normalize(vViewPosition)));
            if (rim < 0.5 && leafMix * 0.75 + leafC * 0.25 < 0.33 + (0.5 - rim) * 1.5) discard;
          }`
        );
    }
  };
  material.customProgramCacheKey = () => `wind|${strength}|${minY}|${maxY}|${leaf}`;
  material.userData.unique = true;
  material.needsUpdate = true;
  return material;
}

/** Grass variant: sways by blade height (uv.y), independent of world height. */
export function applyGrassWind(material, strength = 0.06) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.vertexShader =
      "uniform float uWindTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec4 windPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #else
            vec4 windPos = modelMatrix * vec4(transformed, 1.0);
          #endif
          float bend = uv.y * uv.y * ${glsl(strength)};
          float ph = windPos.x * 0.9 + windPos.z * 0.7;
          transformed.x += (sin(uWindTime * 1.7 + ph) + 0.4 * sin(uWindTime * 4.1 + ph * 2.1)) * bend;
          transformed.z += cos(uWindTime * 1.3 + ph * 1.4) * bend * 0.6;
        }`
      );
  };
  material.customProgramCacheKey = () => `grasswind|${strength}`;
  material.userData.unique = true;
  material.needsUpdate = true;
  return material;
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}

const _blobCache = new Map();

/**
 * Unit-radius leafy crown. `variant` picks one of a few cached shapes.
 * Vertex colours carry a subtle top-lit / shaded-underside gradient plus leaf mottling.
 */
export function foliageBlob(variant = 0, detail = 2) {
  const key = `${variant % 4}|${detail}`;
  let geo = _blobCache.get(key);
  if (geo) return geo;

  geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const colors = new Float32Array(pos.count * 3);
  const seed = (variant % 4) * 17.3;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n1 = noise3(v.x * 2.1 + seed, v.y * 2.1 + seed * 0.7, v.z * 2.1 - seed);
    const n2 = noise3(v.x * 5.3 - seed, v.y * 5.3 + seed, v.z * 5.3 + seed * 0.3);
    const r = 0.74 + n1 * 0.4 + n2 * 0.16;
    // Slightly flattened underside like a real canopy
    const squash = v.y < 0 ? 1 + v.y * 0.28 : 1;
    pos.setXYZ(i, v.x * r, v.y * r * squash, v.z * r);
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y * 0.8 + 0.2;
    normals[i * 3 + 2] = v.z;
    const shade = 0.62 + 0.3 * (v.y * 0.5 + 0.5) + (n2 - 0.5) * 0.3 + (n1 - 0.5) * 0.2;
    colors[i * 3] = shade * (0.96 + n2 * 0.1);
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * (0.86 + n1 * 0.1);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.normalizeNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  _blobCache.set(key, geo);
  return geo;
}
