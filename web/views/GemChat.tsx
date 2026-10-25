import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Gem } from "../components/Gem";
import { Composer } from "../components/Composer";
import { ChatFrame, Thread, gemStyle, type Send } from "./Thread";
import type { GemDef, Status, ToolInfo } from "../types";

/** One Gem's own tab: talk to the specialist directly, skipping Argon's split. */
export function GemChat({ gem, gems, tools, status, threadId, busy, onSend, onChanged, onNew, onEdit }: { gem: GemDef; gems: GemDef[]; tools: ToolInfo[]; status: Status | null; threadId: string | null; busy: boolean; onSend: Send; onChanged: () => void; onNew: () => void; onEdit: () => void }) {
  const [details, setDetails] = useState(false);
  const pill = (
    <div className="pill-group">
      <button type="button" className="bot-pill" style={gemStyle(gem)} onClick={() => setDetails((d) => !d)}>
        <Gem color={gem.color} size={26} name={gem.id} /> {gem.name}
      </button>
      {details && (
        <div className="floating-panel bot-details" style={gemStyle(gem)}>
          <div className="bot-details-head">
            <Gem color={gem.color} size={44} name={gem.id} mood="happy" />
            <div>
              <strong>{gem.name}</strong>
              <small>{gem.origin === "starter" ? "Starter Gem" : gem.origin === "auto" ? "Built by Argon" : gem.origin === "plugin" ? "Plugin Gem" : "Your Gem"} · {gem.model === "argon" ? "Argon model" : "fast model"}</small>
            </div>
          </div>
          <p className="muted small">{gem.purpose}</p>
          <div className="tool-tags">
            {gem.tools.map((t) => (
              <span key={t} className="tag">
                {tools.find((x) => x.id === t)?.name ?? t}
              </span>
            ))}
          </div>
          <button type="button" className="ghost small-btn full" onClick={onEdit}>
            <Settings2 size={13} /> Edit in Settings → Gems
          </button>
        </div>
      )}
    </div>
  );
  const placeholder = `Message ${gem.name}`;

  if (threadId) return <Thread key={threadId} threadId={threadId} gems={gems} status={status} pill={pill} placeholder={placeholder} onSend={onSend} onChanged={onChanged} onNew={onNew} newLabel={`New chat with ${gem.name}`} />;

  return (
    <ChatFrame pill={pill} composer={<Composer busy={busy} onSend={onSend} placeholder={placeholder} />}>
      <div className="welcome" style={gemStyle(gem)}>
        <Gem color={gem.color} size={96} name={gem.id} mood="idle" />
        <h1>{gem.name}</h1>
        <p>{gem.purpose}</p>
        <div className="tool-tags center">
          {gem.tools.map((t) => (
            <span key={t} className="tag">
              {tools.find((x) => x.id === t)?.name ?? t}
            </span>
          ))}
        </div>
        <p className="muted small">Messages here go straight to {gem.name}, skipping Argon's split. Every action still waits for your approval.</p>
      </div>
    </ChatFrame>
  );
}
