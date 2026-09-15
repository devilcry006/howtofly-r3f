// Minimal LAN relay server for the pilot/gunner split.
// Run alongside `vite --host` (see package.json "server" script) so a phone
// on the same WiFi can reach it at ws://<pc-lan-ip>:8080.
import { WebSocketServer } from "ws";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// Last known helicopter transform and destroyed-target ids, so a client that
// joins late (e.g. the gunner opening the page after the pilot already took
// off) gets caught up instead of seeing nothing until the next update.
let lastFlight = null;
const hits = new Set();

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "sync", flight: lastFlight, hits: [...hits] }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "flight") {
      lastFlight = { position: msg.position, quaternion: msg.quaternion };
    } else if (msg.type === "hit") {
      if (hits.has(msg.targetId)) return;
      hits.add(msg.targetId);
    } else if (msg.type === "shot") {
      // Ephemeral tracer/impact visual — nothing to cache, just relay below.
    } else {
      // "hello" and anything unrecognized: nothing to relay.
      return;
    }

    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  });
});

console.log(`Relay server listening on ws://0.0.0.0:${PORT}`);
