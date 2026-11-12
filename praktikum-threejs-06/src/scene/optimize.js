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
      const key = `${materialSignature(obj.material)}|${obj.castShadow ? 1 : 0}${obj.receiveShadow ? 1 : 0}|${obj.renderOrder}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, order: obj.renderOrder, geos: [] };
        buckets.set(key, bucket);
      }
      bucket.geos.push(bakeGeometry(obj));
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

/** Clones a mesh's geometry into world space with a uniform attribute layout. */
function bakeGeometry(mesh) {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();

  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  }
  for (const name of Object.keys(geo.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") geo.deleteAttribute(name);
  }
  geo.morphAttributes = {};
  geo.clearGroups();

  // Interleaved or exotic attribute storage would break mergeGeometries: normalise to plain Float32
  for (const name of ["position", "normal", "uv"]) {
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
    for (const name of ["position", "normal", "uv"]) {
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
