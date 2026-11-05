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
import { makeMatcapTexture } from "./matcap";
import { geometryCenter, makeDreamMaterial } from "./dreamMaterial";
import type { LookSpec } from "../plant/spec";

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

/**
 * One material for a non-petal part. Natural look: lit by the scene lights. Pearl look: matcap ("painted light"),
 * tinted by the part's own colors only if look.tint is on. Dream look with target "all": dream shader
 * (with target "petals", the other parts stay natural). Petals get their own material in Plant().
 * `vertexColors` = the part's colors live in the geometry; otherwise `color` is used.
 * `axisLen` = the part's length along +X (blades), for the dream "length" input; 0 if it has none.
 */
function partMaterial(look: LookSpec, matcap: THREE.Texture | null, o: {
  vertexColors?: boolean; color?: string; doubleSide?: boolean; roughness: number; axisLen?: number;
}): THREE.Material {
  const side = o.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  if (look.style === "dream" && look.dream.target === "all") {
    return makeDreamMaterial(look.dream, { axisLen: o.axisLen ?? 0, doubleSide: o.doubleSide });
  }
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
  // leaves and sepals: colors come from the geometry
  const leafMat = useMemo(
    () => partMaterial(look, matcap, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.leaves.size }),
    [look, matcap, spec.leaves.size],
  );
  const sepalMat = useMemo(
    () => partMaterial(look, matcap, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.petals.size * 0.45 }),
    [look, matcap, spec.petals.size],
  );
  // Petals (or the fused flower). Dream look: dream shader on petals whatever the target, plus an optional halo shell.
  const dream = look.style === "dream";
  const petalGeo = fused ?? petal;
  // Length for the dream "length" input: petal length, or for fused flowers the reach from the axis to the petal tips.
  const petalLen = fused ? spec.center.size * 0.35 + spec.petals.stalk + spec.petals.size : spec.petals.size;
  const petalMat = useMemo(
    () =>
      dream
        ? makeDreamMaterial(look.dream, { axisLen: petalLen, radial: !!fused, doubleSide: true })
        : partMaterial(look, matcap, { vertexColors: true, doubleSide: true, roughness: 0.55 }),
    [dream, look, matcap, petalLen, fused],
  );
  const haloMat = useMemo(
    () => (dream && look.dream.halo > 0 ? makeDreamMaterial(look.dream, { axisLen: petalLen, halo: true, center: geometryCenter(petalGeo) }) : null),
    [dream, look.dream, petalLen, petalGeo],
  );
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
  useDisposeOnChange(useMemo(() => [leafMat, sepalMat, petalMat, budMat], [leafMat, sepalMat, petalMat, budMat]));
  useDisposeOnChange(useMemo(() => (haloMat ? [haloMat] : []), [haloMat]));

  // Dream materials: move the color bands over time.
  const shaderMats = [stemMat, leafMat, sepalMat, petalMat, budMat, haloMat, ...centerMats].filter(
    (m): m is THREE.ShaderMaterial => m instanceof THREE.ShaderMaterial,
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime * look.dream.speed;
    for (const m of shaderMats) m.uniforms.uTime.value = t;
  });
  useDisposeOnChange(useMemo(() => (fused ? [fused] : []), [fused]));
  useDisposeOnChange(useMemo(() => (matcap ? [matcap] : []), [matcap]));

  return (
    <group>
      <mesh geometry={layout.stemGeometry} material={stemMat} castShadow />
      <Instances geometry={leaf} material={leafMat} matrices={parts.leaves} />
      <Instances geometry={receptacle} material={stemMat} matrices={parts.receptacles} />
      <Instances geometry={sepal} material={sepalMat} matrices={parts.sepals} />
      <Instances geometry={petalGeo} material={petalMat} matrices={fused ? parts.heads : parts.petals} />
      {haloMat && (
        <Instances geometry={petalGeo} material={haloMat} matrices={fused ? parts.heads : parts.petals} castShadow={false} renderOrder={2} />
      )}
      {center.map((c, i) => (
        <Instances key={i} geometry={c.geometry} material={centerMats[i]} matrices={parts.heads} />
      ))}
      <Instances geometry={bud} material={budMat} matrices={parts.buds} />
    </group>
  );
}
