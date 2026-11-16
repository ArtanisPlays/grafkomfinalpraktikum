import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Static batching.
 *
 * The scene is assembled from thousands of tiny meshes (every table leg, mullion and bottle
 * is its own box). That is pleasant to author but costs one draw call each - and the frame
 * is rendered several times over (shadow map, floor reflection, AO G-buffer, beauty pass).
 *
 * This bakes every non-moving mesh into world space and merges them per material, turning
 * thousands of draw calls into roughly one per material. Anything under an object flagged
 * `userData.dynamic` (see animation.js) is skipped and keeps animating normally.
 */
export function mergeStaticMeshes(root) {
  root.updateMatrixWorld(true);

  const buckets = new Map();
  const consumed = [];
  let sourceCount = 0;

  const visit = (obj) => {
    if (obj.userData.dynamic || obj.userData.noMerge || !obj.visible) return;
    if (
      obj.isMesh &&
      !obj.isInstancedMesh &&
      !obj.isSkinnedMesh &&
      !obj.isReflector &&
      obj.children.length === 0 &&
      obj.geometry &&
      obj.geometry.attributes.position &&
      !Array.isArray(obj.material)
    ) {
      const palette = isPlainColour(obj.material);
      const sig = palette ? paletteSignature(obj.material) : materialSignature(obj.material);
      const key = `${sig}|${obj.castShadow ? 1 : 0}${obj.receiveShadow ? 1 : 0}|${obj.renderOrder}|${obj.layers.mask}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          material: palette ? paletteMaterial(obj.material) : obj.material,
          cast: obj.castShadow,
          receive: obj.receiveShadow,
          order: obj.renderOrder,
          layers: obj.layers.mask,
          geos: []
        };
        buckets.set(key, bucket);
      }
      bucket.geos.push(bakeGeometry(obj, palette));
      consumed.push(obj);
      sourceCount++;
      return;
    }
    for (let i = 0; i < obj.children.length; i++) visit(obj.children[i]);
  };
  visit(root);

  for (const mesh of consumed) mesh.removeFromParent();

  const mergedGroup = new THREE.Group();
  mergedGroup.name = "StaticBatches";
  let batchCount = 0;
  for (const bucket of buckets.values()) {
    const geometry = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
    if (!geometry) continue;
    for (const g of bucket.geos) if (g !== geometry) g.dispose();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.order;
    mesh.layers.mask = bucket.layers;
    mesh.matrixAutoUpdate = false;
    mesh.userData.staticBatch = true;
    mergedGroup.add(mesh);
    batchCount++;
  }
  root.add(mergedGroup);

  pruneEmptyGroups(root);
  return { sourceCount, batchCount };
}

/**
 * Many builders create look-alike materials inline (`new MeshStandardMaterial({ color })` per prop).
 * Two materials that would render identically share a batch, unless one is flagged
 * `userData.unique` because it is animated or patched on its own later.
 */
const _signatures = new WeakMap();
function materialSignature(m) {
  if (m.userData.unique || m.isShaderMaterial || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m.uuid;
  let sig = _signatures.get(m);
  if (sig) return sig;
  const tex = (t) => (t ? `${t.uuid}` : "-");
  const col = (c) => (c ? c.getHexString() : "-");
  sig = [
    m.type,
    col(m.color),
    col(m.emissive),
    m.emissiveIntensity ?? 0,
    m.roughness ?? 0,
    m.metalness ?? 0,
    m.opacity,
    m.transparent ? 1 : 0,
    m.side,
    m.depthWrite ? 1 : 0,
    m.depthTest ? 1 : 0,
    m.alphaTest,
    m.blending,
    m.flatShading ? 1 : 0,
    m.vertexColors ? 1 : 0,
    m.wireframe ? 1 : 0,
    m.toneMapped ? 1 : 0,
    m.fog ? 1 : 0,
    m.polygonOffset ? `${m.polygonOffsetFactor},${m.polygonOffsetUnits}` : 0,
    m.envMapIntensity ?? 1,
    m.bumpScale ?? 0,
    tex(m.map),
    tex(m.bumpMap),
    tex(m.normalMap),
    tex(m.roughnessMap),
    tex(m.metalnessMap),
    tex(m.alphaMap),
    tex(m.emissiveMap),
    tex(m.aoMap),
    m.userData.metricUV ? 1 : 0
  ].join("|");
  _signatures.set(m, sig);
  return sig;
}

/**
 * Palette folding.
 *
 * Hundreds of props use an untextured, single-colour standard material (a red stool, a grey
 * bracket, a blue shirt...). Each distinct colour would be its own draw call - in every render
 * pass. Instead their colour, roughness and metalness are baked into vertex attributes and
 * they all share one patched material, so the whole lot draws in a handful of calls.
 */
const _black = new THREE.Color(0x000000);
function isPlainColour(m) {
  return (
    m.type === "MeshStandardMaterial" &&
    !m.userData.unique &&
    m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
    !m.map &&
    !m.bumpMap &&
    !m.normalMap &&
    !m.roughnessMap &&
    !m.metalnessMap &&
    !m.alphaMap &&
    !m.emissiveMap &&
    !m.aoMap &&
    !m.envMap &&
    !m.transparent &&
    m.opacity === 1 &&
    m.alphaTest === 0 &&
    m.emissive.equals(_black) &&
    !m.vertexColors &&
    !m.wireframe &&
    !m.polygonOffset &&
    m.depthWrite &&
    m.depthTest &&
    m.blending === THREE.NormalBlending &&
    m.toneMapped &&
    m.fog
  );
}

function paletteSignature(m) {
  return `palette|${m.side}|${m.flatShading ? 1 : 0}|${Math.round((m.envMapIntensity ?? 1) * 4)}`;
}

const _paletteMaterials = new Map();
function paletteMaterial(source) {
  const key = paletteSignature(source);
  let material = _paletteMaterials.get(key);
  if (material) return material;
  material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: source.side,
    flatShading: source.flatShading,
    envMapIntensity: Math.round((source.envMapIntensity ?? 1) * 4) / 4
  });
  const NL = String.fromCharCode(10);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>" + NL + "attribute vec2 surface;" + NL + "varying vec2 vSurface;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>" + NL + "vSurface = surface;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>" + NL + "varying vec2 vSurface;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>" + NL + "roughnessFactor = vSurface.x;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>" + NL + "metalnessFactor = vSurface.y;");
  };
  material.customProgramCacheKey = () => "palette";
  material.userData.palette = true;
  material.name = `Palette ${key}`;
  _paletteMaterials.set(key, material);
  return material;
}

/** Clones a mesh's geometry into world space with a uniform attribute layout. */
function bakeGeometry(mesh, palette = false) {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();

  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  }
  // Vertex colours survive only for materials that use them (every mesh in such a bucket gets them)
  const wantsColor = palette || mesh.material.vertexColors === true;
  if (palette) {
    const count = geo.attributes.position.count;
    const { r, g, b } = mesh.material.color;
    const colours = new Float32Array(count * 3);
    const surface = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      colours[i * 3] = r;
      colours[i * 3 + 1] = g;
      colours[i * 3 + 2] = b;
      surface[i * 2] = mesh.material.roughness;
      surface[i * 2 + 1] = mesh.material.metalness;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geo.setAttribute("surface", new THREE.Float32BufferAttribute(surface, 2));
  } else if (wantsColor && (!geo.attributes.color || geo.attributes.color.itemSize !== 3)) {
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  }
  for (const name of Object.keys(geo.attributes)) {
    if (name === "color" && wantsColor) continue;
    if (name === "surface" && palette) continue;
    if (name !== "position" && name !== "normal" && name !== "uv") geo.deleteAttribute(name);
  }
  geo.morphAttributes = {};
  geo.clearGroups();

  // Interleaved or exotic attribute storage would break mergeGeometries: normalise to plain Float32
  const names = ["position", "normal", "uv"];
  if (wantsColor) names.push("color");
  if (palette) names.push("surface");
  for (const name of names) {
    const attr = geo.attributes[name];
    if (attr.isInterleavedBufferAttribute || !(attr.array instanceof Float32Array)) {
      const size = attr.itemSize;
      const arr = new Float32Array(attr.count * size);
      for (let i = 0; i < attr.count; i++) {
        arr[i * size] = attr.getX(i);
        arr[i * size + 1] = attr.getY(i);
        if (size > 2) arr[i * size + 2] = attr.getZ(i);
      }
      geo.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    }
  }

  geo.applyMatrix4(mesh.matrixWorld);

  // Mirrored transforms flip triangle winding; restore it so back-face culling still works
  if (mesh.matrixWorld.determinant() < 0) {
    for (const name of names) {
      const attr = geo.attributes[name];
      const size = attr.itemSize;
      const a = attr.array;
      for (let i = 0; i < attr.count; i += 3) {
        for (let k = 0; k < size; k++) {
          const i1 = (i + 1) * size + k;
          const i2 = (i + 2) * size + k;
          const tmp = a[i1];
          a[i1] = a[i2];
          a[i2] = tmp;
        }
      }
    }
  }
  return geo;
}

function pruneEmptyGroups(obj) {
  for (let i = obj.children.length - 1; i >= 0; i--) {
    const child = obj.children[i];
    if (child.userData.dynamic) continue;
    pruneEmptyGroups(child);
    if (child.isGroup && child.children.length === 0 && !child.userData.keep) obj.remove(child);
  }
}
