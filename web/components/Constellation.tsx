import type { CSSProperties } from "react";
import { Gem, type Mood } from "./Gem";
import type { GemDef } from "../types";

/**
 * Argon at the centre, the specialist Gems orbiting it. A Gem that is working
 * on the current run lights up and a beam of light runs to it from Argon.
 */
export function Constellation({
  gems,
  size = 420,
  argonMood = "idle",
  moods = {},
  active = [],
  labels = true,
  onPick,
}: {
  gems: GemDef[];
  size?: number;
  argonMood?: Mood;
  moods?: Record<string, Mood>;
  active?: string[];
  labels?: boolean;
  onPick?: (id: string) => void;
}) {
  const ring = size * 0.38;
  const sub = Math.round(size * (gems.length > 6 ? 0.13 : 0.16));
  const c = size / 2;
  return (
    <div className={`constellation ${active.length ? "has-active" : ""}`} style={{ width: size, height: size } as CSSProperties}>
      <div className="orbit-halo" style={{ inset: c - ring - sub * 0.15 }} />
      <div className="orbit">
        <svg className="beams" width={size} height={size} aria-hidden="true">
          {gems.map((g, i) => {
            const a = (i / gems.length) * Math.PI * 2 - Math.PI / 2;
            const on = active.includes(g.id);
            return <line key={g.id} className={on ? "beam on" : "beam"} x1={c} y1={c} x2={c + Math.cos(a) * ring} y2={c + Math.sin(a) * ring} style={{ "--gem": g.color } as CSSProperties} />;
          })}
        </svg>
        {gems.map((g, i) => {
          const a = (i / gems.length) * Math.PI * 2 - Math.PI / 2;
          const on = active.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              className={`orbit-gem ${on ? "on" : ""} ${active.length && !on ? "dim" : ""}`}
              style={{ left: c + Math.cos(a) * ring - sub / 2, top: c + Math.sin(a) * ring - sub / 2, width: sub, "--gem": g.color } as CSSProperties}
              onClick={() => onPick?.(g.id)}
              title={`${g.name}: ${g.purpose}`}
            >
              <span className="counter">
                <Gem color={g.color} size={sub} mood={moods[g.id] ?? (on ? "busy" : "idle")} name={g.id} />
                {labels && <span className="orbit-label">{g.name}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="argon-core" style={{ width: size * 0.36, height: size * 0.36, left: c - size * 0.18, top: c - size * 0.18 }}>
        <Gem argon size={Math.round(size * 0.36)} mood={argonMood} name="argon" title="Argon" />
      </div>
    </div>
  );
}
