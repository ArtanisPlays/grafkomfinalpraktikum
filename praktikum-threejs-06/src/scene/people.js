import * as THREE from "three";

export function createPeople(layoutSpec, materials) {
  const group = new THREE.Group();
  group.name = "People";
  return group;
}
