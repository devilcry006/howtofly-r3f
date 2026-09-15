import * as THREE from "three";
import type { ClientMessage, ServerMessage } from "./protocol";
import { registerHit } from "../gunner/targetState";
import { spawnTracer, spawnImpact } from "../combat/effectsState";

type Role = "pilot" | "gunner";

// Mutable, read every frame by GunnerCamera (mirrors flightState's pattern):
// the pilot's last-known transform, as seen over the network.
export const netState = {
  connected: false,
  hasRemoteFlight: false,
  remotePosition: new THREE.Vector3(0, 2, 0),
  remoteQuaternion: new THREE.Quaternion(),
};

const PORT = 8080;
const SEND_INTERVAL_MS = 50; // ~20Hz, plenty for a lerped remote transform

let socket: WebSocket | null = null;
let lastSentAt = 0;

function wsUrl() {
  // Same host the page was loaded from (LAN IP when opened from a phone,
  // localhost when opened on the PC itself), fixed relay port.
  return `ws://${window.location.hostname}:${PORT}`;
}

function applyFlight(position: [number, number, number], quaternion: [number, number, number, number]) {
  netState.remotePosition.set(position[0], position[1], position[2]);
  netState.remoteQuaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  netState.hasRemoteFlight = true;
}

function handleMessage(msg: ServerMessage) {
  if (msg.type === "flight") {
    applyFlight(msg.position, msg.quaternion);
  } else if (msg.type === "hit") {
    registerHit(msg.targetId);
  } else if (msg.type === "shot") {
    spawnTracer(msg.origin, msg.point);
    if (msg.hit) spawnImpact(msg.point);
  } else if (msg.type === "sync") {
    if (msg.flight) applyFlight(msg.flight.position, msg.flight.quaternion);
    msg.hits.forEach(registerHit);
  }
}

// Opens the relay connection for this role and keeps retrying it. Returns a
// cleanup function suitable for useEffect(() => connectNetwork(role), []).
export function connectNetwork(role: Role) {
  let cancelled = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (cancelled) return;
    ws = new WebSocket(wsUrl());
    socket = ws;

    ws.onopen = () => {
      netState.connected = true;
      ws?.send(JSON.stringify({ type: "hello", role } satisfies ClientMessage));
    };

    ws.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      netState.connected = false;
      if (socket === ws) socket = null;
      if (!cancelled) reconnectTimer = setTimeout(open, 1000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  open();

  return () => {
    cancelled = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket = null;
    ws?.close();
  };
}

// Called every frame from Helicopter's useFrame; throttles itself so we
// don't flood the socket at physics tick rate.
export function sendFlightUpdate(position: THREE.Vector3, quaternion: THREE.Quaternion) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastSentAt < SEND_INTERVAL_MS) return;
  lastSentAt = now;

  const msg: ClientMessage = {
    type: "flight",
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
  socket.send(JSON.stringify(msg));
}

export function sendHit(targetId: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const msg: ClientMessage = { type: "hit", targetId };
  socket.send(JSON.stringify(msg));
}

export function sendShot(
  origin: [number, number, number],
  point: [number, number, number],
  targetId?: string,
  hit?: boolean,
) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const msg: ClientMessage = { type: "shot", origin, point, targetId, hit };
  socket.send(JSON.stringify(msg));
}
