// The 3D preview: camera, lights, ground and orbit controls.
// The plant itself is built in Plant.tsx from the settings in the store.
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import Plant from "./Plant";
import Effects from "./Effects";
import { usePlant } from "../state/store";

export default function Viewport() {
  // Aim the camera around the upper part of the stem, where the flower is.
  const stemLength = usePlant((s) => s.spec.stem.length);
  // Scene settings: background color and whether to show the ground (hide it for a clean, graphic image).
  const scene = usePlant((s) => s.spec.scene);
  const effectOn = usePlant((s) => s.spec.effect.mode !== "none");
  return (
    <Canvas camera={{ position: [0.9, 1.45, 1.6], fov: 40 }} shadows dpr={[1, 2]}>
      <color attach="background" args={[scene.background]} />
      {/* Sky/ground light + key light from above-front + soft fill from the other side,
          so petals read well from any angle (their undersides would otherwise go dark). */}
      <hemisphereLight args={["#ffffff", "#5a6a5a", 1.1]} />
      <directionalLight position={[3, 5, 3]} intensity={1.8} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />

      <Plant />

      {/* Soft shadow under the plant so it feels grounded */}
      {scene.ground && (
        <>
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={4} blur={2.5} far={2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
            <circleGeometry args={[1.5, 64]} />
            <meshStandardMaterial color="#2c3a2c" />
          </mesh>
        </>
      )}

      {effectOn && <Effects />}

      <OrbitControls target={[0, stemLength * 0.9, 0]} minDistance={0.25} maxDistance={6} enablePan={false} />
    </Canvas>
  );
}
