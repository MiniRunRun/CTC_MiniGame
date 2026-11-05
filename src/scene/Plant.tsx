// The 3D plant: reads the flower settings from the store and turns them into meshes.
//   layoutPlant()  → where flowers, buds and leaves go (+ the stem tubes)
//   assemble()     → one transform per copy of each part
//   <Instances>    → draws all copies of a part in one InstancedMesh (one draw call)
// Each geometry is rebuilt only when its own settings change.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { usePlant } from "../state/store";
import { layoutPlant } from "../plant/layout";
import { assemble } from "../plant/assemble";
import { buildPetalGeometry } from "../plant/petal";
import { buildCenter } from "../plant/center";
import { buildLeafGeometry } from "../plant/leaf";
import { buildBudGeometry, buildSepalGeometry } from "../plant/sepal";
import { buildFusedFlower } from "../plant/fused";
import { makeMatcapTexture } from "./matcap";
import type { LookSpec } from "../plant/spec";

/** Free GPU memory for geometries/materials we no longer show. */
function useDisposeOnChange(items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((x) => x.dispose()), [items]);
}

/** Draws `geometry` once per matrix, as a single InstancedMesh. */
function Instances({ geometry, material, matrices }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // geometry/material are constructor args: changing them makes a new mesh that needs its matrices again.
  }, [matrices, geometry, material]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      // Instance count is fixed at creation, so remount when it changes.
      key={matrices.length}
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow
      frustumCulled={false} // copies are spread out; skip the single bounding-box cull
    />
  );
}

/**
 * One material for a part. Natural look: lit by the scene lights. Pearl look: matcap ("painted light"),
 * tinted by the part's own colors only if look.tint is on.
 * `vertexColors` = the part's colors live in the geometry; otherwise `color` is used.
 */
function partMaterial(look: LookSpec, matcap: THREE.Texture | null, o: {
  vertexColors?: boolean; color?: string; doubleSide?: boolean; roughness: number;
}): THREE.Material {
  const side = o.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  if (look.style === "pearl" && matcap) {
    return new THREE.MeshMatcapMaterial({
      matcap,
      side,
      vertexColors: look.tint && !!o.vertexColors,
      color: look.tint && o.color ? o.color : "#ffffff",
    });
  }
  return new THREE.MeshStandardMaterial({ vertexColors: !!o.vertexColors, color: o.color ?? "#ffffff", side, roughness: o.roughness });
}

export default function Plant() {
  const spec = usePlant((s) => s.spec);

  const layout = useMemo(
    () => layoutPlant(spec),
    // Only the settings that move things around; petal colors, center looks etc. don't change the layout.
    [spec.stem, spec.leaves, spec.architecture, spec.sepals.budCount, spec.petals.size],
  );
  const parts = useMemo(
    () => assemble(spec, layout),
    [layout, spec.petals, spec.center.size, spec.sepals.count],
  );

  // Geometries (one per part type)
  const petal = useMemo(() => buildPetalGeometry(spec.petals), [spec.petals]);
  const sepal = useMemo(() => buildSepalGeometry(spec.sepals, spec.petals.size), [spec.sepals, spec.petals.size]);
  const leaf = useMemo(() => buildLeafGeometry(spec.leaves), [spec.leaves]);
  const bud = useMemo(() => buildBudGeometry(spec.sepals, spec.petals), [spec.sepals, spec.petals]);
  const receptacle = useMemo(() => new THREE.SphereGeometry(spec.stem.thickness * 0.9, 16, 10), [spec.stem.thickness]);
  const center = useMemo(() => buildCenter(spec.center), [spec.center]);
  // Fused abstract petals: one melted shape per flower, drawn on every flower head instead of single petals.
  const fusedOn = spec.petals.style === "abstract" && spec.petals.join === "fused";
  const fused = useMemo(
    () => (fusedOn ? buildFusedFlower(spec.petals, spec.center.size * 0.35, spec.stem.thickness * 1.6) : null),
    [fusedOn, spec.petals, spec.center.size, spec.stem.thickness],
  );

  // Materials (rebuilt when the look changes)
  const look = spec.look;
  const matcap = useMemo(() => (look.style === "pearl" ? makeMatcapTexture(look) : null), [look]);
  const stemMat = useMemo(() => partMaterial(look, matcap, { color: spec.stem.color, roughness: 0.7 }), [look, matcap, spec.stem.color]);
  // petals, sepals, leaves: colors come from the geometry
  const bladeMat = useMemo(() => partMaterial(look, matcap, { vertexColors: true, doubleSide: true, roughness: 0.55 }), [look, matcap]);
  const budMat = useMemo(() => partMaterial(look, matcap, { vertexColors: true, roughness: 0.6 }), [look, matcap]);
  const centerMats = useMemo(
    () => center.map((c) => partMaterial(look, matcap, { color: c.color, roughness: 0.8 })),
    [center, look, matcap],
  );

  useDisposeOnChange(useMemo(() => [layout.stemGeometry], [layout]));
  useDisposeOnChange(useMemo(() => [petal], [petal]));
  useDisposeOnChange(useMemo(() => [sepal], [sepal]));
  useDisposeOnChange(useMemo(() => [leaf], [leaf]));
  useDisposeOnChange(useMemo(() => [bud], [bud]));
  useDisposeOnChange(useMemo(() => [receptacle], [receptacle]));
  useDisposeOnChange(useMemo(() => [stemMat], [stemMat]));
  useDisposeOnChange(useMemo(() => [...center.map((c) => c.geometry), ...centerMats], [center, centerMats]));
  useDisposeOnChange(useMemo(() => [bladeMat, budMat], [bladeMat, budMat]));
  useDisposeOnChange(useMemo(() => (fused ? [fused] : []), [fused]));
  useDisposeOnChange(useMemo(() => (matcap ? [matcap] : []), [matcap]));

  return (
    <group>
      <mesh geometry={layout.stemGeometry} material={stemMat} castShadow />
      <Instances geometry={leaf} material={bladeMat} matrices={parts.leaves} />
      <Instances geometry={receptacle} material={stemMat} matrices={parts.receptacles} />
      <Instances geometry={sepal} material={bladeMat} matrices={parts.sepals} />
      {fused ? (
        <Instances geometry={fused} material={bladeMat} matrices={parts.heads} />
      ) : (
        <Instances geometry={petal} material={bladeMat} matrices={parts.petals} />
      )}
      {center.map((c, i) => (
        <Instances key={i} geometry={c.geometry} material={centerMats[i]} matrices={parts.heads} />
      ))}
      <Instances geometry={bud} material={budMat} matrices={parts.buds} />
    </group>
  );
}
