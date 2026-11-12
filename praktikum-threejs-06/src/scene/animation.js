/**
 * Tiny animation registry. Scene builders register per-frame callbacks here (fan rotors,
 * the swinging ceiling panel, the cats, the walking student...) and main.js drives them.
 *
 * Anything that moves must also be flagged with markDynamic() so the static-geometry
 * merger in optimize.js leaves it alone.
 */

const animators = [];

export function registerAnimator(fn) {
  animators.push(fn);
}

export function updateAnimators(time, dt) {
  for (let i = 0; i < animators.length; i++) animators[i](time, dt);
}

export function markDynamic(object) {
  object.userData.dynamic = true;
  return object;
}
