// The 3D preview: camera, lights, ground and orbit controls.
// The plant itself comes from PlaceholderPlant for now; milestone 2 replaces it with buildPlant().
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import PlaceholderPlant from "./PlaceholderPlant";

export default function Viewport() {
  return (
    <Canvas camera={{ position: [0, 1.2, 3], fov: 45 }} shadows dpr={[1, 2]}>
      <color attach="background" args={["#1d1f24"]} />
      <hemisphereLight args={["#ffffff", "#3a4a3a", 0.8]} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow />

      <PlaceholderPlant />

      {/* Soft shadow under the plant so it feels grounded */}
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={4} blur={2.5} far={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[1.5, 64]} />
        <meshStandardMaterial color="#2c3a2c" />
      </mesh>

      <OrbitControls target={[0, 0.7, 0]} minDistance={1} maxDistance={8} enablePan={false} />
    </Canvas>
  );
}
