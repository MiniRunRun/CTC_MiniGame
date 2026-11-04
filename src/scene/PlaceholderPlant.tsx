// Temporary stand-in plant (stem + simple petals + center) to check 3D rendering works.
// Delete this file once the procedural builder from docs/ARCHITECTURE.md exists.

const PETALS = 6;

export default function PlaceholderPlant() {
  return (
    <group>
      {/* Stem */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 1, 12]} />
        <meshStandardMaterial color="#4f8a3c" />
      </mesh>

      {/* Petals: flattened spheres in a ring, tilted outward */}
      {Array.from({ length: PETALS }, (_, i) => {
        const a = (i / PETALS) * Math.PI * 2;
        return (
          <group key={i} position={[0, 1, 0]} rotation={[0, a, 0]}>
            <mesh position={[0.14, 0, 0]} rotation={[0, 0, 0.35]} scale={[0.14, 0.02, 0.07]} castShadow>
              <sphereGeometry args={[1, 24, 12]} />
              <meshStandardMaterial color="#f2a7c3" />
            </mesh>
          </group>
        );
      })}

      {/* Center */}
      <mesh position={[0, 1.02, 0]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.05, 24, 12]} />
        <meshStandardMaterial color="#f2c94c" />
      </mesh>
    </group>
  );
}
