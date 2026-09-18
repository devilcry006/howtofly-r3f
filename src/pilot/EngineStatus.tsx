import { useEffect, useState } from "react";
import { engineState } from "./engineState";
import "./EngineStatus.css";

// Small readout of engine on/off + rotor rpm so it's clear why the craft
// won't lift off yet — polled rather than event-driven since engineState is
// plain mutable module state, not React state (see ConnectionStatus).
export function EngineStatus() {
  const [running, setRunning] = useState(engineState.running);
  const [rpm, setRpm] = useState(engineState.rpm);

  useEffect(() => {
    const id = setInterval(() => {
      setRunning(engineState.running);
      setRpm(engineState.rpm);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const label = running
    ? rpm >= 1
      ? "ENGINE ON"
      : "STARTING…"
    : rpm > 0
      ? "SHUTTING DOWN…"
      : "ENGINE OFF";

  return (
    <div className={`engine-status ${running ? "running" : "off"}`}>
      {label} — RPM {Math.round(rpm * 100)}%
    </div>
  );
}
