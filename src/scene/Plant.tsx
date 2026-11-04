// The 3D plant: reads the flower settings from the store and turns them into meshes.
// Geometry is rebuilt only for the part whose settings changed (useMemo per part).
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { usePlant } from "../state/store";
import { buildStem } from "../plant/stem";
import { buildPetalGeometry, petalPlacements } from "../plant/petal";
import { buildCenter } from "../plant/center";

const UP = new THREE.Vector3(0, 1, 0);

/** Free GPU memory for geometries we no longer show. */
function useDisposeOnChange(geoms: THREE.BufferGeometry[]) {
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
}

export default function Plant() {
  const spec = usePlant((s) => s.spec);

  const stem = useMemo(() => buildStem(spec.stem), [spec.stem]);
  const petalGeometry = useMemo(() => buildPetalGeometry(spec.petals), [spec.petals]);
  const centerParts = useMemo(() => buildCenter(spec.center), [spec.center]);
  const placements = useMemo(
    () => petalPlacements(spec.petals, spec.center.size * 0.35),
    [spec.petals, spec.center.size],
  );

  useDisposeOnChange(useMemo(() => [stem.geometry], [stem]));
  useDisposeOnChange(useMemo(() => [petalGeometry], [petalGeometry]));
  useDisposeOnChange(useMemo(() => centerParts.map((p) => p.geometry), [centerParts]));

  // Point the flower head along the stem's direction at the tip.
  const headRotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, stem.tipDirection),
    [stem],
  );

  return (
    <group>
      <mesh geometry={stem.geometry} castShadow>
        <meshStandardMaterial color={spec.stem.color} roughness={0.7} />
      </mesh>

      <group position={stem.tip} quaternion={headRotation}>
        {/* Receptacle: the small swelling where the flower meets the stem (hides the joint) */}
        <mesh scale={[1, 0.7, 1]} castShadow>
          <sphereGeometry args={[spec.stem.thickness * 0.45 * 2, 16, 10]} />
          <meshStandardMaterial color={spec.stem.color} roughness={0.7} />
        </mesh>

        {placements.map((p, i) => (
          <group key={i} rotation={[0, p.angle, 0]}>
            <mesh
              geometry={petalGeometry}
              position={[p.radius, p.height, 0]}
              rotation={[0, 0, p.tilt]}
              scale={p.scale}
              castShadow
            >
              <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.55} />
            </mesh>
          </group>
        ))}

        {centerParts.map((part, i) => (
          <mesh key={i} geometry={part.geometry} castShadow>
            <meshStandardMaterial color={part.color} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
