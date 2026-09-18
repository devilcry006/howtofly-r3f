import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import {
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { flightState } from "./flightState";
import { bindKeyboardControls, consumeEngineToggle, consumeReset, controlInput } from "./inputState";
import { engineState } from "./engineState";
import { modelGroupRef } from "./modelGroupRef";
import { sendFlightUpdate } from "../net/socket";

const MODEL_SRC = "./models/helicopters_mh-6_little_bird/scene.gltf";

// The GLTF bakes every node's geometry at its final position with no
// per-node translation/rotation (checked in scene.gltf: every node up to the
// blade meshes is identity), so a blade node's own local origin sits at the
// model's origin, not its hub — spinning the node directly would swing the
// whole blade around that origin instead of turning it in place. This
// re-parents the node under a fresh pivot group placed at the node's own
// bounding-box center (its hub, since the blades are modeled symmetric
// around it), preserving its rendered position, so the pivot is what spins.
function pivotOnOwnCenter(node: THREE.Object3D): THREE.Object3D {
  const parent = node.parent;
  if (!parent) return node;
  parent.updateWorldMatrix(true, true);
  const centerWorld = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
  const centerLocal = parent.worldToLocal(centerWorld);
  const pivot = new THREE.Group();
  pivot.position.copy(centerLocal);
  parent.add(pivot);
  pivot.add(node);
  node.position.sub(centerLocal);
  return pivot;
}

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
// Torque and damping are scaled up together (vs. an earlier 10/10/5 torque
// with 0.4 damping) to keep roughly the same top angular rate while cutting
// the settling time ~4x — the earlier tuning felt sluggish because it took
// a long time both to spin up to speed and to stop spinning once the stick
// was released.
const PITCH_TORQUE = 40; // N·m per kg, about the body's local right axis
const ROLL_TORQUE = 40; // N·m per kg, about the body's local forward axis
const YAW_TORQUE = 20; // N·m per kg, about the body's local up axis
const ANGULAR_DAMPING = 1.6;

// Collective: Shift ramps blade pitch up while held. Release it (or hold C)
// and it decays on its own — the rotor "weakens" instead of holding its last
// value like a lever. Decay is intentionally much slower than the ramp-up:
// hover needs collective ~0.56 (weight / MAX_LIFT_THRUST), so a fast decay
// blew through that point almost instantly on release and felt like the
// engine cut out and the craft dropped, rather than a controlled descent.
const COLLECTIVE_RATE = 0.9; // units/s ramp-up while Shift is held
const COLLECTIVE_DECAY = 0.25; // units/s natural weakening while Shift is not held
const MAX_LIFT_THRUST = 1.8; // multiple of weight produced at full collective, along local up

// Engine: press I to toggle ignition. Rotor rpm ramps up/down rather than
// snapping, and both lift and attitude authority below scale with rpm — so
// there's no separate "can I take off yet" flag, full collective just can't
// out-thrust gravity (needs rpm > 1/MAX_LIFT_THRUST, i.e. above ~56%) until
// the rotor has spun up far enough. Spin-down is slower than spin-up since a
// real rotor keeps freewheeling for a while after the engine cuts.
const ENGINE_SPINUP_RATE = 1 / 4; // rpm/s while running (~4s to full rpm)
const ENGINE_SPINDOWN_RATE = 1 / 7; // rpm/s while off (~7s to fully stop)

// Node names from scene.gltf: "helice" (Spanish for propeller) is the main
// rotor (the big X-shaped mesh spinning about the mast, i.e. local Y), and
// "helice 2_2" is the small tail rotor (spinning about local X, sideways).
// GLTFLoader sanitizes node names (spaces -> underscores) on parse, so these
// have to match the runtime names, not the raw names in scene.gltf's JSON.
const MAIN_ROTOR_NODE_NAME = "helice_1_3";
const TAIL_ROTOR_NODE_NAME = "helice_2_2";
const MAIN_ROTOR_MAX_SPEED = Math.PI * 12; // rad/s at full rpm (~6 rev/s, visually readable)
const TAIL_ROTOR_MAX_SPEED = Math.PI * 40; // rad/s at full rpm (~20 rev/s, small prop reads as a blur)

// Reset: press R (or the touch button) to snap back to the spawn transform
// with zero velocity, engine off and rotors stopped — matches the RigidBody's
// own initial position/rotation below so a reset looks identical to a fresh load.
const SPAWN_POSITION = { x: 0, y: 2, z: 0 };
const SPAWN_ROTATION = { x: 0, y: 0, z: 0, w: 1 };
const ZERO_VECTOR = { x: 0, y: 0, z: 0 };

export function Helicopter() {
  const bodyRef = useRef<RapierRigidBody>(null);
  // Shared module-level ref (see modelGroupRef.ts) rather than a local
  // useRef: HelicopterCamera reparents the FPS camera onto this exact node
  // for the cockpit view. Also used locally to read an interpolated world
  // position for flightState (react-three-rapier smooths this between fixed
  // physics steps); rotation is no longer set manually here, it just rides
  // the RigidBody's own physics rotation.
  const modelRef = modelGroupRef;

  const collective = useRef(0); // 0..1, ramps/decays, never snaps

  // Rotor pivots are plain THREE.Object3D refs (not React state) since
  // they're mutated every frame in useFrame below — same pattern as bodyRef
  // and modelRef, and required so a memoized value isn't mutated post-render.
  const mainRotorRef = useRef<THREE.Object3D | null>(null);
  const tailRotorRef = useRef<THREE.Object3D | null>(null);

  const gltf = useGLTF(MODEL_SRC);
  // Cloned so repeated mounts (Strict Mode, HMR) each restructure their own
  // copy instead of re-pivoting (and double-rotating) the shared cached scene.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // Pivoting mutates scene's subtree structure and refs can't be written
  // during render, so this runs post-commit rather than inside the useMemo above.
  useEffect(() => {
    const mainRotorNode = scene.getObjectByName(MAIN_ROTOR_NODE_NAME);
    const tailRotorNode = scene.getObjectByName(TAIL_ROTOR_NODE_NAME);
    mainRotorRef.current = mainRotorNode ? pivotOnOwnCenter(mainRotorNode) : null;
    tailRotorRef.current = tailRotorNode ? pivotOnOwnCenter(tailRotorNode) : null;
  }, [scene]);

  useEffect(() => bindKeyboardControls(), []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    // -----------------
    // Reset: snap back to spawn, zero velocity, engine off, rotors stopped.
    // -----------------

    if (consumeReset()) {
      body.setTranslation(SPAWN_POSITION, true);
      body.setRotation(SPAWN_ROTATION, true);
      body.setLinvel(ZERO_VECTOR, true);
      body.setAngvel(ZERO_VECTOR, true);
      collective.current = 0;
      engineState.running = false;
      engineState.rpm = 0;
      mainRotorRef.current?.rotation.set(0, 0, 0);
      tailRotorRef.current?.rotation.set(0, 0, 0);
    }

    // -----------------
    // Engine: toggled on/off, rotor rpm ramps/decays independently of collective.
    // -----------------

    if (consumeEngineToggle()) {
      engineState.running = !engineState.running;
    }
    engineState.rpm = THREE.MathUtils.clamp(
      engineState.rpm +
        (engineState.running ? ENGINE_SPINUP_RATE : -ENGINE_SPINDOWN_RATE) * delta,
      0,
      1,
    );

    if (mainRotorRef.current) {
      mainRotorRef.current.rotation.y += MAIN_ROTOR_MAX_SPEED * engineState.rpm * delta;
    }
    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.x += TAIL_ROTOR_MAX_SPEED * engineState.rpm * delta;
    }

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

    // Both attitude authority and lift come from the rotor wash, so both
    // scale with rpm — a cold rotor gives no control and no thrust, not just
    // no thrust, matching a real helicopter at engine-off.
    const rpm = engineState.rpm;

    const torque = new THREE.Vector3()
      .addScaledVector(right, pitchInput * PITCH_TORQUE * mass * rpm)
      .addScaledVector(forward, rollInput * ROLL_TORQUE * mass * rpm)
      .addScaledVector(up, yawInput * YAW_TORQUE * mass * rpm);

    // Thrust fires along the body's own up axis, so tilting it (via the
    // torque above) is what redirects thrust into horizontal movement —
    // just like a real rotorcraft, instead of a scripted horizontal force.
    const force = up
      .clone()
      .multiplyScalar(collective.current * MAX_LIFT_THRUST * rpm * weight);

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
      linearDamping={1}
      angularDamping={ANGULAR_DAMPING}
      enabledRotations={[true, true, true]}
    >
      <CuboidCollider
        args={BODY_COLLIDER_HALF_EXTENTS}
        position={BODY_COLLIDER_OFFSET}
        mass={1}
      />
      <group ref={modelRef}>
        <primitive object={scene} />
      </group>
    </RigidBody>
  );
}
