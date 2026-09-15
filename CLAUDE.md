# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-device networked helicopter game built with React Three Fiber. One device ("pilot") flies the helicopter with physics; a second device ("gunner"), typically a phone on the same WiFi, rides shotgun and fires at ground targets from the pilot's point of view. The two devices sync over a raw WebSocket relay — there is no backend logic beyond relaying messages.

## Commands

```bash
npm run dev       # Vite dev server (--host, so a phone on the LAN can reach it)
npm run server    # WebSocket relay server (server/index.js), port 8080 — required for pilot/gunner sync
npm run start      # ./start.sh — runs dev + server together, prints the LAN IP for the phone to connect to
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # vite preview
```

There is no test suite configured.

To actually play locally: run `npm run start` (or `dev` + `server` in two terminals), open `http://localhost:5173/?role=pilot` on the PC and `http://<lan-ip>:5173/?role=gunner` on a phone on the same WiFi.

## Architecture

**Role split via URL, not in-app switching.** `useRole` (`src/app/useRole.ts`) reads `?role=pilot|gunner` from the URL; `App.tsx` renders `PilotApp` or `GunnerApp` accordingly. The pilot and gunner are two independent Canvas trees that never share a JS runtime — everything crossing between them goes over the WebSocket relay.

**`server/index.js`** is a minimal `ws` relay: no auth, no persistence beyond an in-memory `lastFlight` transform and `hits` set (so a client joining late gets caught up via a `sync` message). It just JSON-parses incoming messages and re-broadcasts them to every other connected client. Message shapes are defined once in `src/net/protocol.ts` (`ClientMessage`/`ServerMessage`) and must be kept in sync manually with `server/index.js` since the server isn't TypeScript.

**`src/net/socket.ts`** owns the WebSocket connection (`connectNetwork(role)`) and both directions of traffic: `sendFlightUpdate`/`sendHit`/`sendShot` push local state out; `handleMessage` applies incoming messages directly into the shared mutable state modules (`netState`, `registerHit`, `spawnTracer`/`spawnImpact`) rather than through React state.

**Plain mutable module state, not React state, for anything touched every frame.** `flightState`, `inputState` (`controlInput`), `targetState` (`hitTargets`), and `effectsState` (`tracers`/`impacts`) are all plain exported objects/arrays mutated directly and read inside `useFrame`. This avoids re-render cost for 60fps-changing values. Where a component still needs to react to a change (e.g. `BulletEffects`), the state module bumps a `revision` counter that's polled once per frame and used to trigger a single `forceTick`. Follow this pattern for new per-frame state instead of introducing `useState`/context for it.

**Feature-based folder layout** (see `src/`):
- `app/` — role routing shell (`App.tsx`, `RoleSelect`, `useRole`)
- `pilot/` — the flying scene: `Helicopter.tsx` (Rapier `RigidBody` + flight physics, writes `flightState` and calls `sendFlightUpdate`), `HelicopterCamera.tsx`, `TouchControls.tsx` (on-screen joysticks, writes to `inputState` via `setTouchStick`), `flightState.ts`, `inputState.ts`
- `gunner/` — the gunner scene: `GunnerCamera.tsx` (locks onto the pilot's broadcast transform via `netState`, no local physics), `GunnerFireControl.tsx` (raycasts on tap/click), `GunnerHUD.tsx`, `Targets.tsx` + `targetState.ts`
- `combat/` — `BulletEffects.tsx` + `effectsState.ts`: tracer lines and impact particle bursts, instantiated once per Canvas (both pilot and gunner render it) so both devices see the same shot
- `net/` — `protocol.ts` (wire types), `socket.ts` (connection + state bridging), `ConnectionStatus.tsx`

**Firing/hit detection lives entirely client-side in the gunner.** `GunnerFireControl` raycasts from screen center (the crosshair is always centered — there's no independent aim, just wherever the pilot points the helicopter) against the *closest* object hit in the scene, not just objects tagged as targets — so impact particles show up for any hit (ground, scenery), while only `userData.targetId`-tagged objects register a score via `registerHit`/`sendHit`. Decorative, non-hittable scene objects (`Sky`, `gridHelper`) are excluded from raycasting with `raycast={() => null}`. The gunner spawns its own tracer/impact optimistically before the round trip, then broadcasts a `shot` message (carrying `point` and a `hit` flag) so the pilot's `BulletEffects` renders the same effect.

**Physics only exists on the pilot side.** `PilotApp` wraps the scene in `@react-three/rapier`'s `Physics`; the gunner has no `Physics`/`RigidBody` at all — it's a passive camera + raycast-only scene that mirrors the pilot's position/quaternion over the network at ~20Hz (`SEND_INTERVAL_MS` in `socket.ts`).
