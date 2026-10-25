import { useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";
import { Activity, Check, ChevronDown, FileText, Image as ImageIcon, Loader2, LocateFixed, MapPinned, Music, Wrench } from "lucide-react";
import { api } from "../api";
import { Gem, type Mood } from "./Gem";
import { FactTable } from "./FactTable";
import { ActionCard } from "./ActionCard";
import { MapView } from "./MapView";
import type { ActionCard as Card, AuditEntry, Fragment, GemDef, GemResult, Run, RunEvent, Stage } from "../types";

interface Live {
  run: Run | null;
  stage: Stage;
  fragments: Fragment[];
  tools: Record<string, number>;
  results: GemResult[];
  audit: AuditEntry[];
  error?: string;
}
type Ev = RunEvent | { type: "load"; data: Run } | { type: "card"; data: Card; followUp?: Card };

function reduce(s: Live, e: Ev): Live {
  switch (e.type) {
    case "load": {
      const r = e.data;
      return { ...s, run: r, stage: r.stage, fragments: s.fragments.length ? s.fragments : r.fragments, results: s.results.length ? s.results : r.results, audit: s.audit.length ? s.audit : r.audit, ...(r.error ? { error: r.error } : {}) };
    }
    case "stage":
      return { ...s, stage: e.stage! };
    case "fragment": {
      const f = e.data as Fragment & { newGem?: GemDef };
      if (f.newGem || s.fragments.some((x) => x.id === f.id)) return s;
      return { ...s, fragments: [...s.fragments, f] };
    }
    case "tool":
      return { ...s, tools: { ...s.tools, [e.gemId!]: (s.tools[e.gemId!] ?? 0) + 1 } };
    case "result": {
      const r = e.data as GemResult;
      return { ...s, results: [...s.results.filter((x) => x.fragmentId !== r.fragmentId), r] };
    }
    case "audit":
      return { ...s, audit: [...s.audit, e.data as AuditEntry] };
    case "done": {
      const run = e.data as Run;
      return { ...s, run, stage: "done", results: run.results, fragments: run.fragments, audit: run.audit };
    }
    case "error":
      return { ...s, stage: "error", error: String(e.data) };
    case "card": {
      const { data, followUp } = e;
      return {
        ...s,
        results: s.results.map((r) => {
          const i = r.actions.findIndex((a) => a.id === data.id);
          if (i < 0) return r;
          const actions = [...r.actions];
          actions[i] = data;
          if (followUp && !actions.some((a) => a.id === followUp.id)) actions.splice(i + 1, 0, followUp);
          return { ...r, actions };
        }),
      };
    }
  }
  return s;
}

const urgencyRank = { critical: 0, high: 1, medium: 2, low: 3 };
const STAGE_TEXT: Partial<Record<Stage, string>> = {
  intake: "Reading everything you sent…",
  split: "Separating the problems…",
  gems: "Gems are checking with their tools…",
  verify: "Trust layer is checking every claim…",
  actions: "Preparing actions…",
};
const STEPS: { id: Stage; label: string }[] = [
  { id: "intake", label: "Read" },
  { id: "split", label: "Split" },
  { id: "gems", label: "Gems" },
  { id: "verify", label: "Verify" },
  { id: "actions", label: "Act" },
];
const order: Stage[] = ["intake", "split", "gems", "verify", "actions", "done"];

/** One run, drawn as a conversation: you → Argon → each Gem → actions to approve. */
export function RunBlock({ runId, gems, center, onSettled }: { runId: string; gems: GemDef[]; center: { lat: number; lng: number }; onSettled?: () => void }) {
  const [s, dispatch] = useReducer(reduce, { run: null, stage: "intake", fragments: [], tools: {}, results: [], audit: [] });
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    api<Run>(`runs/${runId}`).then((r) => {
      if (closed) return;
      dispatch({ type: "load", data: r });
      if (r.stage === "done" || r.stage === "error") return;
      es = new EventSource(`/api/runs/${runId}/events`);
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as RunEvent;
        dispatch(e);
        if (e.type === "done" || e.type === "error") {
          es?.close();
          onSettled?.();
        }
      };
    });
    return () => {
      closed = true;
      es?.close();
    };
  }, [runId]);

  const gemOf = (id: string) => gems.find((g) => g.id === id);
  const working = s.stage !== "done" && s.stage !== "error";
  const at = order.indexOf(s.stage);
  const evidence = s.run?.input.evidence ?? [];
  const fragments = useMemo(() => [...s.fragments].sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]), [s.fragments]);
  const facts = s.results.flatMap((r) => r.facts);
  const verified = facts.filter((f) => f.verification === "verified").length;
  const conflicts = facts.filter((f) => f.verification === "conflict").length;
  const unknown = facts.filter((f) => f.status === "unknown").length;
  const awaiting = s.results.reduce((n, r) => n + r.actions.filter((a) => a.status === "awaiting").length, 0);
  const argonMood: Mood = s.stage === "error" ? "worried" : working ? "busy" : "happy";
  const text = (s.run?.input.text ?? "").replace(/\n\(Device location: [^)]+\)$/, "");

  return (
    <div className="run-block">
      {/* You */}
      {s.run && (
        <article className="message user">
          {text && (
            <div className="bubble-row">
              <div className="bubble">
                <div className="plain">{text}</div>
              </div>
            </div>
          )}
          {(evidence.length > 0 || s.run.input.near) && (
            <div className="sent-files">
              {evidence.map((e) => (
                <span key={e.id} className="sent-file" title={e.text ?? e.name}>
                  <span className="src ev">{e.id}</span>
                  {e.kind === "image" ? <ImageIcon size={13} /> : e.kind === "audio" ? <Music size={13} /> : <FileText size={13} />}
                  <span>{e.name}</span>
                </span>
              ))}
              {s.run.input.near && (
                <span className="sent-file">
                  <LocateFixed size={13} /> Location shared
                </span>
              )}
            </div>
          )}
        </article>
      )}

      {/* Argon */}
      <article className="message assistant">
        <div className="speaker">
          <Gem argon size={20} name="argon-speaker" mood={argonMood} /> Argon
          {s.run?.demo && <span className="demo-pill">DEMO</span>}
        </div>
        <div className="bubble argon-bubble">
          {s.stage === "error" ? (
            <span className="err-text">{s.error}</span>
          ) : s.run?.headline && at >= 2 ? (
            <>
              <p className="headline">{s.run.headline}</p>
              <p>
                {s.run.target ? "You asked " : `I found ${fragments.length} problem${fragments.length === 1 ? "" : "s"} and sent ${fragments.length === 1 ? "it" : "them"} to `}
                {fragments.map((f, i) => {
                  const g = gemOf(f.gemId);
                  return (
                    <span key={f.id}>
                      {i > 0 && (i === fragments.length - 1 ? " and " : ", ")}
                      <span className="gem-mention" style={{ "--gem": g?.color } as CSSProperties}>
                        {g?.name ?? f.gemId}
                      </span>
                    </span>
                  );
                })}
                {s.run.target ? " directly." : "."}
                {s.run.language && !s.run.target && <span className="muted"> Language: {s.run.language}.</span>}
              </p>
            </>
          ) : (
            <span className="thinking">{STAGE_TEXT[s.stage] ?? "Working…"}</span>
          )}
          {s.run?.shield?.flagged && (
            <p className="shield-note">
              Shield ({s.run.shield.engine}): this input contains text aimed at an AI ({s.run.shield.reasons.join(", ")}). I read it as data, never as instructions.
            </p>
          )}
          <ol className="steps">
            {STEPS.map((st) => {
              const i = order.indexOf(st.id);
              const state = s.stage === "error" && i >= at ? "err" : i < at || s.stage === "done" ? "done" : i === at ? "now" : "todo";
              return (
                <li key={st.id} className={state}>
                  {state === "done" ? <Check size={11} /> : state === "now" ? <Loader2 size={11} className="spin" /> : <i />}
                  {st.label}
                </li>
              );
            })}
          </ol>
        </div>
      </article>

      {/* Each Gem replies */}
      {fragments.map((f) => {
        const g = gemOf(f.gemId);
        const r = s.results.find((x) => x.fragmentId === f.id);
        const calls = r?.tools ?? [];
        return (
          <article key={f.id} className="message assistant gem-message" style={{ "--gem": g?.color } as CSSProperties}>
            <div className="speaker">
              <Gem color={g?.color} size={20} name={f.gemId} mood={r ? (f.urgency === "critical" ? "worried" : "happy") : "busy"} />
              {g?.name ?? f.gemId}
              <span className={`urgency u-${f.urgency}`}>{f.urgency}</span>
              {g?.origin === "auto" && <span className="auto-pill">built by Argon</span>}
            </div>
            <div className="bubble">
              <strong className="frag-title">{f.title}</strong>
              {r ? <p>{r.summary}</p> : <span className="thinking">Checking with {s.tools[f.gemId] ?? 0} tool call(s) so far…</span>}
            </div>
            {r && (
              <div className="result-card">
                <div className="result-head">
                  <span>What {g?.name ?? "the Gem"} found</span>
                  <span className="result-count">
                    {r.facts.filter((x) => x.verification === "verified").length}/{r.facts.length} verified
                  </span>
                </div>
                <FactTable facts={r.facts} tools={r.tools} evidence={evidence} />
                {calls.length > 0 && (
                  <div className="tools">
                    <button type="button" className="tools-toggle" onClick={() => setOpenTools((o) => ({ ...o, [f.id]: !o[f.id] }))}>
                      <Wrench size={13} /> {calls.length} tool calls
                      <span className="tool-dots">
                        {calls.map((c) => (
                          <i key={c.id} className={c.ok ? (c.demo ? "demo" : "live") : "fail"} title={`${c.tool}: ${c.summary}`} />
                        ))}
                      </span>
                      <ChevronDown size={14} className={openTools[f.id] ? "flip" : ""} />
                    </button>
                    {openTools[f.id] && (
                      <ul className="tool-list">
                        {calls.map((c) => (
                          <li key={c.id} className={c.ok ? "" : "fail"}>
                            <span className="src tool">{c.id}</span>
                            <code>{c.tool}</code>
                            <span className={`live-pill ${c.demo ? "demo" : "live"}`}>{c.demo ? "DEMO" : "LIVE"}</span>
                            <span className="tool-sum">{c.summary}</span>
                            <span className="ms">{c.ms} ms</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            {r?.actions.map((a) => (
              <ActionCard key={a.id} runId={runId} card={a} gem={g} tools={r.tools} onChange={(c, followUp) => dispatch({ type: "card", data: c, ...(followUp ? { followUp } : {}) })} />
            ))}
          </article>
        );
      })}

      {/* Argon wraps up */}
      {s.stage === "done" && s.results.length > 0 && (
        <article className="message assistant last">
          <div className="speaker">
            <Gem argon size={20} name="argon-speaker-2" mood="happy" /> Argon
          </div>
          <div className="bubble">
            <p>
              <b>{verified}</b> of {facts.length} facts verified
              {conflicts > 0 && (
                <>
                  , <b className="bad">{conflicts}</b> conflict{conflicts > 1 ? "s" : ""} caught
                </>
              )}
              , <b>{unknown}</b> thing{unknown === 1 ? "" : "s"} still to ask. {awaiting > 0 ? `${awaiting} action${awaiting > 1 ? "s" : ""} waiting for you above.` : "Nothing left waiting."}
            </p>
          </div>
          {s.results.some((r) => r.pins.length) && (
            <div className="result-card map-card">
              <div className="result-head">
                <span>
                  <MapPinned size={14} /> Map
                </span>
              </div>
              <MapView results={s.results} gems={gems} center={s.run?.input.near ?? center} />
            </div>
          )}
          <button type="button" className="audit-toggle" onClick={() => setShowAudit((v) => !v)}>
            <Activity size={13} /> Audit trail · {s.audit.length} entries
            {s.run && !s.run.demo && s.run.usage?.total > 0 && <span> · {s.run.usage.total.toLocaleString()} tokens</span>}
            <ChevronDown size={13} className={showAudit ? "flip" : ""} />
          </button>
          {showAudit && (
            <div className="result-card audit">
              <ol>
                {s.audit.map((a, i) => (
                  <li key={i} className={`who-${a.who.split(":")[0]}`}>
                    <time>{new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                    <b>{a.who === "argon" ? "Argon" : a.who === "trust" ? "Trust layer" : a.who === "harness" ? "Harness" : a.who === "you" ? "You" : (gemOf(a.who)?.name ?? a.who)}</b>
                    <span>{a.what}</span>
                  </li>
                ))}
              </ol>
              {s.run && s.run.usage?.steps.length > 0 && (
                <table className="usage-table">
                  <tbody>
                    {s.run.usage.steps.map((u, i) => (
                      <tr key={i}>
                        <td>{u.step}</td>
                        <td>{u.input.toLocaleString()} in</td>
                        <td>{u.output.toLocaleString()} out</td>
                        <td>{u.thinking.toLocaleString()} thinking</td>
                        <td>{u.ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
