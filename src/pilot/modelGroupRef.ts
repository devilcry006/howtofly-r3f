import * as THREE from "three";

// The helicopter's rendered model group, shared so HelicopterCamera can
// reparent the FPS/cockpit camera onto it directly. Riding as a real scene
// graph child means the camera automatically gets the exact same
// interpolated transform react-three-rapier applies to this group every
// frame, instead of copying position/rotation by hand — which visibly
// juddered, since RigidBody.rotation() reads the raw physics-step rotation,
// not the interpolated one the rendered mesh actually uses.
export const modelGroupRef: { current: THREE.Group | null } = { current: null };
