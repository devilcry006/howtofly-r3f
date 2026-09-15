import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import "../scene.css";
import { Helicopter } from "./Helicopter";
import { HelicopterCamera } from "./HelicopterCamera";
import { TouchControls } from "./TouchControls";
import { Targets } from "../gunner/Targets";
import { BulletEffects } from "../combat/BulletEffects";
import { ConnectionStatus } from "../net/ConnectionStatus";
import { connectNetwork } from "../net/socket";

export function PilotApp() {
  useEffect(() => connectNetwork("pilot"), []);

  return (
    <div id="canvas-container">
      <Canvas>
        <HelicopterCamera />
        <Physics gravity={[0, -9.81, 0]}>
          <Helicopter />
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[200, 0.2, 200]} />
              <meshStandardMaterial color="#3a5f3a" />
            </mesh>
          </RigidBody>
        </Physics>
        <Targets />
        <BulletEffects />
        <gridHelper args={[200, 40]} position={[0, 0.05, 0]} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={2} position={[10, 20, 10]} />
        <Sky sunPosition={[10, 20, 10]} />
      </Canvas>
      <TouchControls />
      <ConnectionStatus />
    </div>
  );
}
