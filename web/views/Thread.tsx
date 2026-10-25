import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import { Composer } from "../components/Composer";
import { RunBlock } from "../components/RunBlock";
import type { GemDef, Run, Status } from "../types";

export type Send = (text: string, files: File[], near?: { lat: number; lng: number }) => Promise<void>;

/** Socius's chat frame: a floating title pill, a centred thread, the composer pinned at the bottom. */
export function ChatFrame({ pill, children, composer, scrollKey }: { pill: ReactNode; children: ReactNode; composer: ReactNode; scrollKey?: unknown }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollKey]);
  return (
    <div className="chat">
      <header className="chat-head">
        <div className="bot-pill-wrap">{pill}</div>
      </header>
      <div className="chat-scroll" ref={scroller}>
        <div className="thread">{children}</div>
      </div>
      <div className="composer-wrap">{composer}</div>
    </div>
  );
}

/** A Bridge: every run sent into one conversation, each drawn as you → Argon → Gems → actions. */
export function Thread({ threadId, gems, status, pill, placeholder, onSend, onChanged, onNew, newLabel = "Start a new bridge", composerExtra }: { threadId: string; gems: GemDef[]; status: Status | null; pill: ReactNode; placeholder: string; onSend: Send; onChanged: () => void; onNew?: () => void; newLabel?: string; composerExtra?: ReactNode }) {
  const [runs, setRuns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => api<Run[]>(`threads/${threadId}`).then((list) => setRuns(list.map((r) => r.id))).catch(() => setRuns([]));
  useEffect(() => {
    void load();
  }, [threadId]);

  async function send(text: string, files: File[], near?: { lat: number; lng: number }) {
    setBusy(true);
    try {
      await onSend(text, files, near);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChatFrame
      pill={pill}
      scrollKey={runs.length}
      composer={
        <>
          <Composer busy={busy} onSend={send} placeholder={placeholder} extra={composerExtra} />
          {onNew && (
            <button type="button" className="new-thread" onClick={onNew}>
              <Plus size={13} /> {newLabel}
            </button>
          )}
        </>
      }
    >
      {runs.map((id) => (
        <RunBlock key={id} runId={id} gems={gems} center={status?.city ?? { lat: 13.08, lng: 80.27 }} onSettled={onChanged} />
      ))}
    </ChatFrame>
  );
}

export const gemStyle = (g?: GemDef) => ({ "--gem": g?.color }) as CSSProperties;
