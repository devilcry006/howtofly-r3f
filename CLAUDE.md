# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-player helicopter game built with React Three Fiber. The player flies the helicopter with physics and fires at ground targets by pressing Space (or a touch button), from whichever camera view (chase or cockpit) is active.

## Commands

```bash
npm run dev       # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # vite preview
```

There is no test suite configured.

To actually play locally: run `npm run dev` and open the printed localhost URL.

## Architecture

**Plain mutable module state, not React state, for anything touched every frame.** `flightState`, `inputState` (`controlInput`), `targetState` (`hitTargets`), and `effectsState` (`tracers`/`impacts`) are all plain exported objects/arrays mutated directly and read inside `useFrame`. This avoids re-render cost for 60fps-changing values. Where a component still needs to react to a change (e.g. `BulletEffects`), the state module bumps a `revision` counter that's polled once per frame and used to trigger a single `forceTick`. Follow this pattern for new per-frame state instead of introducing `useState`/context for it.

**Feature-based folder layout** (see `src/`):
- `app/` — `App.tsx`, just renders `PilotApp`
- `pilot/` — the flying scene: `Helicopter.tsx` (Rapier `RigidBody` + flight physics, writes `flightState`), `HelicopterCamera.tsx` (chase/cockpit toggle), `FireControl.tsx` (fires on Space/touch), `FireHUD.tsx` (crosshair), `TouchControls.tsx` (on-screen joysticks + buttons, writes to `inputState`), `flightState.ts`, `inputState.ts`
- `combat/` — `Targets.tsx` + `targetState.ts` (practice targets + destroyed-id set), `BulletEffects.tsx` + `effectsState.ts` (tracer lines and impact particle bursts)

**Firing/hit detection.** `FireControl` raycasts from the helicopter's own nose, along its forward direction — not from the render camera, since the chase camera looks back at the aircraft and a camera-centered raycast would just hit the player's own model. It intersects the *closest* object hit in the scene, not just objects tagged as targets, so impact particles show up for any hit (ground, scenery), while only `userData.targetId`-tagged objects register a score via `registerHit`. Decorative or self-hitting objects are excluded from raycasting: `Sky` and `gridHelper` via `raycast={() => null}`, and the helicopter's own GLTF meshes via a `scene.traverse` that no-ops `raycast` on every node (a `raycast={() => null}` on the wrapping `<group>` alone wouldn't work, since `Raycaster.intersectObjects` calls each descendant's own `.raycast` directly).

**Space is a one-shot action, not a held-fire input.** Like engine ignition/reset/view-toggle, firing is queued on the keydown edge (`requestFire`/`consumeFire` in `inputState.ts`) and drained once per frame by `FireControl`'s `useFrame` — holding Space down doesn't rapid-fire.
