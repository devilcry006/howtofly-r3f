import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sendHit, sendShot } from "../net/socket";
import { registerHit } from "./targetState";
import { spawnTracer, spawnImpact } from "../combat/effectsState";

const CENTER = new THREE.Vector2(0, 0);
const MAX_RANGE = 300; // tracer length on a miss, since there's nothing to stop it

// The crosshair is always screen-center (GunnerHUD), so "aim" is just
// whatever the pilot is flying toward — a tap anywhere fires straight down
// that fixed centerline, no independent aim controls.
export function GunnerFireControl() {
  const { gl, camera, scene, raycaster } = useThree();

  useEffect(() => {
    const onFire = () => {
      raycaster.setFromCamera(CENTER, camera);
      // Closest hit of any kind (ground, scenery, targets, ...) — not just
      // objects tagged as targets — so the impact burst shows up wherever
      // the shot actually lands. Scoring still only cares about targetId.
      const hit = raycaster.intersectObjects(scene.children, true)[0];

      const origin = camera.position.toArray() as [number, number, number];
      const endPoint = hit ? hit.point : raycaster.ray.at(MAX_RANGE, new THREE.Vector3());
      const point = endPoint.toArray() as [number, number, number];

      spawnTracer(origin, point); // optimistic local render, before the round trip

      if (hit) {
        spawnImpact(point);
        const targetId = hit.object.userData?.targetId as string | undefined;
        if (targetId) {
          registerHit(targetId);
          sendHit(targetId);
        }
        sendShot(origin, point, targetId, true);
      } else {
        sendShot(origin, point);
      }
    };

    const el = gl.domElement;
    el.addEventListener("pointerdown", onFire);
    return () => el.removeEventListener("pointerdown", onFire);
  }, [gl, camera, scene, raycaster]);

  return null;
}
