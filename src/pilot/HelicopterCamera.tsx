import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flightState } from "./flightState";
import { cameraState } from "./cameraState";
import { consumeViewToggle } from "./inputState";
import { modelGroupRef } from "./modelGroupRef";

const UP = new THREE.Vector3(0, 1, 0);
const CHASE_OFFSET = new THREE.Vector3(0, 4, 10);

const NOSE_OFFSET = new THREE.Vector3(0.25, 2, -0.25);

export function HelicopterCamera() {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (consumeViewToggle()) {
      cameraState.mode = cameraState.mode === "chase" ? "fps" : "chase";

      if (cameraState.mode === "fps" && modelGroupRef.current) {
        modelGroupRef.current.add(camera);
        camera.position.copy(NOSE_OFFSET);
        camera.quaternion.identity();
      } else {
        camera.removeFromParent();
      }
    }

    if (cameraState.mode === "fps") return;

    const { position, yaw } = flightState;
    const offset = CHASE_OFFSET.clone().applyAxisAngle(UP, yaw);
    const targetPosition = position.clone().add(offset);

    camera.position.lerp(targetPosition, 1 - Math.exp(-5 * delta));
    camera.lookAt(position);
  });

  return null;
}
