import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/**
 * Glazed-tile floor reflections.
 *
 * The single strongest visual cue in the reference photos is the wet-look ceramic floor
 * mirroring the bright garden, the window grid and the columns. A planar Reflector renders
 * the scene mirrored about y = 0; instead of drawing it as a perfect mirror, this overlay
 * shader composites it on top of the real tile material:
 *
 *   - Fresnel weighted: barely visible looking straight down, strong at grazing angles
 *   - every 50 cm tile gets its own tiny random tilt, so reflections break at grout lines
 *     exactly like a real, slightly uneven tiled floor
 *   - grout joints are matte and do not reflect
 *   - a small disc blur that widens with distance from the eye keeps it glossy, not chrome
 */

const vertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vReflUv;
  varying vec3 vWorld;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vReflUv = textureMatrix * vec4(position, 1.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform float uStrength;
  uniform float uTileSize;
  varying vec4 vReflUv;
  varying vec3 vWorld;
  #include <common>
  #include <logdepthbuf_pars_fragment>

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    float ndv = clamp(toEye.y / dist, 0.0, 1.0);

    // Schlick Fresnel for a glazed dielectric, boosted a little: polished ceramic is shinier than F0 suggests
    float fresnel = 0.045 + 0.955 * pow(1.0 - ndv, 4.2);

    // Per-tile micro tilt + matte grout
    vec2 tc = vWorld.xz / uTileSize;
    vec2 id = floor(tc);
    vec2 f = fract(tc);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float grout = smoothstep(0.004, 0.016, edge);
    vec2 tilt = (vec2(hash21(id), hash21(id + 19.19)) - 0.5) * 0.0075;
    float sheen = 0.78 + 0.22 * hash21(id + 7.7);

    vec2 uv = vReflUv.xy / vReflUv.w + tilt * (0.35 + 0.65 * (1.0 - ndv));

    // Poisson-disc blur, wider further away where the pixel footprint on the floor grows
    float radius = 0.0016 + 0.0009 * clamp(dist / 18.0, 0.0, 1.5);
    vec3 acc = texture2D(tDiffuse, uv).rgb * 2.0;
    acc += texture2D(tDiffuse, uv + radius * vec2( 0.94,  0.26)).rgb;
    acc += texture2D(tDiffuse, uv + radius * vec2(-0.71,  0.68)).rgb;
    acc += texture2D(tDiffuse, uv + radius * vec2( 0.18, -0.97)).rgb;
    acc += texture2D(tDiffuse, uv + radius * vec2(-0.88, -0.38)).rgb;
    acc += texture2D(tDiffuse, uv + radius * vec2( 0.52,  0.84)).rgb * 0.75;
    acc += texture2D(tDiffuse, uv + radius * vec2( 0.61, -0.62)).rgb * 0.75;
    acc += texture2D(tDiffuse, uv + radius * vec2(-0.29, -0.17)).rgb * 0.75;
    acc += texture2D(tDiffuse, uv + radius * vec2(-0.15,  1.72)).rgb * 0.5;
    acc += texture2D(tDiffuse, uv + radius * vec2( 0.10, -1.80)).rgb * 0.5;
    vec3 refl = acc / 9.25;

    float alpha = clamp(fresnel * uStrength * sheen, 0.0, 0.9) * grout;
    gl_FragColor = vec4(refl * color, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createFloorReflection(layoutSpec, { resolution = 1024 } = {}) {
  const { mainHall, steelWing } = layoutSpec.wings;

  // L-shaped outline of both tiled wings, drawn in XY so the Reflector's +Z normal becomes +Y once laid flat
  const inset = 0.01;
  const outline = [
    [mainHall.minX + inset, mainHall.minZ + inset],
    [steelWing.minX, mainHall.minZ + inset],
    [steelWing.minX, steelWing.minZ + inset],
    [steelWing.maxX - inset, steelWing.minZ + inset],
    [steelWing.maxX - inset, steelWing.maxZ - inset],
    [mainHall.maxX, steelWing.maxZ - inset],
    [mainHall.maxX, mainHall.maxZ - inset],
    [mainHall.minX + inset, mainHall.maxZ - inset]
  ];
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();

  const reflector = new Reflector(new THREE.ShapeGeometry(shape), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: 0.002,
    multisample: 0,
    color: 0xffffff,
    shader: {
      name: "TileFloorReflection",
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        uStrength: { value: 1.55 },
        uTileSize: { value: layoutSpec.tileSize }
      },
      vertexShader,
      fragmentShader
    }
  });

  reflector.name = "FloorReflection";
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = layoutSpec.floorY + 0.004;
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.material.polygonOffset = true;
  reflector.material.polygonOffsetFactor = -2;
  reflector.material.polygonOffsetUnits = -2;
  reflector.renderOrder = 5;
  reflector.userData.dynamic = true;
  return reflector;
}
