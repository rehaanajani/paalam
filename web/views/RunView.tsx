import type { CSSProperties } from "react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { Activity, Check, ChevronDown, FileText, Image as ImageIcon, Loader2, MessageSquareText, Music, Sparkles, Wrench } from "lucide-react";
import { api } from "../api";
import { Gem, type Mood } from "../components/Gem";
import { Constellation } from "../components/Constellation";
import { FactTable } from "../components/FactTable";
import { ActionCard } from "../components/ActionCard";
import { MapView } from "../components/MapView";
import type { ActionCard as Card, AuditEntry, Fragment, GemDef, GemResult, Run, RunEvent, Stage, Status, ToolCall } from "../types";

interface Live {
  run: Run | null;
  stage: Stage;
  fragments: Fragment[];
  tools: Record<string, ToolCall[]>;
  results: GemResult[];
  audit: AuditEntry[];
  error?: string;
}

const init: Live = { run: null, stage: "intake", fragments: [], tools: {}, results: [], audit: [] };

function reduce(s: Live, e: RunEvent | { type: "load"; data: Run } | { type: "card"; data: Card }): Live {
  switch (e.type) {
    case "load":
      return { ...s, run: e.data, stage: e.data.stage, audit: s.audit.length ? s.audit : e.data.audit };
    case "stage":
      return { ...s, stage: e.stage! };
    case "fragment": {
      const f = e.data as Fragment & { newGem?: GemDef };
      if (f.newGem) return s;
      return s.fragments.some((x) => x.id === f.id) ? s : { ...s, fragments: [...s.fragments, f] };
    }
    case "tool":
      return { ...s, tools: { ...s.tools, [e.gemId!]: [...(s.tools[e.gemId!] ?? []), e.data as ToolCall] } };
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
    case "card":
      return { ...s, results: s.results.map((r) => ({ ...r, actions: r.actions.map((a) => (a.id === e.data.id ? e.data : a)) })) };
  }
  return s;
}

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "intake", label: "Intake", hint: "Reading voice, photos, documents" },
  { id: "split", label: "Split", hint: "Argon separates the problems" },
  { id: "gems", label: "Gems", hint: "Specialists call their tools" },
  { id: "verify", label: "Verify", hint: "Trust layer checks every claim" },
  { id: "actions", label: "Act", hint: "You approve what happens" },
];
const order: Stage[] = ["intake", "split", "gems", "verify", "actions", "done"];
const urgencyRank = { critical: 0, high: 1, medium: 2, low: 3 };

export function RunView({ runId, gems, status, onGemsChanged, onDone }: { runId: string; gems: GemDef[]; status: Status | null; onGemsChanged: () => void; onDone: () => void }) {
  const [s, dispatch] = useReducer(reduce, init);
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let closed = false;
    api<Run>(`runs/${runId}`).then((r) => !closed && dispatch({ type: "load", data: r }));
    const es = new EventSource(`/api/runs/${runId}/events`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as RunEvent;
      dispatch(e);
      if (e.type === "fragment" && (e.data as any)?.newGem) onGemsChanged();
      if (e.type === "done" || e.type === "error") {
        es.close();
        onDone();
      }
    };
    return () => {
      closed = true;
      es.close();
    };
  }, [runId]);

  const gemOf = (id: string) => gems.find((g) => g.id === id);
  const at = order.indexOf(s.stage);
  const working = s.stage !== "done" && s.stage !== "error";
  const activeGems = [...new Set(s.fragments.map((f) => f.gemId))];
  const moods: Record<string, Mood> = {};
  for (const id of activeGems) moods[id] = s.results.some((r) => r.gemId === id) ? "happy" : s.stage === "gems" ? "busy" : "idle";
  const argonMood: Mood = s.stage === "error" ? "worried" : s.stage === "done" ? "happy" : s.stage === "split" || s.stage === "intake" ? "busy" : "idle";

  const fragmentOf = (id: string) => s.fragments.find((f) => f.id === id);
  const actions = useMemo(
    () =>
      s.results
        .flatMap((r) => r.actions.map((a) => ({ a, urgency: fragmentOf(r.fragmentId)?.urgency ?? "low", tools: r.tools })))
        .sort((x, y) => urgencyRank[x.urgency] - urgencyRank[y.urgency] || x.a.priority - y.a.priority),
    [s.results, s.fragments],
  );
  const awaiting = actions.filter((x) => x.a.status === "awaiting").length;
  const evidence = s.run?.input.evidence ?? [];
  const facts = s.results.flatMap((r) => r.facts);
  const verified = facts.filter((f) => f.verification === "verified").length;
  const unknown = facts.filter((f) => f.status === "unknown").length;
  const conflicts = facts.filter((f) => f.verification === "conflict").length;

  return (
    <div className="run">
      {/* Stage: Argon and the Gems it woke up */}
      <section className="run-stage">
        <Constellation gems={gems} size={250} argonMood={argonMood} moods={moods} active={activeGems} labels={false} />
        <div className="run-headline">
          {s.run?.demo && <span className="demo-pill">DEMO · scripted Gemini, real tools</span>}
          <h1>{s.run?.headline ?? (s.stage === "error" ? "Something went wrong" : "Reading everything you sent…")}</h1>
          {s.run?.language && <p className="muted">Language detected: {s.run.language}</p>}
          <ol className="pipeline">
            {STAGES.map((st) => {
              const i = order.indexOf(st.id);
              const state = s.stage === "error" && i >= at ? "err" : i < at || s.stage === "done" ? "done" : i === at ? "now" : "todo";
              return (
                <li key={st.id} className={state} title={st.hint}>
                  <span className="dot">{state === "done" ? <Check size={12} /> : state === "now" ? <Loader2 size={12} className="spin" /> : null}</span>
                  {st.label}
                </li>
              );
            })}
          </ol>
          {s.error && <div className="err">{s.error}</div>}
          {s.stage === "done" && (
            <div className="scoreline">
              <span>
                <b>{s.fragments.length}</b> problems found
              </span>
              <span>
                <b>{verified}</b>/{facts.length} facts verified
              </span>
              {conflicts > 0 && (
                <span className="warn">
                  <b>{conflicts}</b> conflict{conflicts > 1 ? "s" : ""}
                </span>
              )}
              <span>
                <b>{unknown}</b> unknowns to ask
              </span>
              <span>
                <b>{awaiting}</b> actions to approve
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="run-grid">
        {/* Left: the chaos that came in */}
        <section className="panel chaos">
          <h2>
            <MessageSquareText size={15} /> What came in
          </h2>
          {s.run?.input.text && <pre className="raw">{s.run.input.text}</pre>}
          <div className="evidence">
            {evidence.map((e) => (
              <div key={e.id} className="ev-item" title={e.text ?? e.name}>
                <span className="src ev">{e.id}</span>
                {e.kind === "image" ? <ImageIcon size={14} /> : e.kind === "audio" ? <Music size={14} /> : <FileText size={14} />}
                <span className="ev-name">{e.name}</span>
                {e.text && <p className="ev-text">{e.text}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Centre: what each Gem found */}
        <section className="findings">
          {s.fragments.length === 0 && working && (
            <div className="panel placeholder">
              <Sparkles size={16} /> Argon is separating the problems…
            </div>
          )}
          {[...s.fragments]
            .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency])
            .map((f) => {
              const g = gemOf(f.gemId);
              const r = s.results.find((x) => x.fragmentId === f.id);
              const calls = r?.tools ?? s.tools[f.gemId] ?? [];
              return (
                <article key={f.id} className={`panel fragment u-${f.urgency}`} style={{ "--gem": g?.color } as CSSProperties}>
                  <header>
                    <Gem color={g?.color} size={40} name={f.gemId} mood={r ? (f.urgency === "critical" ? "worried" : "happy") : "busy"} />
                    <div>
                      <div className="frag-gem">
                        {g?.name ?? f.gemId} <span className={`urgency u-${f.urgency}`}>{f.urgency}</span>
                        {g?.origin === "auto" && <span className="auto-pill">built by Argon</span>}
                      </div>
                      <h3>{f.title}</h3>
                    </div>
                  </header>
                  <p className="frag-summary">{r?.summary ?? f.summary}</p>
                  {r ? <FactTable facts={r.facts} tools={r.tools} evidence={evidence} /> : <div className="working">Working… {calls.length} tool call(s) so far</div>}
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
                </article>
              );
            })}
        </section>

        {/* Right: map + the approval queue */}
        <section className="act-col">
          <div className="panel map-panel">
            <MapView results={s.results} gems={gems} center={s.run?.input.near ?? status?.city ?? { lat: 13.08, lng: 80.27 }} />
          </div>
          <div className="queue">
            <h2>
              Actions <span className="count">{awaiting} waiting</span>
            </h2>
            {actions.length === 0 && <div className="panel placeholder">{working ? "Actions appear here once they're verified." : "No actions proposed."}</div>}
            {actions.map(({ a, tools }) => (
              <ActionCard key={a.id} runId={runId} card={a} gem={gemOf(a.gemId)} tools={tools} onChange={(c) => dispatch({ type: "card", data: c })} />
            ))}
          </div>
        </section>
      </div>

      {/* Bottom: the audit trail and what it cost */}
      <section className="panel audit">
        <h2>
          <Activity size={15} /> Audit trail
          {s.run && !s.run.demo && s.run.usage && (
            <span className="usage">
              {s.run.usage.total.toLocaleString()} tokens · {s.run.usage.calls} calls · budget {s.run.usage.budget.toLocaleString()}
            </span>
          )}
        </h2>
        <ol>
          {s.audit.map((a, i) => (
            <li key={i} className={`who-${a.who.split(":")[0]}`}>
              <time>{new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <b>{a.who === "argon" ? "Argon" : a.who === "trust" ? "Trust layer" : a.who === "harness" ? "Harness" : a.who === "you" ? "You" : (gemOf(a.who)?.name ?? a.who)}</b>
              <span>{a.what}</span>
            </li>
          ))}
        </ol>
        {s.run?.usage && s.run.usage.steps.length > 0 && (
          <details className="usage-steps">
            <summary>Token usage by step</summary>
            <table>
              <tbody>
                {s.run.usage.steps.map((u, i) => (
                  <tr key={i}>
                    <td>{u.step}</td>
                    <td>{u.model}</td>
                    <td>{u.input.toLocaleString()} in</td>
                    <td>{u.output.toLocaleString()} out</td>
                    <td>{u.thinking.toLocaleString()} thinking</td>
                    <td>{u.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
    </div>
  );
}
