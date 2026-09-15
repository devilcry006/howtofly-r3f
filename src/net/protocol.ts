// Wire format shared by the browser clients and server/index.js.
// Arrays instead of THREE.Vector3/Quaternion since this crosses JSON.

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];

export type ClientMessage =
  | { type: "hello"; role: "pilot" | "gunner" }
  | { type: "flight"; position: Vec3Tuple; quaternion: QuatTuple }
  | { type: "hit"; targetId: string }
  | { type: "shot"; origin: Vec3Tuple; point: Vec3Tuple; targetId?: string; hit?: boolean };

export type ServerMessage =
  | { type: "flight"; position: Vec3Tuple; quaternion: QuatTuple }
  | { type: "hit"; targetId: string }
  | { type: "shot"; origin: Vec3Tuple; point: Vec3Tuple; targetId?: string; hit?: boolean }
  | {
      type: "sync";
      flight: { position: Vec3Tuple; quaternion: QuatTuple } | null;
      hits: string[];
    };
