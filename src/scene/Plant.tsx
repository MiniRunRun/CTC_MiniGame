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
import { buildPart, ensureAlong, type BuildAxis } from "../plant/build";
import { buildPartMaterials, type PartMaterials } from "./partMaterial";
import type { AnimUniforms } from "./animation";
import type { AnimationSpec, BuildSpec } from "../plant/spec";

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

  // Geometries (one per part type). Form → Build = Pieces / Fused rebuilds each one (plant/build.ts).
  const bd = spec.builds;
  // The smooth source geometry is freed once rebuilt (except the stem's, which belongs to the layout).
  // Every geometry also gets "aAlong" (base → tip) for Material → Color (ensureAlong).
  const cl = spec.colors;
  // Cubes need finer faces only when each piece shows its own gradient (Color by Piece).
  const fine = {
    stem: cl.stem.by === "piece",
    leaves: cl.leaves.by === "piece",
    petals: cl.petals.by === "piece",
    center: cl.center.by === "piece",
    sepals: cl.sepals.by === "piece",
  };
  const build = (on: BuildSpec, color: string, axis: BuildAxis, fineFaces: boolean, keepSource = false) => (g: THREE.BufferGeometry) => {
    const out = on.mode === "smooth" ? g : buildPart(g, { spec: on, color, axis, fine: fineFaces });
    if (out !== g && !keepSource) g.dispose();
    return ensureAlong(out, axis);
  };
  // Petals fused as a whole flower: one melted shape per flower, drawn on every flower head instead of petals.
  const flowerFused = bd.petals.mode === "fused" && bd.petals.flower;
  const petal = useMemo(
    () => (flowerFused ? ensureAlong(buildPetalGeometry(spec.petals), "x") : build(bd.petals, spec.petals.color, "x", fine.petals)(buildPetalGeometry(spec.petals))),
    [spec.petals, bd.petals, flowerFused, fine.petals],
  );
  const sepal = useMemo(
    () => build(bd.sepals, spec.sepals.color, "x", fine.sepals)(buildSepalGeometry(spec.sepals, spec.petals.size)),
    [spec.sepals, spec.petals.size, bd.sepals, fine.sepals],
  );
  const leaf = useMemo(() => build(bd.leaves, spec.leaves.color, "x", fine.leaves)(buildLeafGeometry(spec.leaves)), [spec.leaves, bd.leaves, fine.leaves]);
  const bud = useMemo(
    () => build(bd.sepals, spec.petals.color, "y", fine.sepals)(buildBudGeometry(spec.sepals, spec.petals)),
    [spec.sepals, spec.petals, bd.sepals, fine.sepals],
  );
  const receptacle = useMemo(
    () => build(bd.stem, spec.stem.color, "y", fine.stem)(new THREE.SphereGeometry(spec.stem.thickness * 0.9, 16, 10)),
    [spec.stem.thickness, spec.stem.color, bd.stem, fine.stem],
  );
  const center = useMemo(
    () => buildCenter(spec.center).map((c) => ({ ...c, geometry: build(bd.center, c.color, "y", fine.center)(c.geometry) })),
    [spec.center, bd.center, fine.center],
  );
  const stemGeo = useMemo(
    () => build(bd.stem, spec.stem.color, "y", fine.stem, true)(layout.stemGeometry),
    [layout, bd.stem, spec.stem.color, fine.stem],
  );
  // Rebuilt parts carry their colors in the geometry, so materials must use vertex colors.
  const stemCubes = bd.stem.mode !== "smooth";
  const centerCubes = bd.center.mode !== "smooth";
  const fused = useMemo(
    () => (flowerFused ? buildFusedFlower(spec.petals, bd.petals, spec.center.size * 0.35, spec.stem.thickness * 1.6) : null),
    [flowerFused, spec.petals, bd.petals, spec.center.size, spec.stem.thickness],
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
  // Petal length, or for fused flowers the reach from the axis to the petal tips (noise scale, animation).
  const petalLen = fused ? spec.center.size * 0.35 + bd.petals.stalk + spec.petals.size : spec.petals.size;
  const stemMat = useMemo(
    () => buildPartMaterials(mats.stem, stemCubes ? { vertexColors: true, roughness: 0.7, paint: cl.stem, size: spec.stem.length } : { color: spec.stem.color, roughness: 0.7, paint: cl.stem, size: spec.stem.length }, { spec: anims.stem, part: "stem", kind: "stem", size: spec.stem.length, plant, follow: false }),
    [mats.stem, spec.stem.color, anims.stem, spec.stem.length, plant, stemCubes, cl.stem],
  );
  const receptacleMat = useMemo(
    () => buildPartMaterials(mats.stem, stemCubes ? { vertexColors: true, roughness: 0.7, haloGeometry: receptacle, paint: cl.stem, size: spec.stem.thickness } : { color: spec.stem.color, roughness: 0.7, haloGeometry: receptacle, paint: cl.stem, size: spec.stem.thickness }, // receptacles sit on the stem: they follow its sway/glitch instead of doing it on their own
      { spec: stemSway + stemGlitch > 0 ? { ...anims.stem, type: "none" } : anims.stem, part: "stem", kind: "blob", size: spec.stem.thickness, plant, follow: true }),
    [mats.stem, spec.stem.color, receptacle, anims.stem, spec.stem.thickness, plant, stemCubes, cl.stem],
  );
  const leafMat = useMemo(
    () => buildPartMaterials(mats.leaves, { vertexColors: true, doubleSide: true, roughness: 0.55, paint: cl.leaves, size: spec.leaves.size, haloGeometry: leaf }, { spec: anims.leaves, part: "leaves", follow: true, kind: "blade", size: spec.leaves.size, plant }),
    [mats.leaves, spec.leaves.size, leaf, anims.leaves, plant, cl.leaves],
  );
  const petalMat = useMemo(
    () => buildPartMaterials(mats.petals, { vertexColors: true, doubleSide: true, roughness: 0.55, paint: cl.petals, size: petalLen, haloGeometry: petalGeo }, { spec: anims.petals, part: "petals", follow: true, kind: fused ? "blob" : "blade", size: petalLen, plant }),
    [mats.petals, petalLen, fused, petalGeo, anims.petals, plant, cl.petals],
  );
  const sepalMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, doubleSide: true, roughness: 0.55, paint: cl.sepals, size: spec.petals.size * 0.45, haloGeometry: sepal }, { spec: anims.sepals, part: "sepals", follow: true, kind: "blade", size: spec.petals.size * 0.45, plant }),
    [mats.sepals, spec.petals.size, sepal, anims.sepals, plant, cl.sepals],
  );
  const budMat = useMemo(
    () => buildPartMaterials(mats.sepals, { vertexColors: true, roughness: 0.6, haloGeometry: bud, paint: cl.sepals, size: spec.petals.size * 0.6 }, { spec: anims.sepals, part: "sepals", follow: true, kind: "blob", size: spec.petals.size * 0.6, plant }),
    [mats.sepals, bud, anims.sepals, spec.petals.size, plant, cl.sepals],
  );
  const centerMats = useMemo(
    () => center.map((c) => buildPartMaterials(mats.center, centerCubes
          ? { vertexColors: true, roughness: 0.8, haloGeometry: c.geometry, paint: cl.center, size: spec.center.size }
          : { color: c.color, roughness: 0.8, haloGeometry: c.geometry, paint: cl.center, size: spec.center.size }, { spec: anims.center, part: "center", follow: true, kind: "blob", size: Math.max(spec.center.size, spec.center.height), plant })),
    [center, mats.center, anims.center, spec.center.size, spec.center.height, plant, centerCubes, cl.center],
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
