// The 3D plant: reads the flower settings from the store and turns them into meshes.
//   layoutPlant()  → where flowers, buds and leaves go (+ the stem tubes)
//   assemble()     → one transform per copy of each part
//   PART_MESHES    → the registry (parts.ts): every mesh runs the same pipeline in <PartMesh>
//   <Instances>    → draws all copies of a mesh in one InstancedMesh (one draw call)
// Each geometry is rebuilt only when its own settings change; materials only when theirs do.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePlant } from "../state/store";
import { layoutPlant, type PlantLayout } from "../plant/layout";
import { assemble, type Assembly } from "../plant/assemble";
import { buildPart, ensureAlong } from "../plant/build";
import { shapesOf, type AnimationSpec, type PlantSpec } from "../plant/spec";
import { buildPartMaterials, type PartMaterials } from "./partMaterial";
import type { AnimUniforms, PlantMotion } from "./animation";
import { PART_MESHES, type PartMeshDef } from "./parts";

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

/** One registry entry: source geometry → build → materials → instances. */
function PartMesh({ def, spec, layout, assembly, plant }: {
  def: PartMeshDef;
  spec: PlantSpec;
  layout: PlantLayout;
  assembly: Assembly;
  plant: PlantMotion;
}) {
  const ps = spec.parts[def.part];
  // Cubes need finer faces only when each piece shows its own gradient (Color by Piece).
  const fine = ps.color.by === "piece";

  // Geometries. Form → Build = Pieces / Fused rebuilds each one (plant/build.ts); every geometry also gets
  // "aAlong" (base → tip) for Material → Color. `own` = ours to free later.
  const geos = useMemo(() => {
    const src = def.source(spec, layout);
    return src.pieces.map(({ geometry, color }) => {
      if (src.built || ps.build.mode === "smooth") return { geometry: ensureAlong(geometry, def.axis), color, own: !src.borrowed };
      const out = buildPart(geometry, { spec: ps.build, color, axis: def.axis, fine });
      if (!src.borrowed) geometry.dispose();
      return { geometry: ensureAlong(out, def.axis), color, own: true };
    });
  }, [...def.inputs(spec, layout), ps.build, fine]);
  useDisposeOnChange(useMemo(() => geos.filter((g) => g.own).map((g) => g.geometry), [geos]));

  // Materials (natural / pearl / dream / glitch + Color + Animation), see partMaterial.ts.
  const { list, kind, size, animSize } = def.place(spec);
  const a = ps.animation;
  // A mesh sitting on the stem already moves with it; don't sway/glitch it a second time.
  const anim = useMemo(() => (def.onStem && (a.type === "sway" || a.type === "glitch") ? { ...a, type: "none" as const } : a), [def.onStem, a]);
  const mats = useMemo(
    () =>
      geos.map(({ geometry, color }) => {
        // Pieces, blades and buds carry their colors in the geometry; the rest use one color.
        const vertexColors = geometry.hasAttribute("color");
        return buildPartMaterials(
          ps.material,
          { vertexColors, color: vertexColors ? undefined : color, doubleSide: def.doubleSide, roughness: def.roughness, paint: ps.color, size, haloGeometry: def.halo ? geometry : undefined },
          { spec: anim, part: def.part, kind, size: animSize ?? size, plant, follow: def.follow },
        );
      }),
    [geos, ps.material, ps.color, anim, kind, size, animSize, plant, def],
  );
  useDisposeOnChange(useMemo(() => mats.flatMap((m) => m.disposables), [mats]));

  // Animation clocks (see animation.ts): motion time, and the material's own pattern time.
  useFrame((state) => {
    state.gl.getDrawingBufferSize(bufferSize);
    const t = state.clock.elapsedTime;
    for (const pm of mats) {
      for (const m of [pm.material, pm.halo]) {
        if (!m) continue;
        const sp = m.userData.animSpec as AnimationSpec;
        const u = m.userData.anim as AnimUniforms | undefined;
        if (u) {
          u.uAnTime.value = t * sp.speed * 2;
          u.uAnPlantTime.value = t * m.userData.plantSpeed * 2;
          u.uAnWTime.value = t * m.userData.wholeSpeed * 2;
          u.uAnRes.value.copy(bufferSize);
        }
        // Pattern motion: Dream bands flow, Glitch blocks/grain re-roll. 0 = still image.
        if (m instanceof THREE.ShaderMaterial && m.uniforms.uTime) m.uniforms.uTime.value = sp.type === "pattern" ? t * sp.amount * sp.speed : 0;
      }
    }
  });

  if (!list) return <>{geos.map((g, i) => <mesh key={i} geometry={g.geometry} material={mats[i].material} castShadow />)}</>;
  return (
    <>
      {geos.map((g, i) => (
        <Part key={i} geometry={g.geometry} mats={mats[i]} matrices={assembly[list]} anchors={assembly.anchors[list]} />
      ))}
    </>
  );
}

export default function Plant() {
  const spec = usePlant((s) => s.spec);
  const p = spec.parts;

  const layout = useMemo(
    () => layoutPlant(shapesOf(spec)),
    // Only the settings that move things around; petal colors, center looks etc. don't change the layout.
    [p.stem.shape, p.leaves.shape, spec.architecture, p.sepals.shape.budCount, p.petals.shape.size],
  );
  const assembly = useMemo(
    () => assemble(shapesOf(spec), layout),
    [layout, p.petals.shape, p.center.shape.size, p.sepals.shape.count],
  );
  useDisposeOnChange(useMemo(() => [layout.stemGeometry], [layout]));

  // What acts on the whole plant (animation.ts): the stem's sway and glitch, which every other part follows so it
  // stays attached, and the whole-plant glitch (spec.plantAnimation).
  const sa = p.stem.animation;
  const stemSway = sa.type === "sway" ? sa.amount : 0;
  const stemGlitch = sa.type === "glitch" ? sa.amount : 0;
  const plant = useMemo<PlantMotion>(
    () => ({ stemSway, stemGlitch, stemGlitchBlock: sa.glitchBlock, stemSpeed: sa.speed, stemLength: p.stem.shape.length, whole: spec.plantAnimation }),
    [stemSway, stemGlitch, sa.glitchBlock, sa.speed, p.stem.shape.length, spec.plantAnimation],
  );

  return (
    <group>
      {PART_MESHES.map((def) => (
        <PartMesh key={def.id} def={def} spec={spec} layout={layout} assembly={assembly} plant={plant} />
      ))}
    </group>
  );
}
