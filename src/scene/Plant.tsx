// The 3D plant: reads the flower settings from the store and turns them into meshes.
//   layoutPlant()  → where flowers, buds and leaves go (+ the stem tubes)
//   assemble()     → one transform per copy of each part
//   <Instances>    → draws all copies of a part in one InstancedMesh (one draw call)
// Each geometry is rebuilt only when its own settings change.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePlant } from "../state/store";
import { layoutPlant } from "../plant/layout";
import { assemble } from "../plant/assemble";
import { buildPetalGeometry } from "../plant/petal";
import { buildCenter } from "../plant/center";
import { buildLeafGeometry } from "../plant/leaf";
import { buildBudGeometry, buildSepalGeometry } from "../plant/sepal";
import { buildFusedFlower } from "../plant/fused";
import { buildPartMaterials, type PartMaterials } from "./partMaterial";

/** Free GPU memory for geometries/materials we no longer show. */
function useDisposeOnChange(items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((x) => x.dispose()), [items]);
}

/** Draws `geometry` once per matrix, as a single InstancedMesh. */
function Instances({ geometry, material, matrices, castShadow = true, renderOrder = 0 }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  castShadow?: boolean;
  renderOrder?: number; // higher = drawn later (used for the see-through halo shell)
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
      castShadow={castShadow}
      renderOrder={renderOrder}
      frustumCulled={false} // copies are spread out; skip the single bounding-box cull
    />
  );
}

/** A part drawn as instances, plus its dream halo shell (a see-through enlarged copy) when it has one. */
function Part({ geometry, mats, matrices }: { geometry: THREE.BufferGeometry; mats: PartMaterials; matrices: THREE.Matrix4[] }) {
  return (
    <>
      <Instances geometry={geometry} material={mats.material} matrices={matrices} />
      {mats.halo && <Instances geometry={geometry} material={mats.halo} matrices={matrices} castShadow={false} renderOrder={2} />}
    </>
  );
}

const bufferSize = new THREE.Vector2();

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

  // Materials: each part has its own (natural / pearl / dream), see partMaterial.ts.
  // Rebuilt only when that part's material settings (or the few inputs it uses) change.
  const mats = spec.materials;
  const petalGeo = fused ?? petal;
  // Length for the dream "length" input: petal length, or for fused flowers the reach from the axis to the petal tips.
  const petalLen = fused ? spec.center.size * 0.35 + spec.petals.stalk + spec.petals.size : spec.petals.size;
  const stemMat = useMemo(
    () => buildPartMaterials(mats.stem, { color: spec.stem.color, roughness: 0.7 }),
    [mats.stem, spec.stem.color],
  );
  const receptacleMat = useMemo(
    () => buildPartMaterials(mats.stem, { color: spec.stem.color, roughness: 0.7, haloGeometry: receptacle }),
    [mats.stem, spec.stem.color, receptacle],
  );
  const leafMat = useMemo(
    () => buildPartMaterials(mats.leaves, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.leaves.size, haloGeometry: leaf }),
    [mats.leaves, spec.leaves.size, leaf],
  );
  const petalMat = useMemo(
    () => buildPartMaterials(mats.petals, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: petalLen, radial: !!fused, haloGeometry: petalGeo }),
    [mats.petals, petalLen, fused, petalGeo],
  );
  const sepalMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.petals.size * 0.45, haloGeometry: sepal }),
    [mats.sepals, spec.petals.size, sepal],
  );
  const budMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, roughness: 0.6, haloGeometry: bud }),
    [mats.sepals, bud],
  );
  const centerMats = useMemo(
    () => center.map((c) => buildPartMaterials(mats.center, { color: c.color, roughness: 0.8, haloGeometry: c.geometry })),
    [center, mats.center],
  );
  const allMats = [stemMat, receptacleMat, leafMat, petalMat, sepalMat, budMat, ...centerMats];

  useDisposeOnChange(useMemo(() => [layout.stemGeometry], [layout]));
  useDisposeOnChange(useMemo(() => [petal], [petal]));
  useDisposeOnChange(useMemo(() => [sepal], [sepal]));
  useDisposeOnChange(useMemo(() => [leaf], [leaf]));
  useDisposeOnChange(useMemo(() => [bud], [bud]));
  useDisposeOnChange(useMemo(() => [receptacle], [receptacle]));
  useDisposeOnChange(useMemo(() => center.map((c) => c.geometry), [center]));
  useDisposeOnChange(useMemo(() => (fused ? [fused] : []), [fused]));
  useDisposeOnChange(stemMat.disposables);
  useDisposeOnChange(receptacleMat.disposables);
  useDisposeOnChange(leafMat.disposables);
  useDisposeOnChange(petalMat.disposables);
  useDisposeOnChange(sepalMat.disposables);
  useDisposeOnChange(budMat.disposables);
  useDisposeOnChange(useMemo(() => centerMats.flatMap((m) => m.disposables), [centerMats]));

  // Dream / glitch materials: animate each at its own part's speed. Glitch also needs the screen size in pixels.
  useFrame((state) => {
    state.gl.getDrawingBufferSize(bufferSize);
    for (const pm of allMats) {
      for (const m of [pm.material, pm.halo]) {
        if (!(m instanceof THREE.ShaderMaterial)) continue;
        m.uniforms.uTime.value = state.clock.elapsedTime * m.userData.speed;
        m.uniforms.uRes?.value.copy(bufferSize);
      }
    }
  });

  return (
    <group>
      <mesh geometry={layout.stemGeometry} material={stemMat.material} castShadow />
      <Part geometry={leaf} mats={leafMat} matrices={parts.leaves} />
      <Part geometry={receptacle} mats={receptacleMat} matrices={parts.receptacles} />
      <Part geometry={sepal} mats={sepalMat} matrices={parts.sepals} />
      <Part geometry={petalGeo} mats={petalMat} matrices={fused ? parts.heads : parts.petals} />
      {center.map((c, i) => (
        <Part key={i} geometry={c.geometry} mats={centerMats[i]} matrices={parts.heads} />
      ))}
      <Part geometry={bud} mats={budMat} matrices={parts.buds} />
    </group>
  );
}
