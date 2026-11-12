import * as THREE from "three";

export function createSurroundings(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "Surroundings";
  return group;
}
