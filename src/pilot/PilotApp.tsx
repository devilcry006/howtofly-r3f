import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import "../scene.css";
import { Helicopter } from "./Helicopter";
import { HelicopterCamera } from "./HelicopterCamera";
import { TouchControls } from "./TouchControls";
import { ControlHint } from "./ControlHint";
import { EngineStatus } from "./EngineStatus";
import { FireControl } from "./FireControl";
import { FireHUD } from "./FireHUD";
import { Targets } from "../combat/Targets";
import { BulletEffects } from "../combat/BulletEffects";

export function PilotApp() {
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
        <FireControl />
        <Targets />
        <BulletEffects />
        {/* raycast disabled: decorative, not something a shot should "land" on */}
        <gridHelper args={[200, 40]} position={[0, 0.05, 0]} raycast={() => null} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={2} position={[10, 20, 10]} />
        <Sky
          sunPosition={[10, 20, 10]}
          ref={(sky) => {
            if (sky) sky.raycast = () => {};
          }}
        />
      </Canvas>
      <TouchControls />
      <ControlHint />
      <EngineStatus />
      <FireHUD />
    </div>
  );
}
