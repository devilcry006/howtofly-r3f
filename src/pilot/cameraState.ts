// Plain mutable module state (see CLAUDE.md) for the pilot's own camera
// mode, toggled by Ctrl and read every frame by HelicopterCamera.
export const cameraState = {
  mode: "chase" as "chase" | "fps",
};
