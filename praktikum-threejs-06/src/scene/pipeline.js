import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Render pipeline with selectable quality tiers.
 *
 *   beauty pass (MSAA, HDR half-float)
 *     -> GTAO  ground-truth ambient occlusion: contact shadows under every table, bench,
 *              bin and in every corner - essential under the roof where the sun never reaches
 *     -> bloom only on over-bright pixels: lamp globes, the sun, hot speculars
 *     -> ACES filmic tone map + sRGB
 *
 * "low" bypasses the composer entirely and renders straight to the canvas.
 */

export const QUALITY_LEVELS = {
  ultra: { label: "Ultra", maxDpr: 2, msaa: 4, ao: true, aoSamples: 16, bloom: true, reflection: true, shadows: true },
  high: { label: "High", maxDpr: 1.5, msaa: 4, ao: true, aoSamples: 12, bloom: true, reflection: true, shadows: true },
  medium: { label: "Medium", maxDpr: 1.25, msaa: 4, ao: false, aoSamples: 0, bloom: true, reflection: true, shadows: true },
  low: { label: "Low", maxDpr: 1, msaa: 0, ao: false, aoSamples: 0, bloom: false, reflection: false, shadows: true }
};

export const QUALITY_ORDER = ["ultra", "high", "medium", "low"];

export function createPipeline({ renderer, scene, camera, reflector, aoHidden = [] }) {
  let composer = null;
  let gtao = null;
  let bloom = null;
  let current = "high";
  const size = new THREE.Vector2();

  function dispose() {
    if (!composer) return;
    for (const pass of composer.passes) pass.dispose?.();
    composer.renderTarget1.dispose();
    composer.renderTarget2.dispose();
    composer = null;
    gtao = null;
    bloom = null;
  }

  function build() {
    dispose();
    const q = QUALITY_LEVELS[current];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxDpr));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reflector) reflector.visible = q.reflection;

    if (current === "low") return;

    renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa
    });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));

    if (q.ao) {
      gtao = new GTAOPass(scene, camera, size.x, size.y);
      gtao.blendIntensity = 1.0;
      gtao.updateGtaoMaterial({
        radius: 0.55,
        distanceExponent: 1.4,
        thickness: 1.6,
        scale: 1.25,
        samples: q.aoSamples,
        distanceFallOff: 1.0,
        screenSpaceRadius: false
      });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });

      // The AO G-buffer pass re-renders the scene with a normal material. The floor reflector must sit
      // that pass out, otherwise it would re-render (and trash) its mirror texture for nothing.
      const baseRender = gtao.render.bind(gtao);
      const restore = [];
      gtao.render = (...args) => {
        const wasVisible = reflector ? reflector.visible : false;
        if (reflector) reflector.visible = false;
        // Glass panes, decals and the sky dome would otherwise occlude whatever is behind them
        restore.length = 0;
        for (const obj of aoHidden) {
          if (obj.visible) {
            obj.visible = false;
            restore.push(obj);
          }
        }
        baseRender(...args);
        for (const obj of restore) obj.visible = true;
        if (reflector) reflector.visible = wasVisible;
      };
      composer.addPass(gtao);
    }

    if (q.bloom) {
      bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.2, 0.55, 1.05);
      composer.addPass(bloom);
    }

    composer.addPass(new OutputPass());
  }

  function setQuality(level) {
    if (!QUALITY_LEVELS[level]) return;
    current = level;
    build();
  }

  function resize() {
    build();
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  return {
    setQuality,
    resize,
    render,
    get quality() {
      return current;
    },
    get bloom() {
      return bloom;
    },
    get gtao() {
      return gtao;
    }
  };
}
