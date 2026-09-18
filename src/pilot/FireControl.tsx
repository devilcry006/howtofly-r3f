import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { consumeFire } from "./inputState";
import { modelGroupRef } from "./modelGroupRef";
import { registerHit } from "../combat/targetState";
import { spawnTracer, spawnImpact } from "../combat/effectsState";

// Roughly the nose, ahead of the rotor disc (matches HelicopterCamera's own
// nose offset for the cockpit view).
const NOSE_OFFSET = new THREE.Vector3(0, 1.4, -3.5);
const FORWARD = new THREE.Vector3(0, 0, -1);
const MAX_RANGE = 300; // tracer length on a miss, since there's nothing to stop it

// Fires along the helicopter's own nose direction, not the render camera —
// in chase view the camera looks back at the aircraft, so a camera-centered
// raycast would just hit the player's own model. Single-player: the pilot
// is now also the gunner, firing with Space (or the touch fire button).
export function FireControl() {
  const { scene, raycaster } = useThree();

  useFrame(() => {
    if (!consumeFire()) return;
    const model = modelGroupRef.current;
    if (!model) return;

    const quaternion = model.getWorldQuaternion(new THREE.Quaternion());
    const origin = model.getWorldPosition(new THREE.Vector3()).add(NOSE_OFFSET.clone().applyQuaternion(quaternion));
    const direction = FORWARD.clone().applyQuaternion(quaternion);

    raycaster.set(origin, direction);
    // Closest hit of any kind (ground, scenery, targets, ...) — not just
    // objects tagged as targets — so the impact burst shows up wherever the
    // shot actually lands. Scoring still only cares about targetId. The
    // helicopter's own model opts out via raycast={() => null}.
    const hit = raycaster.intersectObjects(scene.children, true)[0];

    const endPoint = hit ? hit.point : raycaster.ray.at(MAX_RANGE, new THREE.Vector3());

    spawnTracer(origin.toArray() as [number, number, number], endPoint.toArray() as [number, number, number]);

    if (hit) {
      spawnImpact(endPoint.toArray() as [number, number, number]);
      const targetId = hit.object.userData?.targetId as string | undefined;
      if (targetId) registerHit(targetId);
    }
  });

  return null;
}
