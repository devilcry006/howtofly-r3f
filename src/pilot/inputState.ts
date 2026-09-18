// Shared, analog (-1..1) flight-stick state written by keyboard (desktop)
// and on-screen joysticks (touch), read every frame by Helicopter. Keyboard
// and touch are tracked as separate sources and summed, so a device with
// both (e.g. a tablet with a keyboard case) just works without one source
// clobbering the other.

type Axes = {
  pitch: number; // -1 nose down/forward .. 1 nose up/back
  roll: number; // -1 left .. 1 right
  yaw: number; // -1 nose left .. 1 nose right
  collective: number; // -1 full decay .. 1 full ramp-up, 0 = natural decay
};

function zeroAxes(): Axes {
  return { pitch: 0, roll: 0, yaw: 0, collective: 0 };
}

const keyboard = zeroAxes();
const touch = zeroAxes();

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

export const controlInput = {
  get pitch() {
    return clamp(keyboard.pitch + touch.pitch);
  },
  get roll() {
    return clamp(keyboard.roll + touch.roll);
  },
  get yaw() {
    return clamp(keyboard.yaw + touch.yaw);
  },
  get collective() {
    return clamp(keyboard.collective + touch.collective);
  },
};

type Key = "w" | "s" | "a" | "d" | "q" | "e" | "shift" | "control";

const pressed: Record<Key, boolean> = {
  w: false,
  s: false,
  a: false,
  d: false,
  q: false,
  e: false,
  shift: false,
  control: false,
};

function recomputeKeyboard() {
  keyboard.pitch = (pressed.s ? 1 : 0) - (pressed.w ? 1 : 0);
  keyboard.roll = (pressed.d ? 1 : 0) - (pressed.a ? 1 : 0);
  keyboard.yaw = (pressed.q ? 1 : 0) - (pressed.e ? 1 : 0);
  keyboard.collective = pressed.shift ? 1 : pressed.control ? -1 : 0;
}

// Engine ignition and reset are discrete one-shot actions (a key or a touch
// button), not analog axes, so each is queued on the press edge and drained
// once by Helicopter each frame rather than tracked as held/released state.
function makeAction() {
  let queued = false;
  return {
    request: () => {
      queued = true;
    },
    consume: (): boolean => {
      if (!queued) return false;
      queued = false;
      return true;
    },
  };
}

const engineToggleAction = makeAction();
export const requestEngineToggle = engineToggleAction.request;
export const consumeEngineToggle = engineToggleAction.consume;

const resetAction = makeAction();
export const requestReset = resetAction.request;
export const consumeReset = resetAction.consume;

const viewToggleAction = makeAction();
export const requestViewToggle = viewToggleAction.request;
export const consumeViewToggle = viewToggleAction.consume;

export function bindKeyboardControls() {
  const onKeyDown = (e: KeyboardEvent) => {
    const rawKey = e.key.toLowerCase();
    if (rawKey in pressed) {
      pressed[rawKey as Key] = true;
      recomputeKeyboard();
      return;
    }
    if (e.repeat) return;
    if (rawKey === "i") {
      requestEngineToggle();
    } else if (rawKey === "r") {
      requestReset();
    } else if (rawKey === "c") {
      requestViewToggle();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase() as Key;
    if (key in pressed) {
      pressed[key] = false;
      recomputeKeyboard();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

// x, y are normalized stick displacement in -1..1, screen-space (x: right
// positive, y: down positive) — as reported directly by a touch joystick.
// Left stick: x -> yaw, y -> collective (up = ramp up, matches Shift/Ctrl).
// Right stick: x -> roll, y -> pitch (up = nose down/forward, matches W/S).
export function setTouchStick(side: "left" | "right", x: number, y: number) {
  if (side === "left") {
    touch.yaw = clamp(-x);
    touch.collective = clamp(-y);
  } else {
    touch.roll = clamp(x);
    touch.pitch = clamp(y);
  }
}
