import { useRef } from "react";
import "./TouchControls.css";
import { requestEngineToggle, requestReset, setTouchStick } from "./inputState";

// Max distance (px) the knob can travel from center, matching the CSS
// base/knob sizes below (60px base radius - 28px knob radius - a small margin).
const STICK_TRAVEL = 30;

function JoystickPad({ side }: { side: "left" | "right" }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  const setKnobOffset = (dx: number, dy: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_TRAVEL) {
      dx = (dx / dist) * STICK_TRAVEL;
      dy = (dy / dist) * STICK_TRAVEL;
    }

    setKnobOffset(dx, dy);
    setTouchStick(side, dx / STICK_TRAVEL, dy / STICK_TRAVEL);
  };

  const reset = () => {
    setKnobOffset(0, 0);
    setTouchStick(side, 0, 0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    reset();
  };

  return (
    <div
      className={`joystick joystick-${side}`}
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="joystick-knob" ref={knobRef} />
    </div>
  );
}

// Two on-screen virtual joysticks for touch devices, mirroring a Mode-2 RC
// transmitter: left stick = yaw + collective, right stick = pitch + roll.
// Hidden on fine-pointer (mouse/trackpad) devices via CSS. The engine and
// reset buttons are discrete one-shot actions (mirror the I/R keys), not stick axes.
export function TouchControls() {
  return (
    <div className="touch-controls">
      <JoystickPad side="left" />
      <JoystickPad side="right" />
      <button
        type="button"
        className="engine-button"
        onPointerDown={(e) => {
          e.preventDefault();
          requestEngineToggle();
        }}
      >
        ⏻ engine
      </button>
      <button
        type="button"
        className="reset-button"
        onPointerDown={(e) => {
          e.preventDefault();
          requestReset();
        }}
      >
        ↺ reset
      </button>
    </div>
  );
}
