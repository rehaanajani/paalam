import { Gem } from "./Gem";
import type { GemDef } from "../types";

/** Up to three faces in one tile, Argon first: how a Bridge shows who worked on it (Socius's GroupAvatar). */
export function GroupGem({ gems, size = 34, busy = false }: { gems: GemDef[]; size?: number; busy?: boolean }) {
  const faces: (GemDef | "argon")[] = [...(["argon"] as const), ...gems].slice(0, 3);
  const inner = Math.round(size * (faces.length > 2 ? 0.56 : 0.64));
  const spots =
    faces.length > 2
      ? [
          [(size - inner) / 2, 0],
          [0, size - inner],
          [size - inner, size - inner],
        ]
      : [
          [0, 0],
          [size - inner, size - inner],
        ];
  return (
    <span className="group-gem" style={{ width: size, height: size }} aria-hidden="true">
      {faces.map((g, i) => (
        <span key={g === "argon" ? "argon" : g.id} style={{ left: spots[i]![0], top: spots[i]![1] }}>
          {g === "argon" ? <Gem argon size={inner} name="argon-mini" mood={busy ? "busy" : "idle"} /> : <Gem color={g.color} size={inner} name={g.id} mood={busy ? "busy" : "idle"} />}
        </span>
      ))}
    </span>
  );
}
