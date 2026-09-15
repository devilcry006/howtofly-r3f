import { useEffect, useState } from "react";
import { netState } from "./socket";
import "./ConnectionStatus.css";

// Small debug readout so setting up the PC + phone on the same WiFi is less
// of a guessing game — polled rather than event-driven since netState is
// plain mutable module state, not React state.
export function ConnectionStatus() {
  const [connected, setConnected] = useState(netState.connected);

  useEffect(() => {
    const id = setInterval(() => setConnected(netState.connected), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`connection-status ${connected ? "connected" : "disconnected"}`}>
      {connected ? "● online" : "○ connecting…"}
    </div>
  );
}
