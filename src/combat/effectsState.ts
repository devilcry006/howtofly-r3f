// Ephemeral bullet visuals (tracer lines + impact sparks): pushed locally
// when this device fires, and from the network "shot" message when the
// other device fires. Plain array mutation wouldn't trigger a React
// re-render on its own, so `revision` is bumped on every spawn/prune and
// BulletEffects polls it each frame (same read-every-frame style as
// flightState/targetState).

export type Tracer = {
  id: string;
  origin: [number, number, number];
  point: [number, number, number];
  createdAt: number;
};

export type Impact = {
  id: string;
  point: [number, number, number];
  createdAt: number;
};

export const TRACER_LIFETIME_MS = 120;
export const IMPACT_LIFETIME_MS = 450;

export const tracers: Tracer[] = [];
export const impacts: Impact[] = [];

let nextId = 0;
export let revision = 0;

export function spawnTracer(origin: [number, number, number], point: [number, number, number]) {
  tracers.push({ id: `tr${nextId++}`, origin, point, createdAt: performance.now() });
  revision++;
}

export function spawnImpact(point: [number, number, number]) {
  impacts.push({ id: `im${nextId++}`, point, createdAt: performance.now() });
  revision++;
}

export function pruneEffects(now: number) {
  const before = tracers.length + impacts.length;
  for (let i = tracers.length - 1; i >= 0; i--) {
    if (now - tracers[i].createdAt > TRACER_LIFETIME_MS) tracers.splice(i, 1);
  }
  for (let i = impacts.length - 1; i >= 0; i--) {
    if (now - impacts[i].createdAt > IMPACT_LIFETIME_MS) impacts.splice(i, 1);
  }
  if (tracers.length + impacts.length !== before) revision++;
}
