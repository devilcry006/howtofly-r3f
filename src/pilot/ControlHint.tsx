import "./ControlHint.css";

// Static reference for the pilot controls: a keyboard legend on desktop
// (fine pointer), or labels over each joystick on touch — mirrors the
// pointer-based show/hide TouchControls already uses, so no JS needed.
export function ControlHint() {
  return (
    <>
      <div className="control-hint-keyboard">
        <span>I — start / stop engine</span>
        <span>R — reset</span>
        <span>W / S — pitch forward / back</span>
        <span>A / D — roll left / right</span>
        <span>Q / E — yaw left / right</span>
        <span>Shift / C — up / down</span>
      </div>
      <div className="touch-hint touch-hint-left">yaw • up/down</div>
      <div className="touch-hint touch-hint-right">roll • pitch</div>
    </>
  );
}
