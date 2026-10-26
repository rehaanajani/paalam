import { useEffect, useState } from "react";
import { api } from "../api";
import { Play } from "lucide-react";
import { Gem } from "../components/Gem";
import { Constellation } from "../components/Constellation";
import { Composer } from "../components/Composer";
import { ChatFrame, type Send } from "./Thread";
import type { GemDef, Status } from "../types";
import type { Mission } from "../../server/mission";

/** Argon's tab: the orchestrator. Anything sent here becomes a new Bridge. */
export function ArgonHome({
  gems,
  status,
  busy,
  onSend,
  onSample,
  onOpenGem,
}: {
  gems: GemDef[];
  status: Status | null;
  busy: boolean;
  onSend: Send;
  onSample: () => void;
  onOpenGem: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // The wording comes from the mission (Settings → Mission), so a pivot needs no code change.
  const [mission, setMission] = useState<Mission | null>(null);
  useEffect(
    () =>
      void api<Mission>("mission")
        .then(setMission)
        .catch(() => {}),
    [gems],
  );
  const picked = gems.find((g) => g.id === hover);
  const size = Math.max(240, Math.min(380, window.innerWidth - 48));
  return (
    <ChatFrame
      pill={
        <span className="bot-pill">
          <Gem argon size={26} name="argon-pill" /> Argon
        </span>
      }
      composer={
        <Composer
          busy={busy}
          onSend={onSend}
          placeholder="Message Argon: paste, talk, or drop photos and documents"
        />
      }
    >
      <div className="welcome">
        <div onMouseLeave={() => setHover(null)}>
          <Constellation
            gems={gems}
            size={size}
            onPick={onOpenGem}
            active={hover ? [hover] : []}
            labels
          />
        </div>
        <h1>
          {mission?.headline ?? "Send anything."}{" "}
          <span className="grad">
            {mission?.headlineAccent ?? "Get verified action."}
          </span>
        </h1>
        {mission?.welcome && <p>{mission.welcome}</p>}
        {picked && (
          <p className="picked-line">
            {picked.name}: {picked.purpose}
          </p>
        )}
        <div className="suggestions">
          {mission?.showDemo && (
            <button
              type="button"
              className="suggest-demo"
              onClick={onSample}
              disabled={busy}
            >
              <Play size={15} />
              <span>
                <b>Try the demo:</b> a Chennai family's flood-night WhatsApp
                (flood + insulin without power + a relief scam, all at once)
              </span>
            </button>
          )}
          {status?.demo
            ? null
            : (mission?.suggestions ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s, [])}
                  disabled={busy}
                >
                  {s}
                </button>
              ))}
        </div>
      </div>
    </ChatFrame>
  );
}
