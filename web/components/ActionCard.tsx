import type { CSSProperties } from "react";
import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, BellRing, Check, Download, Globe, Image as ImageIcon, MessageSquare, MousePointerClick, Navigation, Phone, Send, Share2, ShieldAlert, Volume2, X } from "lucide-react";
import { api, runClient } from "../api";
import { Gem } from "./Gem";
import type { ActionCard as Card, GemDef, ToolCall } from "../types";

const icons = { navigate: Navigation, call: Phone, sms: MessageSquare, share: Share2, alert: BellRing, readback: Volume2, request: Send, warn: ShieldAlert, browser_fill: Globe, browser_submit: MousePointerClick, poster: ImageIcon };

/**
 * One proposed action, asked as a question with lettered answers like Socius's
 * approval cards. Approval covers exactly what's shown; nothing runs without it.
 */
export function ActionCard({ runId, card, gem, tools, onChange }: { runId: string; card: Card; gem?: GemDef; tools: ToolCall[]; onChange: (c: Card, followUp?: Card) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const Icon = icons[card.kind] ?? Send;

  async function decide(approve: boolean) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ action: Card; client?: Parameters<typeof runClient>[0]; followUp?: Card }>(`runs/${runId}/actions/${card.id}`, { json: { approve } });
      onChange(r.action, r.followUp);
      if (approve) await runClient(r.client);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (busy || card.status !== "awaiting" || e.target !== e.currentTarget || e.metaKey || e.ctrlKey) return;
    if (e.key.toLowerCase() === "a") void decide(true);
    if (e.key.toLowerCase() === "b") void decide(false);
  }

  const cite = (id: string) => {
    const t = tools.find((x) => x.id === id);
    return t ? `${t.tool}: ${t.summary}` : id;
  };

  return (
    <div className={`action-card status-${card.status}`} tabIndex={0} onKeyDown={keys} style={{ "--gem": gem?.color } as CSSProperties} aria-label={`${card.title}. Needs your approval`}>
      <div className="action-head">
        <span className="action-icon">
          <Icon size={16} />
        </span>
        <strong>{card.title}</strong>
        {gem && (
          <span className="action-gem" title={gem.name}>
            <Gem color={gem.color} size={20} name={gem.id} mood={card.status === "done" ? "happy" : "idle"} />
          </span>
        )}
      </div>
      <p className="action-detail">{card.detail}</p>
      <div className="action-effect">
        <span>If you approve</span>
        {card.effect}
        {card.kind === "browser_fill" && Array.isArray(card.payload.steps) && (
          <>
            <code className="fill-url">{String(card.payload.url ?? "")}</code>
            <dl className="fill-steps">
              {(card.payload.steps as { field: string; value: string }[]).map((st) => (
                <div key={st.field}>
                  <dt>{st.field}</dt>
                  <dd>{st.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {card.unresolved.length > 0 && (
        <ul className="unresolved">
          {card.unresolved.map((u) => (
            <li key={u}>
              <AlertTriangle size={13} /> {u}
            </li>
          ))}
        </ul>
      )}
      {card.evidence.filter(Boolean).length > 0 && (
        <div className="sources">
          {card.evidence.filter(Boolean).map((s) => (
            <span key={s} className={`src ${s.startsWith("T") ? "tool" : "ev"}`} title={cite(s)}>
              {s}
            </span>
          ))}
        </div>
      )}
      {card.status === "awaiting" ? (
        <div className="decision-options">
          <button type="button" disabled={busy} onClick={() => decide(true)}>
            <kbd>A</kbd> Approve
          </button>
          <button type="button" disabled={busy} onClick={() => decide(false)}>
            <kbd>B</kbd> Not now
          </button>
        </div>
      ) : (
        <div className={`action-outcome ${card.status}`}>
          {card.status === "declined" ? <X size={14} /> : <Check size={14} />}
          {card.status === "declined" ? "Skipped" : card.result}
        </div>
      )}
      {card.shotId && card.kind === "poster" ? (
        <div className="poster">
          <img src={`/api/shots/${card.shotId}`} alt={card.title} />
          <div className="poster-actions">
            <a className="ghost small-btn" href={`/api/shots/${card.shotId}`} download={`paalam-poster-${card.shotId}`}>
              <Download size={13} /> Download
            </a>
            {"share" in navigator && (
              <button
                type="button"
                className="ghost small-btn"
                onClick={async () => {
                  const blob = await fetch(`/api/shots/${card.shotId}`).then((r) => r.blob());
                  const file = new File([blob], `paalam-poster.${blob.type.includes("svg") ? "svg" : blob.type.split("/")[1] ?? "png"}`, { type: blob.type });
                  await navigator.share({ files: [file], title: card.title }).catch(() => {});
                }}
              >
                <Share2 size={13} /> Share
              </button>
            )}
          </div>
        </div>
      ) : card.shotId ? (
        <a className="shot" href={`/api/shots/${card.shotId}`} target="_blank" rel="noreferrer" title="Open the full screenshot">
          <img src={`/api/shots/${card.shotId}`} alt={`Screenshot after: ${card.title}`} loading="lazy" />
        </a>
      ) : null}
      {err && <div className="err">{err}</div>}
    </div>
  );
}
