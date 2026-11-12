import * as THREE from "three";

/**
 * Rewrites a geometry's UVs so that 1 UV unit = 1 metre, projected along the dominant
 * axis of each vertex normal (a cheap triplanar unwrap). Textures flagged with
 * `material.userData.metricUV` then tile at real-world scale on any box, no matter how
 * long or thin it is, and neighbouring boxes line up when given their world offsets.
 */
export function applyMetricUV(geometry, ox = 0, oy = 0, oz = 0) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (!pos || !nor || !uv) return geometry;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox;
    const y = pos.getY(i) + oy;
    const z = pos.getZ(i) + oz;
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x, z);
    else if (ax >= az) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Applies metric UVs only when the material asks for them. */
export function metricIfFlagged(geometry, material, ox = 0, oy = 0, oz = 0) {
  if (material && material.userData && material.userData.metricUV) {
    applyMetricUV(geometry, ox, oy, oz);
  }
  return geometry;
}

/** Convenience mesh factory used by the detail builders. */
export function box(w, h, d, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  metricIfFlagged(geo, material, x, y, z);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function cyl(rTop, rBottom, h, material, x = 0, y = 0, z = 0, segments = 14, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Thin round tube following a list of [x, y, z] points (conduits, cables, handrails). */
export function tube(points, radius, material, { segments = 0, radial = 6, curved = false, cast = false } = {}) {
  const vecs = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const curve = curved
    ? new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.5)
    : new THREE.CurvePath();
  if (!curved) {
    for (let i = 0; i < vecs.length - 1; i++) curve.add(new THREE.LineCurve3(vecs[i], vecs[i + 1]));
  }
  const segs = segments || (curved ? vecs.length * 8 : (vecs.length - 1) * 2);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, radial, false), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Flat textured quad lying on a horizontal surface (floor decals, mats, paper). */
export function floorDecal(w, d, material, x, y, z, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotY;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

/** Curved label wrapped around a round column, centred on world angle `facing` (radians, 0 = +Z). */
export function columnWrap(radius, width, height, material, x, y, z, facing = 0) {
  const theta = width / radius;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 16, 1, true, facing - theta / 2, theta);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Straight round bar between two [x, y, z] points (pipes, conduits, legs, broom handles). */
export function rod(a, b, radius, material, { radial = 6, cast = false, receive = true, radiusEnd = radius } = {}) {
  _a.set(a[0], a[1], a[2]);
  _b.set(b[0], b[1], b[2]);
  const len = _a.distanceTo(_b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, len, radial), material);
  mesh.position.copy(_a).add(_b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Upright textured card facing +Z (posters, signs, screens). Rotate the result as needed. */
export function card(w, h, material, x = 0, y = 0, z = 0, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.receiveShadow = true;
  return mesh;
}

/** Box running along a slope in the YZ plane, from (z1, y1) to (z2, y2) at a fixed x. */
export function slopedBarZ(x, z1, y1, z2, y2, width, height, material, { cast = true } = {}) {
  const dz = z2 - z1;
  const dy = y2 - y1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, Math.hypot(dz, dy)), material);
  mesh.position.set(x, (y1 + y2) / 2, (z1 + z2) / 2);
  mesh.rotation.x = -Math.atan2(dy, dz);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Box running along a slope in the XY plane, from (x1, y1) to (x2, y2) at a fixed z. */
export function slopedBarX(z, x1, y1, x2, y2, height, depth, material, { cast = true } = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), height, depth), material);
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  mesh.rotation.z = Math.atan2(dy, dx);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Small cache of plain coloured materials so look-alike props share one material (and one draw call). */
const _flatCache = new Map();
export function flatMat(color, { roughness = 0.7, metalness = 0, emissive = 0x000000, emissiveIntensity = 1, side = THREE.FrontSide, envMapIntensity = 1 } = {}) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${side}|${envMapIntensity}`;
  let mat = _flatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, side, envMapIntensity });
    _flatCache.set(key, mat);
  }
  return mat;
}

/** Decal material: sits on top of a surface without z-fighting. */
export function decalMat(map, { transparent = false, opacity = 1, roughness = 0.8, color = 0xffffff, side = THREE.FrontSide } = {}) {
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0,
    transparent,
    opacity,
    depthWrite: !transparent,
    side,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
}
