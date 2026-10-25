import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Cable, Gem as GemIcon, Menu, NotebookPen, Plus, Sparkles, X } from "lucide-react";
import { api } from "./api";
import { Gem } from "./components/Gem";
import { Constellation } from "./components/Constellation";
import { Composer } from "./components/Composer";
import { RunView } from "./views/RunView";
import { GemStudio } from "./views/GemStudio";
import { Harness } from "./views/Harness";
import { Integrations } from "./views/Integrations";
import type { GemDef, Status, ToolInfo } from "./types";

type Route = { view: "home" } | { view: "run"; id: string } | { view: "gems" } | { view: "harness" } | { view: "integrations" };
type RunRow = { id: string; createdAt: string; headline?: string; stage: string; demo: boolean };

function parse(hash: string): Route {
  const [, view, id] = hash.replace(/^#/, "").split("/");
  if (view === "run" && id) return { view: "run", id };
  if (view === "gems" || view === "harness" || view === "integrations") return { view };
  return { view: "home" };
}
const go = (path: string) => (location.hash = path);

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [gems, setGems] = useState<GemDef[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [nav, setNav] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const loadGems = () => api<GemDef[]>("gems").then(setGems);
  const loadRuns = () => api<RunRow[]>("runs").then(setRuns);
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      setNav(false);
      document.querySelector("main")?.scrollTo({ top: 0 });
    };
    addEventListener("hashchange", on);
    void loadGems();
    void loadRuns();
    api<ToolInfo[]>("tools").then(setTools);
    api<Status>("status").then(setStatus);
    return () => removeEventListener("hashchange", on);
  }, []);

  async function send(text: string, files: File[], near?: { lat: number; lng: number }) {
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      form.set("text", text);
      files.forEach((f) => form.append("files", f));
      if (near) {
        form.set("lat", String(near.lat));
        form.set("lng", String(near.lng));
      }
      const { id } = await api<{ id: string }>("runs", { method: "POST", body: form });
      go(`/run/${id}`);
      setTimeout(loadRuns, 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sample() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("runs/sample", { method: "POST" });
      go(`/run/${id}`);
      setTimeout(loadRuns, 1500);
    } finally {
      setBusy(false);
    }
  }

  const pickedGem = gems.find((g) => g.id === picked);

  return (
    <div className={`app ${nav ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand" onClick={() => go("/")}>
          <Gem argon size={34} name="brand" />
          <div>
            <b>Paalam</b>
            <span>பாலம் · the bridge</span>
          </div>
          <button type="button" className="icon-btn close-nav" onClick={() => setNav(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <button type="button" className="new-run" onClick={() => go("/")}>
          <Plus size={16} /> New bridge
        </button>
        <nav>
          <a className={route.view === "gems" ? "on" : ""} href="#/gems">
            <GemIcon size={16} /> Gem Studio <span className="count">{gems.length}</span>
          </a>
          <a className={route.view === "harness" ? "on" : ""} href="#/harness">
            <NotebookPen size={16} /> Harness
          </a>
          <a className={route.view === "integrations" ? "on" : ""} href="#/integrations">
            <Cable size={16} /> Integrations
          </a>
        </nav>
        <div className="side-gems">
          {gems.map((g) => (
            <span key={g.id} title={g.name} onClick={() => go("/gems")}>
              <Gem color={g.color} size={26} name={g.id} />
            </span>
          ))}
        </div>
        <div className="recent">
          <h4>Recent</h4>
          {runs.length === 0 && <p className="muted small">Nothing yet</p>}
          {runs.map((r) => (
            <a key={r.id} href={`#/run/${r.id}`} className={route.view === "run" && route.id === r.id ? "on" : ""}>
              <span className="recent-title">{r.headline ?? "Untitled"}</span>
              <span className="recent-meta">
                {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {r.demo && " · demo"}
              </span>
            </a>
          ))}
        </div>
        <div className={`mode ${status?.demo ? "demo" : "live"}`}>
          <i />
          {status ? (status.demo ? "Demo mode: add keys in Integrations" : `Live · ${status.integrations.filter((i) => i.live).length}/${status.integrations.length} integrations`) : "…"}
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => setNav(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <span className="brand-mini" onClick={() => go("/")}>
            <Gem argon size={24} name="brand-m" /> Paalam
          </span>
        </header>

        {route.view === "home" && (
          <div className="home">
            <div className="hero">
              <Constellation gems={gems} size={Math.max(240, Math.min(440, window.innerWidth - 40))} onPick={(id) => setPicked(id === picked ? null : id)} active={picked ? [picked] : []} />
              <div className="hero-copy">
                <h1>
                  Send anything.
                  <br />
                  <span className="grad">Get verified action.</span>
                </h1>
                <p>Voice notes, photos, forwarded messages, a stack of prescriptions, in any language, all at once. Argon splits the chaos, the right Gems check every claim with Google's tools, and you approve what happens.</p>
                {pickedGem && (
                  <div className="picked" style={{ "--gem": pickedGem.color } as CSSProperties}>
                    <b>{pickedGem.name}</b> {pickedGem.purpose}
                  </div>
                )}
              </div>
            </div>
            <div className="home-composer">
              <Composer busy={busy} onSend={send} />
              {err && <div className="err">{err}</div>}
              <div className="try">
                <button type="button" className="try-btn" onClick={sample} disabled={busy}>
                  <Sparkles size={15} /> Try it: a Chennai family's flood-night WhatsApp
                </button>
                <span className="muted small">Flood + insulin without power + a relief scam, all in one chat</span>
              </div>
            </div>
            <ol className="flow">
              <li>
                <b>Messy in</b>
                <span>voice · photo · PDF · forwards</span>
              </li>
              <li>
                <b>Split</b>
                <span>Argon finds every problem</span>
              </li>
              <li>
                <b>Verify</b>
                <span>tools back every claim</span>
              </li>
              <li>
                <b>Act</b>
                <span>you approve each action</span>
              </li>
            </ol>
          </div>
        )}
        {route.view === "run" && <RunView key={route.id} runId={route.id} gems={gems} status={status} onGemsChanged={loadGems} onDone={loadRuns} />}
        {route.view === "gems" && <GemStudio gems={gems} tools={tools} onChanged={loadGems} />}
        {route.view === "harness" && <Harness gems={gems} />}
        {route.view === "integrations" && <Integrations status={status} tools={tools} />}
      </main>
      <div className="scrim" onClick={() => setNav(false)} />
    </div>
  );
}
