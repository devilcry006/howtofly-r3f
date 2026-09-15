import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import "../scene.css";
import { Targets } from "./Targets";
import { BulletEffects } from "../combat/BulletEffects";
import { GunnerCamera } from "./GunnerCamera";
import { GunnerFireControl } from "./GunnerFireControl";
import { GunnerHUD } from "./GunnerHUD";
import { ConnectionStatus } from "../net/ConnectionStatus";
import { connectNetwork } from "../net/socket";

// No Physics/Rapier here: the gunner doesn't simulate the helicopter, it
// just mirrors the pilot's broadcast transform (see GunnerCamera).
export function GunnerApp() {
  useEffect(() => connectNetwork("gunner"), []);

  return (
    <div id="canvas-container">
      <Canvas>
        <GunnerCamera />
        <GunnerFireControl />
        <Targets />
        <BulletEffects />
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[200, 0.2, 200]} />
          <meshStandardMaterial color="#3a5f3a" />
        </mesh>
        {/* raycast disabled: decorative, not something a shot should "land" on */}
        <gridHelper args={[200, 40]} position={[0, 0.05, 0]} raycast={() => null} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={2} position={[10, 20, 10]} />
        <Sky
          sunPosition={[10, 20, 10]}
          ref={(sky) => {
            if (sky) sky.raycast = () => null;
          }}
        />
      </Canvas>
      <GunnerHUD />
      <ConnectionStatus />
    </div>
  );
}
