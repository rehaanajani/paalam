import { useEffect, useState } from "react";
import { BookOpen, Gauge, NotebookPen, RotateCcw, X } from "lucide-react";
import { api } from "../api";
import type { GemDef } from "../types";

type HarnessState = {
  playbooks: { argon: string; gem: string };
  notes: Record<string, { text: string; addedAt: string; runId: string }[]>;
  budget: { perRun: number; downshiftChars: number; toolDataChars: number; argon: { thinking: number; maxOutput: number; media: string }; gem: { thinking: number; maxOutput: number; media: string } };
};

/** The playbooks models start from, the budget they run under, and the notes they've written for themselves. */
export function Harness({ gems }: { gems: GemDef[] }) {
  const [h, setH] = useState<HarnessState | null>(null);
  const [tab, setTab] = useState<"argon" | "gem">("argon");
  const load = () => api<HarnessState>("harness").then(setH);
  useEffect(() => void load(), []);
  if (!h) return null;
  const label = (agent: string) => (agent === "argon" ? "Argon" : agent === "gems" ? "All Gems" : (gems.find((g) => `gem:${g.id}` === agent)?.name ?? agent));
  const noteCount = Object.values(h.notes).reduce((n, l) => n + l.length, 0);

  return (
    <div className="harness">
      <header className="page-head">
        <h1>Harness</h1>
        <p className="muted">
          Every model call starts from a playbook and runs under a token budget. It isn't a cage: models can write short rules into their own playbook as they learn, and the trust layer refuses any note that tries to weaken
          verification, approval or redaction.
        </p>
      </header>

      <div className="harness-grid">
        <section className="panel">
          <h2>
            <Gauge size={16} /> Token budget
          </h2>
          <dl className="budget">
            <div>
              <dt>Per run, all calls</dt>
              <dd>{h.budget.perRun.toLocaleString()} tokens</dd>
            </div>
            <div>
              <dt>Argon</dt>
              <dd>
                thinking {h.budget.argon.thinking} · output ≤ {h.budget.argon.maxOutput} · images {h.budget.argon.media.replace("MEDIA_RESOLUTION_", "").toLowerCase()}
              </dd>
            </div>
            <div>
              <dt>Gems</dt>
              <dd>
                thinking {h.budget.gem.thinking} · output ≤ {h.budget.gem.maxOutput} · images {h.budget.gem.media.replace("MEDIA_RESOLUTION_", "").toLowerCase()}
              </dd>
            </div>
            <div>
              <dt>Routing downshift</dt>
              <dd>Text-only input under {h.budget.downshiftChars} chars is routed by the fast model</dd>
            </div>
            <div>
              <dt>Tool results</dt>
              <dd>Trimmed to {h.budget.toolDataChars} chars each before going back to a Gem</dd>
            </div>
            <div>
              <dt>Second pass</dt>
              <dd>Text only: photos and audio are read once, in pass 1</dd>
            </div>
          </dl>
          <p className="muted small">Change these with env vars (RUN_TOKEN_BUDGET, ARGON_THINKING_BUDGET, GEM_THINKING_BUDGET, …). See .env.example.</p>
        </section>

        <section className="panel">
          <h2>
            <NotebookPen size={16} /> Notes the models wrote ({noteCount})
            {noteCount > 0 && (
              <button
                type="button"
                className="ghost small-btn"
                onClick={async () => {
                  await api("harness/notes", { method: "DELETE" });
                  load();
                }}
              >
                <RotateCcw size={13} /> Reset all
              </button>
            )}
          </h2>
          {noteCount === 0 && <p className="muted">None yet. After live runs, Argon and the Gems can add one short rule each time they learn something, up to 8 per agent.</p>}
          {Object.entries(h.notes).map(([agent, list]) =>
            list.length ? (
              <div key={agent} className="note-group">
                <h3>{label(agent)}</h3>
                <ul>
                  {list.map((n, i) => (
                    <li key={i}>
                      <span>{n.text}</span>
                      <time>{new Date(n.addedAt).toLocaleString()}</time>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Remove note"
                        onClick={async () => {
                          await api(`harness/notes/${encodeURIComponent(agent)}/${i}`, { method: "DELETE" });
                          load();
                        }}
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      </div>

      <section className="panel">
        <h2>
          <BookOpen size={16} /> Playbooks
          <span className="tabs">
            <button type="button" className={tab === "argon" ? "on" : ""} onClick={() => setTab("argon")}>
              Argon
            </button>
            <button type="button" className={tab === "gem" ? "on" : ""} onClick={() => setTab("gem")}>
              Every Gem
            </button>
          </span>
        </h2>
        <p className="muted small">Edit server/harness/{tab}.md. Changes apply on the next run, no restart.</p>
        <pre className="playbook">{h.playbooks[tab]}</pre>
      </section>
    </div>
  );
}
