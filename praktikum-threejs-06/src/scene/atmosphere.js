import * as THREE from "three";

/**
 * Sky, sun and time of day.
 *
 * One procedural sky shader drives everything that depends on the hour:
 *   - the visible sky dome (gradient, sun disc + halo, drifting fbm clouds, stars)
 *   - the image-based lighting: the same shader is baked through PMREM into
 *     scene.environment, so steel, glass and glazed tile reflect the actual sky
 *   - the shadow-casting sun / moon directional light and the hemisphere fill
 *   - fog colour, exposure, and how hard the artificial lamps are working
 */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w; // pin to the far plane
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uSunStrength;
  uniform float uCloudCover;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      s += a * noise(p);
      p = p * 2.03 + vec2(17.1, 9.3);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);

    // Vertical gradient with a thicker, paler band of haze hugging the horizon
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
    col = mix(col, uHorizon * 1.08, exp(-h * 9.0) * 0.55);

    // Sun: wide warm scatter, tight halo, hard disc
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * uSunStrength * (pow(sd, 6.0) * 0.12 + pow(sd, 90.0) * 0.5);
    col += uSunColor * uSunStrength * smoothstep(0.99965, 0.99985, sd) * 14.0;

    // Cumulus layer projected onto a flat sheet, slowly drifting east
    if (d.y > 0.0) {
      vec2 p = d.xz / (d.y + 0.14) * 1.15 + vec2(uTime * 0.006, uTime * 0.002);
      float body = fbm(p);
      float detail = fbm(p * 3.1 + 4.0);
      float cover = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.3, body + detail * 0.18);
      // Light the side of each cloud that faces the sun
      float towardSun = fbm(p + uSunDir.xz * 0.12);
      float lit = clamp(0.55 + (body - towardSun) * 3.0 + detail * 0.3, 0.0, 1.0);
      vec3 cloud = mix(uCloudShade, uCloudLit, lit);
      cloud += uSunColor * uSunStrength * pow(sd, 12.0) * 0.25;
      float distFade = smoothstep(0.0, 0.2, d.y);
      col = mix(col, cloud, cover * distFade * 0.9);
    }

    // Stars
    if (uStars > 0.001 && d.y > 0.0) {
      vec2 sp = d.xz / (d.y + 0.35) * 90.0;
      float s = hash(floor(sp));
      float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + s * 80.0);
      float star = smoothstep(0.992, 1.0, s) * (1.0 - smoothstep(0.1, 0.5, length(fract(sp) - 0.5)));
      col += vec3(0.9, 0.95, 1.0) * star * twinkle * uStars * 1.6;
    }

    // Below the horizon: what the building "sees" bouncing off the ground
    col = mix(uGround, col, smoothstep(-0.06, 0.02, d.y));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const PALETTE = {
  zenith: { night: 0x040812, golden: 0x35548c, day: 0x2a69c4 },
  horizon: { night: 0x0d1626, golden: 0xf0a868, day: 0xb9d6ee },
  ground: { night: 0x07090d, golden: 0x8a705a, day: 0x9a9d94 },
  cloudLit: { night: 0x1a2233, golden: 0xffd2a0, day: 0xffffff },
  cloudShade: { night: 0x090d16, golden: 0x7a6a78, day: 0xb4bfcc },
  hemiSky: { night: 0x1b2740, golden: 0xf2c79c, day: 0xdcecff },
  hemiGround: { night: 0x0a0c10, golden: 0x6e5a48, day: 0x8c8f7e }
};

function blend3(target, entry, night, golden, day) {
  const sum = night + golden + day || 1;
  const cn = _c1.setHex(entry.night);
  const cg = _c2.setHex(entry.golden);
  const cd = _c3.setHex(entry.day);
  target.setRGB(
    (cn.r * night + cg.r * golden + cd.r * day) / sum,
    (cn.g * night + cg.g * golden + cd.g * day) / sum,
    (cn.b * night + cg.b * golden + cd.b * day) / sum
  );
  return target;
}
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _c3 = new THREE.Color();

export function createAtmosphere({ scene, renderer, focus = new THREE.Vector3(3.5, 0, -2.5) }) {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uSunStrength: { value: 1 },
    uCloudCover: { value: 0.52 },
    uStars: { value: 0 },
    uTime: { value: 0 }
  };

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), skyMaterial);
  sky.name = "SkyDome";
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  sky.userData.dynamic = true;
  scene.add(sky);

  // Separate tiny scene used only to bake the sky into the reflection/irradiance environment
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), skyMaterial));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null;
  let envDirty = true;
  let lastEnvBake = -1;

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 170;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2.5;
  sun.target.position.copy(focus);
  scene.add(sun, sun.target);

  scene.fog = new THREE.FogExp2(0xd7e7f2, 0.0062);

  const state = {
    time: 15.5,
    elevation: 0,
    lampFactor: 0,
    dayFactor: 1,
    exposure: 1
  };

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3(-0.35, 0.78, 0.5).normalize();
  const lightDir = new THREE.Vector3();
  const listeners = [];

  function setTime(hours) {
    state.time = hours;

    // Sun arcs east (+X) -> overhead -> west (-X), leaning toward the open south side (+Z)
    const a = ((hours - 6) / 12) * Math.PI;
    const tilt = 0.42;
    sunDir.set(Math.cos(a), Math.sin(a) * Math.cos(tilt), Math.sin(a) * Math.sin(tilt)).normalize();
    const elev = sunDir.y;
    state.elevation = elev;

    const night = 1 - smooth(-0.16, 0.04, elev);
    const day = smooth(0.1, 0.5, elev);
    const golden = Math.max(0, 1 - night - day);
    state.dayFactor = smooth(-0.08, 0.3, elev);
    state.lampFactor = 1 - smooth(-0.02, 0.2, elev);

    blend3(uniforms.uZenith.value, PALETTE.zenith, night, golden, day);
    blend3(uniforms.uHorizon.value, PALETTE.horizon, night, golden, day);
    blend3(uniforms.uGround.value, PALETTE.ground, night, golden, day);
    blend3(uniforms.uCloudLit.value, PALETTE.cloudLit, night, golden, day);
    blend3(uniforms.uCloudShade.value, PALETTE.cloudShade, night, golden, day);
    blend3(hemi.color, PALETTE.hemiSky, night, golden, day);
    blend3(hemi.groundColor, PALETTE.hemiGround, night, golden, day);

    // Sun colour warms and reddens toward the horizon
    const warm = smooth(0.0, 0.55, elev);
    uniforms.uSunColor.value.setRGB(1.0, 0.52 + 0.44 * warm, 0.22 + 0.66 * warm);
    uniforms.uSunStrength.value = smooth(-0.1, 0.08, elev);
    uniforms.uStars.value = night;
    uniforms.uSunDir.value.copy(sunDir);

    const sunPower = smooth(-0.015, 0.28, elev);
    const moonPower = smooth(-0.06, -0.22, elev);
    if (sunPower > 0.001) {
      lightDir.copy(sunDir);
      // Never let the shadow rays go fully horizontal
      lightDir.y = Math.max(lightDir.y, 0.09);
      lightDir.normalize();
      sun.color.copy(uniforms.uSunColor.value);
      sun.intensity = 3.1 * sunPower;
    } else {
      lightDir.copy(moonDir);
      sun.color.setRGB(0.56, 0.68, 1.0);
      sun.intensity = 0.32 * moonPower;
    }
    sun.position.copy(focus).addScaledVector(lightDir, 85);
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();

    hemi.intensity = 0.05 + 0.5 * state.dayFactor;
    scene.environmentIntensity = 0.75;
    state.exposure = 0.98 + night * 0.34 + golden * 0.06;

    scene.fog.color.copy(uniforms.uHorizon.value).multiplyScalar(0.96);
    scene.fog.density = 0.0062 - night * 0.002;

    envDirty = true;
    renderer.shadowMap.needsUpdate = true;
    for (const fn of listeners) fn(state);
  }

  function bakeEnvironment() {
    const target = pmrem.fromScene(envScene, 0, 0.1, 60);
    scene.environment = target.texture;
    if (envTarget) envTarget.dispose();
    envTarget = target;
    envDirty = false;
  }

  function update(elapsed, camera) {
    uniforms.uTime.value = elapsed;
    sky.position.copy(camera.position);
    const far = camera.far * 0.9;
    sky.scale.setScalar(far / 100);
    if (envDirty && elapsed - lastEnvBake > 0.12) {
      bakeEnvironment();
      lastEnvBake = elapsed;
    }
  }

  return {
    state,
    sun,
    hemi,
    sky,
    sunDirection: sunDir,
    setTime,
    update,
    onChange: (fn) => listeners.push(fn),
    forceEnvironment: bakeEnvironment
  };
}
