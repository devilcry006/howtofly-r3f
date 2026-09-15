import * as THREE from "three";

// Shared mutable flight state, written by Helicopter and read by HelicopterCamera.
// Plain module state (not React state) since it changes every frame via useFrame.
export const flightState = {
  position: new THREE.Vector3(0, 2, 0),
  yaw: 0,
};
