import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Target } from "lucide-react";
import { api } from "../api";
import type { Mission as MissionDef } from "../../server/mission";

type Loaded = MissionDef & {
  builtInGems: { id: string; name: string; purpose: string }[];
};
type Draft = {
  id: string;
  name: string;
  purpose: string;
  instructions: string;
  tools: string[];
};

const colors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

/**
 * The problem Paalam is pointed at. Paste a new problem statement here and Argon
 * drafts Gems for it: a pivot without touching the code.
 */
export function Mission({ onChanged }: { onChanged: () => void }) {
  const [m, setM] = useState<Loaded | null>(null);
  const [saved, setSaved] = useState(false);
  const [drafts, setDrafts] = useState<(Draft & { keep: boolean })[]>([]);
  const [busy, setBusy] = useState<"" | "save" | "draft" | "gems">("");
  const [err, setErr] = useState("");
  useEffect(
    () =>
      void api<Loaded>("mission")
        .then(setM)
        .catch((e) => setErr(e.message)),
    [],
  );
  if (!m)
    return (
      <div className="pane">
        {err ? (
          <p className="err">{err}</p>
        ) : (
          <Loader2 className="spin" size={18} />
        )}
      </div>
    );

  const set = (patch: Partial<Loaded>) => {
    setM({ ...m, ...patch });
    setSaved(false);
  };

  async function save() {
    setBusy("save");
    setErr("");
    try {
      const { builtInGems, ...rest } = m!;
      setM({
        ...(await api<MissionDef>("mission", { method: "PUT", json: rest })),
        builtInGems,
      });
      setSaved(true);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    setBusy("save");
    await api<MissionDef>("mission/reset", { json: {} }).then((r) =>
      setM({ ...r, builtInGems: m!.builtInGems }),
    );
    setBusy("");
    onChanged();
  }

  async function draftGems() {
    setBusy("draft");
    setErr("");
    try {
      setDrafts(
        (
          await api<Draft[]>("mission/gems", {
            json: { statement: m!.statement },
          })
        ).map((d) => ({ ...d, keep: true })),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function saveGems() {
    setBusy("gems");
    try {
      const keep = drafts.filter((d) => d.keep);
      for (const [i, d] of keep.entries())
        await api("gems", {
          json: { ...d, color: colors[i % colors.length], model: "gem" },
        });
      setDrafts([]);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const hidden = new Set(m.hiddenGems);
  return (
    <div className="pane mission">
      <h1>Mission</h1>
      <p className="pane-lead">
        The problem Paalam is pointed at. Every Argon and Gem prompt starts from
        this statement, and the home screen shows the wording below. To pivot,
        paste the new statement, save, and let Argon draft Gems for it.
      </p>

      <section className="settings-card">
        <div className="settings-heading">
          <Target size={18} />
          <div>
            <strong>Problem statement</strong>
            <p>Word for word, as the organisers gave it.</p>
          </div>
        </div>
        <textarea
          rows={6}
          value={m.statement}
          onChange={(e) => set({ statement: e.target.value })}
          aria-label="Problem statement"
        />
        <div className="mission-actions">
          <button
            type="button"
            className="primary"
            onClick={draftGems}
            disabled={!m.statement.trim() || !!busy}
          >
            {busy === "draft" ? <Loader2 className="spin" size={15} /> : null}{" "}
            Draft Gems for this statement
          </button>
        </div>
        {drafts.length > 0 && (
          <div className="mission-drafts">
            {drafts.map((d, i) => (
              <label key={d.id + i} className="mission-draft">
                <input
                  type="checkbox"
                  checked={d.keep}
                  onChange={(e) =>
                    setDrafts(
                      drafts.map((x, j) =>
                        j === i ? { ...x, keep: e.target.checked } : x,
                      ),
                    )
                  }
                />
                <span>
                  <b>{d.name}</b> {d.purpose}
                  <small>Tools: {d.tools.join(", ")}</small>
                </span>
              </label>
            ))}
            <button
              type="button"
              className="primary"
              onClick={saveGems}
              disabled={!drafts.some((d) => d.keep) || !!busy}
            >
              {busy === "gems" ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <Check size={15} />
              )}{" "}
              Add the ticked Gems
            </button>
          </div>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-heading">
          <div>
            <strong>Home screen</strong>
            <p>What people see before they send anything.</p>
          </div>
        </div>
        <div className="mission-fields">
          <label>
            Headline
            <input
              value={m.headline}
              onChange={(e) => set({ headline: e.target.value })}
            />
          </label>
          <label>
            Headline, second part (coloured)
            <input
              value={m.headlineAccent}
              onChange={(e) => set({ headlineAccent: e.target.value })}
            />
          </label>
          <label className="wide">
            Argon's introduction
            <textarea
              rows={3}
              value={m.welcome}
              onChange={(e) => set({ welcome: e.target.value })}
            />
          </label>
          <label className="wide">
            Suggested messages, one per line
            <textarea
              rows={4}
              value={m.suggestions.join("\n")}
              onChange={(e) => set({ suggestions: e.target.value.split("\n") })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={m.showDemo}
              onChange={(e) => set({ showDemo: e.target.checked })}
            />{" "}
            Show the flood-night demo button
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-heading">
          <div>
            <strong>Built-in Gems</strong>
            <p>
              Switch off the ones that don't fit this mission. Gems you made
              stay; delete them under Gems.
            </p>
          </div>
        </div>
        <div className="mission-gems">
          {m.builtInGems.map((g) => (
            <label key={g.id} className="check">
              <input
                type="checkbox"
                checked={!hidden.has(g.id)}
                onChange={(e) =>
                  set({
                    hiddenGems: e.target.checked
                      ? m.hiddenGems.filter((x) => x !== g.id)
                      : [...m.hiddenGems, g.id],
                  })
                }
              />
              <span>
                <b>{g.name}</b> {g.purpose}
              </span>
            </label>
          ))}
        </div>
      </section>

      {err && <p className="err">{err}</p>}
      <div className="mission-actions sticky">
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!!busy}
        >
          {busy === "save" ? (
            <Loader2 className="spin" size={15} />
          ) : (
            <Check size={15} />
          )}{" "}
          {saved ? "Saved" : "Save mission"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!!busy}
          title="Back to mission.json in the repo"
        >
          <RotateCcw size={15} /> Reset to default
        </button>
      </div>
    </div>
  );
}
