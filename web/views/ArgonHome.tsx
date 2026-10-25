import { useState } from "react";
import { Play } from "lucide-react";
import { Gem } from "../components/Gem";
import { Constellation } from "../components/Constellation";
import { Composer } from "../components/Composer";
import { ChatFrame, type Send } from "./Thread";
import type { GemDef, Status } from "../types";

const suggestions = [
  "Our street in Velachery is flooding and my grandfather can't walk. We're on the first floor.",
  "Someone sent this 'PM relief ₹6000' link asking for my bank details and OTP. Is it real?",
  "My mother has these three prescriptions and I don't understand the timings.",
];

/** Argon's tab: the orchestrator. Anything sent here becomes a new Bridge. */
export function ArgonHome({ gems, status, busy, onSend, onSample, onOpenGem }: { gems: GemDef[]; status: Status | null; busy: boolean; onSend: Send; onSample: () => void; onOpenGem: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const picked = gems.find((g) => g.id === hover);
  const size = Math.max(240, Math.min(380, window.innerWidth - 48));
  return (
    <ChatFrame
      pill={
        <span className="bot-pill">
          <Gem argon size={26} name="argon-pill" /> Argon
        </span>
      }
      composer={<Composer busy={busy} onSend={onSend} placeholder="Message Argon: paste, talk, or drop photos and documents" />}
    >
      <div className="welcome">
        <div onMouseLeave={() => setHover(null)}>
          <Constellation gems={gems} size={size} onPick={onOpenGem} active={hover ? [hover] : []} labels />
        </div>
        <h1>
          Send anything. <span className="grad">Get verified action.</span>
        </h1>
        <p>
          I'm Argon, the orchestrator. Send me the whole messy situation: voice notes, photos, forwards, prescriptions, any language. I'll split it into problems, hand each to the right Gem, check every claim, and ask you before anything happens.
        </p>
        {picked && <p className="picked-line">{picked.name}: {picked.purpose}</p>}
        <div className="suggestions">
          <button type="button" className="suggest-demo" onClick={onSample} disabled={busy}>
            <Play size={15} />
            <span>
              <b>Try the demo:</b> a Chennai family's flood-night WhatsApp (flood + insulin without power + a relief scam, all at once)
            </span>
          </button>
          {status?.demo
            ? null
            : suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onSend(s, [])} disabled={busy}>
                  {s}
                </button>
              ))}
        </div>
      </div>
    </ChatFrame>
  );
}
