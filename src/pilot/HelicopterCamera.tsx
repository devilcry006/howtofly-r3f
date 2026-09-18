import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flightState } from "./flightState";
import { cameraState } from "./cameraState";
import { consumeViewToggle } from "./inputState";
import { modelGroupRef } from "./modelGroupRef";

const UP = new THREE.Vector3(0, 1, 0);
const CHASE_OFFSET = new THREE.Vector3(0, 4, 10);

// Local offset from the helicopter's own origin to roughly the cockpit/nose
// (matches Helicopter.tsx's FORWARD = (0,0,-1) — negative Z is forward).
const NOSE_OFFSET = new THREE.Vector3(0.25, 2, -0.25);

// C toggles between the chase cam (smoothed, free-floating in world space)
// and an FPS/cockpit view. The FPS view reparents the camera as a real child
// of the helicopter's own rendered group instead of copying its
// position/quaternion by hand every frame — the manual copy visibly
// juddered, since RigidBody.rotation() reads the raw physics-step rotation,
// not the interpolated one react-three-rapier applies to the rendered mesh
// each render frame, so position and attitude drifted out of sync. As a real
// child, the camera automatically rides that same interpolated transform.
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
        // r3f's default camera is never actually a scene-graph child (its
        // .parent is null from creation), so restoring "the original
        // parent" would be a no-op — detach outright instead, which is
        // exactly equivalent to that unparented starting state and makes
        // position/quaternion world-space again for the chase-cam math below.
        camera.removeFromParent();
      }
    }

    // While parented for FPS mode, the camera just rides the model group's
    // own transform — nothing to update here every frame.
    if (cameraState.mode === "fps") return;

    const { position, yaw } = flightState;
    const offset = CHASE_OFFSET.clone().applyAxisAngle(UP, yaw);
    const targetPosition = position.clone().add(offset);

    camera.position.lerp(targetPosition, 1 - Math.exp(-5 * delta));
    camera.lookAt(position);
  });

  return null;
}
