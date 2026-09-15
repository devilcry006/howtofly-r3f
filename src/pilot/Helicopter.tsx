import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Gltf } from "@react-three/drei";
import {
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { flightState } from "./flightState";
import { bindKeyboardControls, controlInput } from "./inputState";
import { sendFlightUpdate } from "../net/socket";

// Measured from the loaded model (Box3().setFromObject) so the collider is
// one solid box sized to the fuselage/skids instead of react-three-rapier's
// default of one convex hull per mesh (body/blades/skids/glass all separate).
const BODY_COLLIDER_HALF_EXTENTS: [number, number, number] = [2.77, 1.93, 2.86];
const BODY_COLLIDER_OFFSET: [number, number, number] = [0, 1.55, 1.02];

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);

const GRAVITY = 9.81;

// Attitude is real rigid-body physics now: control inputs apply torque, not a
// target angle. There is no auto-leveling — release the stick and the craft
// keeps whatever attitude/angular momentum it had, same as acro mode on a
// real drone. angularDamping below is just aerodynamic drag, not a leveler.
const PITCH_TORQUE = 10; // N·m per kg, about the body's local right axis
const ROLL_TORQUE = 10; // N·m per kg, about the body's local forward axis
const YAW_TORQUE = 5; // N·m per kg, about the body's local up axis
const ANGULAR_DAMPING = 0.4;

// Collective: Shift ramps blade pitch up while held. Release it (or hold C)
// and it decays on its own — the rotor "weakens" instead of holding its last
// value like a lever.
const COLLECTIVE_RATE = 0.9; // units/s ramp-up while Shift is held
const COLLECTIVE_DECAY = 0.6; // units/s natural weakening while Shift is not held
const MAX_LIFT_THRUST = 1.8; // multiple of weight produced at full collective, along local up

export function Helicopter() {
  const bodyRef = useRef<RapierRigidBody>(null);
  // Nested purely so we can read an interpolated world position for
  // flightState (react-three-rapier smooths this between fixed physics
  // steps); rotation is no longer set manually here, it just rides the
  // RigidBody's own physics rotation.
  const modelRef = useRef<THREE.Group>(null);

  const collective = useRef(0); // 0..1, ramps/decays, never snaps

  useEffect(() => bindKeyboardControls(), []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    // -----------------
    // Input (keyboard and touch joysticks both feed the same analog axes)
    // -----------------

    const pitchInput = controlInput.pitch; // W/stick-up noses down (forward), S/stick-down noses up (back)
    const rollInput = controlInput.roll;
    const yawInput = controlInput.yaw; // Q/stick-left yaws nose left, E/stick-right yaws nose right

    const collectiveInput = controlInput.collective; // >0 ramps up, <=0 decays (matches old Shift/C rates)
    if (collectiveInput > 0) {
      collective.current += COLLECTIVE_RATE * collectiveInput * delta;
    } else {
      const decayRate =
        COLLECTIVE_DECAY + (COLLECTIVE_RATE - COLLECTIVE_DECAY) * -collectiveInput;
      collective.current -= decayRate * delta;
    }
    collective.current = THREE.MathUtils.clamp(collective.current, 0, 1);

    // -----------------
    // Current attitude, read straight from the physics body (no cosmetic
    // tilt state to keep in sync — the body itself rotates now).
    // -----------------

    const r = body.rotation();
    const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);

    const forward = FORWARD.clone().applyQuaternion(quat);
    const right = RIGHT.clone().applyQuaternion(quat);
    const up = UP.clone().applyQuaternion(quat);

    // -----------------
    // Forces & torques (gravity is handled by the physics world)
    // -----------------

    const mass = body.mass();
    const weight = mass * GRAVITY;

    const torque = new THREE.Vector3()
      .addScaledVector(right, pitchInput * PITCH_TORQUE * mass)
      .addScaledVector(forward, rollInput * ROLL_TORQUE * mass)
      .addScaledVector(up, yawInput * YAW_TORQUE * mass);

    // Thrust fires along the body's own up axis, so tilting it (via the
    // torque above) is what redirects thrust into horizontal movement —
    // just like a real rotorcraft, instead of a scripted horizontal force.
    const force = up.clone().multiplyScalar(collective.current * MAX_LIFT_THRUST * weight);

    body.resetForces(true);
    body.addForce(force, true);
    body.resetTorques(true);
    body.addTorque(torque, true);

    if (modelRef.current) {
      modelRef.current.getWorldPosition(flightState.position);
    }
    // Heading only (ignores pitch/roll) so the chase camera doesn't tilt
    // or spin with the aircraft's attitude.
    flightState.yaw = Math.atan2(-forward.x, -forward.z);

    // Broadcast full attitude (not just yaw) to the gunner, whose camera is
    // rigidly attached to the nose and needs pitch/roll too.
    sendFlightUpdate(flightState.position, quat);
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 2, 0]}
      colliders={false}
      linearDamping={0.6}
      angularDamping={ANGULAR_DAMPING}
      enabledRotations={[true, true, true]}
    >
      <CuboidCollider
        args={BODY_COLLIDER_HALF_EXTENTS}
        position={BODY_COLLIDER_OFFSET}
        mass={1}
      />
      <group ref={modelRef}>
        <Gltf scale={0.01} src={"./models/scene.gltf"} />
      </group>
    </RigidBody>
  );
}
