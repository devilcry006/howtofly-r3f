import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flightState } from "./flightState";

const UP = new THREE.Vector3(0, 1, 0);
const CHASE_OFFSET = new THREE.Vector3(0, 4, 10);

export function HelicopterCamera() {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const { position, yaw } = flightState;

    const offset = CHASE_OFFSET.clone().applyAxisAngle(UP, yaw);
    const targetPosition = position.clone().add(offset);

    camera.position.lerp(targetPosition, 1 - Math.exp(-5 * delta));
    camera.lookAt(position);
  });

  return null;
}
