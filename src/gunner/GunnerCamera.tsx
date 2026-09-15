import { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { netState } from "../net/socket";

// Forward of the cockpit, roughly at the nose, in the helicopter's local
// space (matches Helicopter.tsx's FORWARD = (0,0,-1)).
const NOSE_OFFSET = new THREE.Vector3(0, 1.4, -2.5);

// Attaches the camera directly to the pilot's helicopter, full attitude and
// all — this *is* "the pilot's view" the gunner sits in, not a free camera.
export function GunnerCamera() {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame((_, delta) => {
    if (!netState.hasRemoteFlight) return;

    const targetPos = netState.remotePosition
      .clone()
      .add(NOSE_OFFSET.clone().applyQuaternion(netState.remoteQuaternion));

    if (!initialized.current) {
      // Snap on the very first update instead of lerping in from the
      // default r3f camera position.
      camera.position.copy(targetPos);
      camera.quaternion.copy(netState.remoteQuaternion);
      initialized.current = true;
      return;
    }

    const t = 1 - Math.exp(-10 * delta);
    camera.position.lerp(targetPos, t);
    camera.quaternion.slerp(netState.remoteQuaternion, t);
  });

  return null;
}
