import { useEffect, useState } from "react";
import { cameraState } from "./cameraState";
import "./FireHUD.css";

// Purely visual screen-center reticle. Only shown in cockpit view, where it
// lines up exactly with the actual fire direction (FireControl fires from
// the nose forward) — in chase view the camera looks back at the aircraft,
// so a screen-center reticle there wouldn't mean anything. Polled rather
// than event-driven since cameraState is plain mutable module state, not
// React state (see EngineStatus).
export function FireHUD() {
  const [mode, setMode] = useState(cameraState.mode);

  useEffect(() => {
    const id = setInterval(() => setMode(cameraState.mode), 100);
    return () => clearInterval(id);
  }, []);

  if (mode !== "fps") return null;
  return <div className="crosshair" />;
}
