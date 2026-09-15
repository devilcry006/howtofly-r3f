#!/usr/bin/env bash
# Starts both the Vite dev server and the WebSocket relay server
# (needed together for LAN pilot/gunner play), and stops both on exit.
set -euo pipefail
cd "$(dirname "$0")"

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")"

echo "Starting relay server (ws://0.0.0.0:8080) and Vite dev server..."
echo "LAN address for phones: ws://${LAN_IP}:8080"

node server/index.js &
SERVER_PID=$!

npx vite --host &
VITE_PID=$!

cleanup() {
  echo "Stopping servers..."
  kill "$SERVER_PID" "$VITE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
