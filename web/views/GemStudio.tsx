import { useState, type CSSProperties } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Gem } from "../components/Gem";
import type { GemDef, ToolInfo } from "../types";

type Draft = { id: string; name: string; purpose: string; instructions: string; tools: string[]; color: string; model: "gem" | "argon" };
const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
const empty: Draft = { id: "", name: "", purpose: "", instructions: "", tools: [], color: "#8b5cf6", model: "gem" };
const examples = ["Missing elderly person with dementia", "Heatwave protection for delivery workers", "Snake bite in a village", "Gas cylinder leak at home"];

/** Every Gem = instructions + model + allowed tools. Describe one and Argon designs it in seconds. */
export function GemStudio({ gems, tools, onChanged }: { gems: GemDef[]; tools: ToolInfo[]; onChanged: () => void }) {
  const [desc, setDesc] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [demoDraft, setDemoDraft] = useState(false);

  async function ask(text = desc) {
    if (!text.trim()) return;
    setDesc(text);
    setBusy(true);
    setErr("");
    try {
      const d = await api<Omit<Draft, "color" | "model"> & { demo: boolean }>("gems/draft", { json: { description: text } });
      setDemoDraft(d.demo);
      setDraft({ ...empty, ...d, color: colors[gems.length % colors.length]! });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft?.name.trim()) return;
    setBusy(true);
    try {
      await api("gems", { json: draft });
      setDraft(null);
      setDesc("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups = [...new Set(tools.map((t) => t.group))];

  return (
    <div className="studio">
      <header className="page-head">
        <h1>Gem Studio</h1>
        <p className="muted">A Gem is four things: instructions, a model, the tools it's allowed to use, and what it knows. Argon routes every problem to the right one, and builds a new one when nothing fits.</p>
      </header>

      <section className="panel builder">
        <h2>
          <Plus size={16} /> Describe a new Gem
        </h2>
        <div className="builder-row">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="e.g. Help families find a missing elderly person with dementia" />
          <button type="button" className="primary" onClick={() => ask()} disabled={busy || !desc.trim()}>
            {busy && !draft ? <Loader2 size={16} className="spin" /> : <Gem argon size={18} name="studio-argon" />} Let Argon design it
          </button>
        </div>
        <div className="examples">
          {examples.map((x) => (
            <button key={x} type="button" className="chip-btn" onClick={() => ask(x)} disabled={busy}>
              {x}
            </button>
          ))}
          <button type="button" className="chip-btn ghost" onClick={() => setDraft({ ...empty, color: colors[gems.length % colors.length]! })}>
            <Plus size={13} /> Start blank
          </button>
        </div>
        {err && <div className="err">{err}</div>}

        {draft && (
          <div className="draft" style={{ "--gem": draft.color } as CSSProperties}>
            {demoDraft && <span className="demo-pill">DEMO draft: add a Gemini key for Argon to design it</span>}
            <div className="draft-top">
              <Gem color={draft.color} size={72} name={draft.name || "new"} mood="happy" />
              <div className="draft-fields">
                <label>
                  Name
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label>
                  Handles
                  <input value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                </label>
                <div className="swatches">
                  {colors.map((c) => (
                    <button key={c} type="button" aria-label={c} className={c === draft.color ? "on" : ""} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} />
                  ))}
                  <select value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value as Draft["model"] })}>
                    <option value="gem">Fast model</option>
                    <option value="argon">Argon model (slower, smarter)</option>
                  </select>
                </div>
              </div>
            </div>
            <label>
              Instructions
              <textarea rows={5} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </label>
            <div className="tool-picker">
              <span className="label">Allowed tools</span>
              {groups.map((grp) => (
                <div key={grp} className="tool-group">
                  <span className="grp">{grp}</span>
                  {tools
                    .filter((t) => t.group === grp)
                    .map((t) => (
                      <label key={t.id} className={`tool-tick ${draft.tools.includes(t.id) ? "on" : ""}`} title={t.description}>
                        <input type="checkbox" checked={draft.tools.includes(t.id)} onChange={(e) => setDraft({ ...draft, tools: e.target.checked ? [...draft.tools, t.id] : draft.tools.filter((x) => x !== t.id) })} />
                        {t.name}
                        {!t.live && <i>demo</i>}
                      </label>
                    ))}
                </div>
              ))}
            </div>
            <div className="draft-actions">
              <button type="button" className="ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={save} disabled={busy || !draft.name.trim()}>
                Save Gem
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="gem-grid">
        {gems.map((g) => (
          <article key={g.id} className="panel gem-card" style={{ "--gem": g.color } as CSSProperties}>
            <div className="gem-card-top">
              <Gem color={g.color} size={56} name={g.id} />
              <div>
                <h3>{g.name}</h3>
                <span className={`origin o-${g.origin}`}>{g.origin === "starter" ? "Starter" : g.origin === "auto" ? "Built by Argon" : g.origin === "plugin" ? "Plugin" : "Yours"}</span>
              </div>
              {(g.origin === "user" || g.origin === "auto") && (
                <button
                  type="button"
                  className="icon-btn"
                  title="Delete"
                  onClick={async () => {
                    await api(`gems/${g.id}`, { method: "DELETE" });
                    onChanged();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <p className="purpose">{g.purpose}</p>
            <div className="tool-tags">
              {g.tools.map((t) => (
                <span key={t} className="tag">
                  {tools.find((x) => x.id === t)?.name ?? t}
                </span>
              ))}
            </div>
            <details>
              <summary>Instructions</summary>
              <pre>{g.instructions}</pre>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
