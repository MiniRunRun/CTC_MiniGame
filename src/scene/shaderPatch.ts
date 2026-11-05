// Stacks several shader patches (onBeforeCompile) on one three.js material — e.g. part color and animation both
// inject code into the same MeshStandardMaterial. Each patch adds a key so three compiles a separate program for
// every combination instead of reusing a wrong cached one.
import type * as THREE from "three";

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];

export function patchShader(material: THREE.Material, key: string, patch: (shader: Shader) => void) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    patch(shader);
  };
  const keys: string[] = (material.userData.patchKeys ??= []);
  keys.push(key);
  material.customProgramCacheKey = () => keys.join("|");
  material.needsUpdate = true;
}
