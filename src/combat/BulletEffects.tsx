import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import {
  tracers,
  impacts,
  revision,
  pruneEffects,
  TRACER_LIFETIME_MS,
  IMPACT_LIFETIME_MS,
  type Tracer,
  type Impact,
} from "./effectsState";

const IMPACT_PARTICLES = 14;

// Evenly spread burst directions (Fibonacci sphere) instead of Math.random —
// deterministic, so it stays pure to call during render, and reads better
// as an explosion than uniform-random directions do at this particle count.
function fibonacciSphereDirection(i: number, total: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(total - 1, 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * i;
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

const IMPACT_VELOCITIES = Array.from({ length: IMPACT_PARTICLES }, (_, i) =>
  fibonacciSphereDirection(i, IMPACT_PARTICLES).multiplyScalar(2 + (i % 5) * 0.8),
);

function TracerLine({ tracer }: { tracer: Tracer }) {
  // Raw <line> collides with the SVG JSX namespace in .tsx, so this uses
  // drei's Line (a fat Line2) instead of a plain THREE.Line primitive.
  const lineRef = useRef<Line2>(null);

  useFrame(() => {
    const t = THREE.MathUtils.clamp((performance.now() - tracer.createdAt) / TRACER_LIFETIME_MS, 0, 1);
    const material = lineRef.current?.material;
    if (material) material.opacity = 1 - t;
  });

  return (
    <Line
      ref={lineRef}
      points={[tracer.origin, tracer.point]}
      color="#fff2a8"
      lineWidth={2}
      transparent
      opacity={1}
    />
  );
}

function ImpactBurst({ impact }: { impact: Impact }) {
  // Everything mutated every frame lives behind a ref to the actual THREE
  // object, touched only inside useFrame — never a value derived from
  // useState/useMemo, and never read/written during render (same idiom as
  // Helicopter.tsx's bodyRef/modelRef and Targets.tsx's mesh refs).
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;

    // r3f gives <points> a default (empty) BufferGeometry when none is
    // passed, auto-disposed on unmount same as any other implicit geometry —
    // just attach positions to it once, lazily, the first frame it's alive.
    let position = points.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!position) {
      position = new THREE.Float32BufferAttribute(new Float32Array(IMPACT_PARTICLES * 3), 3);
      points.geometry.setAttribute("position", position);
    }

    const t = THREE.MathUtils.clamp((performance.now() - impact.createdAt) / IMPACT_LIFETIME_MS, 0, 1);
    for (let i = 0; i < IMPACT_PARTICLES; i++) {
      const v = IMPACT_VELOCITIES[i];
      position.setXYZ(i, impact.point[0] + v.x * t, impact.point[1] + v.y * t, impact.point[2] + v.z * t);
    }
    position.needsUpdate = true;
    if (materialRef.current) materialRef.current.opacity = 1 - t;
  });

  return (
    <points ref={pointsRef}>
      <pointsMaterial ref={materialRef} color="#ffb84d" size={0.4} transparent opacity={1} sizeAttenuation />
    </points>
  );
}

// One instance lives in each Canvas (Pilot + Gunner) so both devices see the
// same tracer/impact even though only the gunner ever fires.
export function BulletEffects() {
  const [, forceTick] = useState(0);
  const lastRevision = useRef(-1);

  useFrame(() => {
    pruneEffects(performance.now());
    if (revision !== lastRevision.current) {
      lastRevision.current = revision;
      forceTick((n) => n + 1);
    }
  });

  return (
    <>
      {tracers.map((tracer) => (
        <TracerLine key={tracer.id} tracer={tracer} />
      ))}
      {impacts.map((impact) => (
        <ImpactBurst key={impact.id} impact={impact} />
      ))}
    </>
  );
}
