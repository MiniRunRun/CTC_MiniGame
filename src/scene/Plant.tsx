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
import { cubify, type CubeAxis } from "../plant/cubes";
import { buildPartMaterials, type PartMaterials } from "./partMaterial";
import type { AnimUniforms } from "./animation";
import type { AnimationSpec, CubeSpec } from "../plant/spec";

/** Free GPU memory for geometries/materials we no longer show. */
function useDisposeOnChange(items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((x) => x.dispose()), [items]);
}

/** Draws `geometry` once per matrix, as a single InstancedMesh. */
function Instances({ geometry, material, matrices, anchors, castShadow = true, renderOrder = 0 }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  anchors: THREE.Vector3[]; // attach point on the stem per copy (for animation, see animation.ts)
  castShadow?: boolean;
  renderOrder?: number; // higher = drawn later (used for the see-through halo shell)
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // Per-copy anchor attribute (each geometry is drawn with one list of copies, so it can live on the geometry).
    const a = new Float32Array(anchors.length * 3);
    anchors.forEach((p, i) => p.toArray(a, i * 3));
    geometry.setAttribute("anchor", new THREE.InstancedBufferAttribute(a, 3));
    // geometry/material are constructor args: changing them makes a new mesh that needs its matrices again.
  }, [matrices, anchors, geometry, material]);
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
function Part({ geometry, mats, matrices, anchors }: {
  geometry: THREE.BufferGeometry;
  mats: PartMaterials;
  matrices: THREE.Matrix4[];
  anchors: THREE.Vector3[];
}) {
  return (
    <>
      <Instances geometry={geometry} material={mats.material} matrices={matrices} anchors={anchors} />
      {mats.halo && <Instances geometry={geometry} material={mats.halo} matrices={matrices} anchors={anchors} castShadow={false} renderOrder={2} />}
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

  // Geometries (one per part type). With Form → Build = Blocks / Cubes, each is rebuilt from boxes (cubes.ts).
  const cb = spec.cubes;
  // The smooth source geometry is freed once cubified (except the stem's, which belongs to the layout).
  const cube = (on: CubeSpec, color: string, axis: CubeAxis, keepSource = false) => (g: THREE.BufferGeometry) => {
    if (on.build === "smooth") return g;
    const out = cubify(g, { spec: on, color, axis });
    if (!keepSource) g.dispose();
    return out;
  };
  const petal = useMemo(
    () => cube(cb.petals, spec.petals.color, "x")(buildPetalGeometry(spec.petals)),
    [spec.petals, cb.petals],
  );
  const sepal = useMemo(
    () => cube(cb.sepals, spec.sepals.color, "x")(buildSepalGeometry(spec.sepals, spec.petals.size)),
    [spec.sepals, spec.petals.size, cb.sepals],
  );
  const leaf = useMemo(() => cube(cb.leaves, spec.leaves.color, "x")(buildLeafGeometry(spec.leaves)), [spec.leaves, cb.leaves]);
  const bud = useMemo(
    () => cube(cb.sepals, spec.petals.color, "y")(buildBudGeometry(spec.sepals, spec.petals)),
    [spec.sepals, spec.petals, cb.sepals],
  );
  const receptacle = useMemo(
    () => cube(cb.stem, spec.stem.color, "y")(new THREE.SphereGeometry(spec.stem.thickness * 0.9, 16, 10)),
    [spec.stem.thickness, spec.stem.color, cb.stem],
  );
  const center = useMemo(
    () => buildCenter(spec.center).map((c) => ({ ...c, geometry: cube(cb.center, c.color, "y")(c.geometry) })),
    [spec.center, cb.center],
  );
  const stemGeo = useMemo(
    () => cube(cb.stem, spec.stem.color, "y", true)(layout.stemGeometry),
    [layout, cb.stem, spec.stem.color],
  );
  // Cube parts carry their colors in the geometry (gradient), so materials must use vertex colors.
  const stemCubes = cb.stem.build !== "smooth";
  const centerCubes = cb.center.build !== "smooth";
  // Fused abstract petals: one melted shape per flower, drawn on every flower head instead of single petals.
  const fusedOn = spec.petals.style === "abstract" && spec.petals.join === "fused";
  const fused = useMemo(
    () =>
      fusedOn
        ? cube(cb.petals, spec.petals.color, "radial")(buildFusedFlower(spec.petals, spec.center.size * 0.35, spec.stem.thickness * 1.6))
        : null,
    [fusedOn, spec.petals, spec.center.size, spec.stem.thickness, cb.petals],
  );

  // Materials: each part has its own (natural / pearl / dream), see partMaterial.ts.
  // Rebuilt only when that part's material settings (or the few inputs it uses) change.
  const mats = spec.materials;
  const anims = spec.animations;
  // The stem's sway, which every other part follows so it stays attached (see animation.ts).
  // Plus the whole-plant glitch (spec.plantAnimation), shared by every part.
  const stemSway = anims.stem.type === "sway" ? anims.stem.amount : 0;
  const stemGlitch = anims.stem.type === "glitch" ? anims.stem.amount : 0;
  const plant = useMemo(
    () => ({
      stemSway,
      stemGlitch,
      stemGlitchBlock: anims.stem.glitchBlock,
      stemSpeed: anims.stem.speed,
      stemLength: spec.stem.length,
      whole: spec.plantAnimation,
    }),
    [stemSway, stemGlitch, anims.stem.glitchBlock, anims.stem.speed, spec.stem.length, spec.plantAnimation],
  );
  const petalGeo = fused ?? petal;
  // Length for the dream "length" input: petal length, or for fused flowers the reach from the axis to the petal tips.
  const petalLen = fused ? spec.center.size * 0.35 + spec.petals.stalk + spec.petals.size : spec.petals.size;
  const stemMat = useMemo(
    () => buildPartMaterials(mats.stem, stemCubes ? { vertexColors: true, roughness: 0.7 } : { color: spec.stem.color, roughness: 0.7 }, { spec: anims.stem, part: "stem", kind: "stem", size: spec.stem.length, plant, follow: false }),
    [mats.stem, spec.stem.color, anims.stem, spec.stem.length, plant, stemCubes],
  );
  const receptacleMat = useMemo(
    () => buildPartMaterials(mats.stem, stemCubes ? { vertexColors: true, roughness: 0.7, haloGeometry: receptacle } : { color: spec.stem.color, roughness: 0.7, haloGeometry: receptacle }, // receptacles sit on the stem: they follow its sway/glitch instead of doing it on their own
      { spec: stemSway + stemGlitch > 0 ? { ...anims.stem, type: "none" } : anims.stem, part: "stem", kind: "blob", size: spec.stem.thickness, plant, follow: true }),
    [mats.stem, spec.stem.color, receptacle, anims.stem, spec.stem.thickness, plant],
  );
  const leafMat = useMemo(
    () => buildPartMaterials(mats.leaves, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.leaves.size, haloGeometry: leaf }, { spec: anims.leaves, part: "leaves", follow: true, kind: "blade", size: spec.leaves.size, plant }),
    [mats.leaves, spec.leaves.size, leaf, anims.leaves, plant],
  );
  const petalMat = useMemo(
    () => buildPartMaterials(mats.petals, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: petalLen, radial: !!fused, haloGeometry: petalGeo }, { spec: anims.petals, part: "petals", follow: true, kind: fused ? "blob" : "blade", size: petalLen, plant }),
    [mats.petals, petalLen, fused, petalGeo, anims.petals, plant],
  );
  const sepalMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, doubleSide: true, roughness: 0.55, axisLen: spec.petals.size * 0.45, haloGeometry: sepal }, { spec: anims.sepals, part: "sepals", follow: true, kind: "blade", size: spec.petals.size * 0.45, plant }),
    [mats.sepals, spec.petals.size, sepal, anims.sepals, plant],
  );
  const budMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, roughness: 0.6, haloGeometry: bud }, { spec: anims.sepals, part: "sepals", follow: true, kind: "blob", size: spec.petals.size * 0.6, plant }),
    [mats.sepals, bud, anims.sepals, spec.petals.size, plant],
  );
  const centerMats = useMemo(
    () => center.map((c) => buildPartMaterials(mats.center, centerCubes ? { vertexColors: true, roughness: 0.8, haloGeometry: c.geometry } : { color: c.color, roughness: 0.8, haloGeometry: c.geometry }, { spec: anims.center, part: "center", follow: true, kind: "blob", size: Math.max(spec.center.size, spec.center.height), plant })),
    [center, mats.center, anims.center, spec.center.size, spec.center.height, plant, centerCubes],
  );
  const allMats = [stemMat, receptacleMat, leafMat, petalMat, sepalMat, budMat, ...centerMats];

  useDisposeOnChange(useMemo(() => [layout.stemGeometry], [layout]));
  useDisposeOnChange(useMemo(() => (stemGeo !== layout.stemGeometry ? [stemGeo] : []), [stemGeo, layout]));
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

  // Animation clocks, per part (see animation.ts): motion time, and the material's own pattern time.
  useFrame((state) => {
    state.gl.getDrawingBufferSize(bufferSize);
    const t = state.clock.elapsedTime;
    for (const pm of allMats) {
      for (const m of [pm.material, pm.halo]) {
        if (!m) continue;
        const a = m.userData.animSpec as AnimationSpec;
        const anim = m.userData.anim as AnimUniforms | undefined;
        if (anim) {
          anim.uAnTime.value = t * a.speed * 2;
          anim.uAnPlantTime.value = t * m.userData.plantSpeed * 2;
          anim.uAnWTime.value = t * m.userData.wholeSpeed * 2;
          anim.uAnRes.value.copy(bufferSize);
        }
        // Pattern motion: Dream bands flow, Glitch blocks/grain re-roll. 0 = still image.
        if (m instanceof THREE.ShaderMaterial && m.uniforms.uTime) m.uniforms.uTime.value = a.type === "pattern" ? t * a.amount * a.speed : 0;
      }
    }
  });

  return (
    <group>
      <mesh geometry={stemGeo} material={stemMat.material} castShadow />
      <Part geometry={leaf} mats={leafMat} matrices={parts.leaves} anchors={parts.anchors.leaves} />
      <Part geometry={receptacle} mats={receptacleMat} matrices={parts.receptacles} anchors={parts.anchors.receptacles} />
      <Part geometry={sepal} mats={sepalMat} matrices={parts.sepals} anchors={parts.anchors.sepals} />
      <Part
        geometry={petalGeo}
        mats={petalMat}
        matrices={fused ? parts.heads : parts.petals}
        anchors={fused ? parts.anchors.heads : parts.anchors.petals}
      />
      {center.map((c, i) => (
        <Part key={i} geometry={c.geometry} mats={centerMats[i]} matrices={parts.heads} anchors={parts.anchors.heads} />
      ))}
      <Part geometry={bud} mats={budMat} matrices={parts.buds} anchors={parts.anchors.buds} />
    </group>
  );
}
