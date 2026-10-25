import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Globe, Puzzle, RefreshCw } from "lucide-react";
import { api } from "../api";

type Report = { kind: "tool" | "gem"; file: string; id?: string; ok: boolean; error?: string };

/** What's in plugins/, what loaded, and how to add your own. */
export function Plugins({ onReloaded }: { onReloaded: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [browser, setBrowser] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<{ reports: Report[]; browser: boolean }>("plugins").then((r) => {
      setReports(r.reports);
      setBrowser(r.browser);
    });
  useEffect(() => void load(), []);

  async function reload() {
    setBusy(true);
    try {
      const r = await api<{ reports: Report[] }>("plugins/reload", { method: "POST" });
      setReports(r.reports);
      onReloaded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pane">
      <h1>Plugins</h1>
      <section className="settings-card">
        <div className="settings-heading">
          <Puzzle size={18} />
          <div>
            <strong>Drop-in Gems and tools</strong>
            <p>
              Anyone can extend Paalam without touching its core. Put a tool in <code>plugins/tools/</code> (a .ts or .js file that default-exports <code>{"{ id, name, description, args, run }"}</code>) or a Gem in{" "}
              <code>plugins/gems/</code> (a .json file with name, purpose, instructions and tools), then reload. Full guide: <code>docs/PLUGINS.md</code>.
            </p>
          </div>
        </div>
        <button type="button" className="ghost small-btn" onClick={reload} disabled={busy}>
          <RefreshCw size={13} className={busy ? "spin" : ""} /> Reload plugins
        </button>
      </section>

      <section className="settings-card">
        <div className="settings-heading">
          <Globe size={18} />
          <div>
            <strong>Browser {browser ? "ready" : "not available"}</strong>
            <p>
              {browser
                ? "Gems can read links, open pages to see their forms, and fill a form you approve. Filling always stops before Submit; submitting is a second approval. Passwords, OTPs, PINs and card details are never filled."
                : "No Chrome or Chromium was found. Install Chrome, or set PAALAM_CHROME_PATH. read_url still works without it."}{" "}
              Set <code>PAALAM_BROWSER_HEADFUL=1</code> to watch the browser window while it fills.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-heading">
          <Puzzle size={18} />
          <div>
            <strong>Loaded ({reports.filter((r) => r.ok).length})</strong>
          </div>
        </div>
        {!reports.length && <p className="muted small">No plugins found in plugins/.</p>}
        <ul className="plugin-list">
          {reports.map((r) => (
            <li key={r.file} className={r.ok ? "" : "bad"}>
              {r.ok ? <CircleCheck size={15} className="ok" /> : <CircleX size={15} />}
              <span className="tag">{r.kind}</span>
              <code>{r.file}</code>
              {r.id && <b>{r.id}</b>}
              {r.error && <span className="plugin-err">{r.error}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
