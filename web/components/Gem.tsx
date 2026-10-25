import { useEffect, useId, useRef, type CSSProperties } from "react";
import { trackGem } from "./gemMotion";

export type Mood = "idle" | "busy" | "happy" | "worried" | "sleepy";

const hash = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

// Argon wears the Gemini sparkle: four curved points meeting in a crystal heart.
const SPARKLE = "M50 3C53 29 71 47 97 50C71 53 53 71 50 97C47 71 29 53 3 50C29 47 47 29 50 3Z";
const SPARKLE_LIGHT = "M50 3C47 29 29 47 3 50L50 50Z"; // upper-left facet catches the light
const SPARKLE_LIGHT2 = "M50 3C53 29 71 47 97 50L50 50Z";
const SPARKLE_SHADE = "M50 97C53 71 71 53 97 50L50 50Z";
// Every specialist is a cut gem: table, crown and pavilion.
const CUT = "M30 15H70L93 38L50 93L7 38Z";
const CUT_CROWN = "M30 15H70L93 38H7Z";
const CUT_LINES = "M7 38H93M30 15L40 38L50 15L60 38L70 15M40 38L50 93L60 38";

function Face({ mood, argon }: { mood: Mood; argon: boolean }) {
  const y = argon ? 47 : 50; // eye line
  const m = argon ? 60 : 64; // mouth line
  const ink = argon ? "#0e1330" : "rgba(10,12,24,.86)";
  const mouth =
    mood === "happy"
      ? `M42 ${m - 2}Q50 ${m + 8} 58 ${m - 2}`
      : mood === "worried"
        ? `M44 ${m + 3}Q50 ${m - 3} 56 ${m + 3}`
        : mood === "sleepy"
          ? `M46 ${m}H54`
          : `M44.5 ${m}Q50 ${m + 3.5} 55.5 ${m}`;
  return (
    <g className="gem-face">
      <g className="gem-idle">
        <g className="gem-blink">
          {mood === "sleepy" ? (
            <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
              <path d={`M37 ${y}q4 3.5 8 0`} />
              <path d={`M55 ${y}q4 3.5 8 0`} />
            </g>
          ) : mood === "happy" ? (
            <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
              <path d={`M37 ${y + 1}q4 -5 8 0`} />
              <path d={`M55 ${y + 1}q4 -5 8 0`} />
            </g>
          ) : (
            <g>
              <ellipse cx="41" cy={y} rx="4.2" ry="5.4" fill={ink} />
              <ellipse cx="59" cy={y} rx="4.2" ry="5.4" fill={ink} />
              <g className="gem-glint" fill="#fff">
                <circle cx="42.4" cy={y - 2} r="1.5" />
                <circle cx="60.4" cy={y - 2} r="1.5" />
              </g>
            </g>
          )}
        </g>
      </g>
      {mood === "busy" ? (
        <ellipse className="gem-mouth" cx="50" cy={m + 1} rx="2.6" ry="3" fill={ink} />
      ) : (
        <path className="gem-mouth" d={mouth} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      )}
      {(mood === "happy" || mood === "idle") && (
        <g fill="#ff7aa8" opacity={mood === "happy" ? 0.55 : 0.28}>
          <ellipse cx="33" cy={y + 9} rx="4" ry="2.4" />
          <ellipse cx="67" cy={y + 9} rx="4" ry="2.4" />
        </g>
      )}
    </g>
  );
}

/**
 * A living Gem. Argon is the Gemini sparkle; specialists are cut crystals in their
 * own colour. They breathe, blink, glance around, follow the pointer, and while
 * `mood="busy"` they bob with eyes circling, the same motion as Socius's bots.
 */
export function Gem({ argon = false, color = "#3b82f6", size = 48, mood = "idle", name = "argon", title }: { argon?: boolean; color?: string; size?: number; mood?: Mood; name?: string; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const uid = useId().replace(/:/g, "");
  useEffect(() => trackGem(ref.current!), []);
  const h = hash(name);
  const style = {
    width: size,
    height: size,
    "--gem": color,
    "--blink-delay": `${-(h % 5000) / 1000}s`,
    "--blink-time": `${4.2 + ((h >>> 4) % 30) / 10}s`,
    "--idle-delay": `${-((h >>> 9) % 9000) / 1000}s`,
    "--breathe-delay": `${-((h >>> 13) % 4000) / 1000}s`,
  } as CSSProperties;
  return (
    <span ref={ref} className={`gem ${argon ? "argon" : ""} mood-${mood}`} data-idle={["orbit", "glance", "wander"][(h >>> 3) % 3]} style={style} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <span className="gem-lean">
        <span className="gem-breathe">
          <svg viewBox="0 0 100 100" width={size} height={size}>
            <defs>
              {argon ? (
                <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#4f8df7" />
                  <stop offset=".45" stopColor="#8f6fe0" />
                  <stop offset=".8" stopColor="#d96f9a" />
                  <stop offset="1" stopColor="#f2a65a" />
                </linearGradient>
              ) : (
                <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity=".85" />
                  <stop offset="1" stopColor={color} />
                </linearGradient>
              )}
              <clipPath id={`c${uid}`}>
                <path d={argon ? SPARKLE : CUT} />
              </clipPath>
            </defs>
            {argon ? (
              <>
                <path d={SPARKLE} fill={`url(#g${uid})`} />
                <path d={SPARKLE_LIGHT} fill="#fff" opacity=".28" />
                <path d={SPARKLE_LIGHT2} fill="#fff" opacity=".12" />
                <path d={SPARKLE_SHADE} fill="#1b0f3a" opacity=".14" />
              </>
            ) : (
              <>
                <path d={CUT} fill={`url(#g${uid})`} />
                <path d={CUT_CROWN} fill="#fff" opacity=".26" />
                <path d={CUT_LINES} fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="1.2" strokeLinejoin="round" />
              </>
            )}
            <g clipPath={`url(#c${uid})`}>
              <rect className="gem-shine" x="-60" y="-10" width="26" height="130" fill="#fff" opacity=".35" transform="rotate(20)" />
            </g>
            <g className="gem-eyes">
              <Face mood={mood} argon={argon} />
            </g>
          </svg>
        </span>
      </span>
    </span>
  );
}
