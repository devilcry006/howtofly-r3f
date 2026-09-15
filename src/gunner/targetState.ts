// Static target list + shared mutable "destroyed" set, following the same
// plain-module-state pattern as flightState/inputState (read every frame,
// no React re-renders needed for a value that changes this often).

export type Target = {
  id: string;
  position: [number, number, number];
};

export const TARGETS: Target[] = [
  { id: "t1", position: [20, 8, -30] },
  { id: "t2", position: [-25, 10, -50] },
  { id: "t3", position: [0, 12, -70] },
  { id: "t4", position: [35, 6, -15] },
  { id: "t5", position: [-15, 9, -60] },
];

export const hitTargets = new Set<string>();

export function registerHit(id: string) {
  hitTargets.add(id);
}
