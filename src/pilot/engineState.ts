// Plain mutable module state (see CLAUDE.md) for the engine/rotor, polled by
// Helicopter every physics frame and by EngineStatus (HTML overlay) on an
// interval. `rpm` is rotor spin-up fraction, not engine on/off: switching the
// engine off lets the rotor freewheel down instead of stopping instantly, and
// lift/control authority in Helicopter scale with rpm — so there's no single
// "liftoff unlocked" flag, the craft just can't produce enough thrust to leave
// the ground until rpm is high enough for the current collective setting.
export const engineState = {
  running: false,
  rpm: 0, // 0..1
};
