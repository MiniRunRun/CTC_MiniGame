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
  }, [matrices, geometry]);
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

const bladeMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });

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

  // Materials
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: spec.stem.color, roughness: 0.7 }), [spec.stem.color]);
  const bladeMat = useMemo(bladeMaterial, []); // petals, sepals, leaves: colors come from the geometry
  const budMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), []);
  const centerMats = useMemo(
    () => center.map((c) => new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.8 })),
    [center],
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

  return (
    <group>
      <mesh geometry={layout.stemGeometry} material={stemMat} castShadow />
      <Instances geometry={leaf} material={bladeMat} matrices={parts.leaves} />
      <Instances geometry={receptacle} material={stemMat} matrices={parts.receptacles} />
      <Instances geometry={sepal} material={bladeMat} matrices={parts.sepals} />
      <Instances geometry={petal} material={bladeMat} matrices={parts.petals} />
      {center.map((c, i) => (
        <Instances key={i} geometry={c.geometry} material={centerMats[i]} matrices={parts.heads} />
      ))}
      <Instances geometry={bud} material={budMat} matrices={parts.buds} />
    </group>
  );
}
