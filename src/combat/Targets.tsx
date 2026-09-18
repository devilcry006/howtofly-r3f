import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TARGETS, hitTargets } from "./targetState";

// Static, non-physics practice targets: the pilot raycasts against these
// directly (FireControl), and destroyed state is just a shared id set kept
// visually in sync here every frame — no per-target React state needed.
export function Targets() {
  const refs = useRef<Record<string, THREE.Mesh | null>>({});

  useFrame(() => {
    for (const target of TARGETS) {
      const mesh = refs.current[target.id];
      if (mesh) mesh.visible = !hitTargets.has(target.id);
    }
  });

  return (
    <>
      {TARGETS.map((target) => (
        <mesh
          key={target.id}
          ref={(el) => {
            refs.current[target.id] = el;
          }}
          position={target.position}
          userData={{ targetId: target.id }}
        >
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial color="#e63946" emissive="#e63946" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}
