import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, KeyRound, PanelLeft, Plus, Search, Settings } from "lucide-react";
import { api } from "./api";
import { Gem } from "./components/Gem";
import { GroupGem } from "./components/GroupGem";
import { Palette } from "./components/Palette";
import { ArgonHome } from "./views/ArgonHome";
import { GemChat } from "./views/GemChat";
import { Thread, gemStyle } from "./views/Thread";
import { SettingsDialog, type SettingsTab } from "./views/Settings";
import { applyTheme, loadTheme, type Theme } from "./theme";
import type { GemDef, Status, ToolInfo } from "./types";

type Route = { view: "argon" } | { view: "bridge"; id: string } | { view: "gem"; id: string };
type ThreadRow = { id: string; title: string; target: string | null; gems: string[]; updatedAt: string; runs: number; working: boolean; awaiting: number; demo: boolean };

function parse(hash: string): Route {
  const [, view, id] = hash.replace(/^#/, "").split("/");
  if (view === "bridge" && id) return { view: "bridge", id };
  if (view === "gem" && id) return { view: "gem", id };
  return { view: "argon" };
}
const go = (path: string) => (location.hash = path);
const narrow = () => matchMedia("(max-width: 760px)").matches;

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [gems, setGems] = useState<GemDef[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [collapsed, setCollapsed] = useState(narrow);
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState<SettingsTab | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // Gem tabs showing a new conversation
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [offline, setOffline] = useState(false);

  const loadGems = () => api<GemDef[]>("gems").then(setGems);
  const loadThreads = () => api<ThreadRow[]>("threads").then(setThreads);
  useEffect(() => {
    applyTheme(theme);
    const on = () => {
      setRoute(parse(location.hash));
      if (narrow()) setCollapsed(true);
    };
    addEventListener("hashchange", on);
    const keys = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "k" || e.key === "n") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "\\") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    addEventListener("keydown", keys);
    // One heartbeat keeps everything fresh and notices when the server goes away or comes back.
    let wasOffline = true;
    const beat = async () => {
      try {
        const s = await api<Status>("status");
        setStatus(s);
        setOffline(false);
        if (wasOffline) {
          void loadGems();
          api<ToolInfo[]>("tools").then(setTools);
        }
        wasOffline = false;
        void loadThreads().catch(() => {});
      } catch {
        wasOffline = true;
        setOffline(true);
      }
    };
    void beat();
    const poll = setInterval(beat, 4000);
    return () => {
      removeEventListener("hashchange", on);
      removeEventListener("keydown", keys);
      clearInterval(poll);
    };
  }, []);

  /** Sends into Argon (new Bridge), an existing Bridge, or straight to one Gem. */
  async function send(text: string, files: File[], near: { lat: number; lng: number } | undefined, to: { threadId?: string; gemId?: string } = {}) {
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
      if (to.threadId) form.set("threadId", to.threadId);
      if (to.gemId) form.set("gemId", to.gemId);
      const r = await api<{ id: string; threadId: string }>("runs", { method: "POST", body: form });
      if (to.gemId) setFresh((f) => new Set([...f].filter((x) => x !== to.gemId)));
      else if (!to.threadId) go(`/bridge/${r.threadId}`);
      await loadThreads();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sample() {
    setBusy(true);
    try {
      const r = await api<{ threadId: string }>("runs/sample", { json: {} });
      go(`/bridge/${r.threadId}`);
      await loadThreads();
    } finally {
      setBusy(false);
    }
  }

  const gemOf = (id: string) => gems.find((g) => g.id === id);
  const bridges = threads.filter((t) => !t.target);
  const gemWorking = (id: string) => threads.some((t) => t.working && t.gems.includes(id));
  const gemThread = (id: string) => (fresh.has(id) ? null : (threads.find((t) => t.target === id)?.id ?? null));
  const argonWorking = threads.some((t) => t.working);
  const toggle = (k: string) => setFolded((f) => new Set(f.has(k) ? [...f].filter((x) => x !== k) : [...f, k]));
  const heading = (k: string, label: string, count: number) => (
    <h3>
      <button className="section-toggle" aria-expanded={!folded.has(k)} onClick={() => toggle(k)}>
        {label}
        {folded.has(k) && count > 0 && <span className="section-count">{count}</span>}
        <ChevronRight size={12} />
      </button>
    </h3>
  );
  const ago = (iso: string) => {
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const live = status?.integrations.filter((i) => i.live).length ?? 0;
  const tip = (label: string, el: ReactNode) => <span title={label}>{el}</span>;

  let page: ReactNode;
  if (route.view === "bridge") {
    const t = threads.find((x) => x.id === route.id);
    const involved = (t?.gems ?? []).map(gemOf).filter((g): g is GemDef => !!g);
    page = (
      <Thread
        key={route.id}
        threadId={route.id}
        gems={gems}
        status={status}
        placeholder="Add more: another photo, an update, a correction…"
        pill={
          <span className="bot-pill">
            <GroupGem gems={involved} size={28} busy={t?.working} />
            <span className="pill-title">{t?.title ?? "Bridge"}</span>
          </span>
        }
        onSend={(text, files, near) => send(text, files, near, { threadId: route.id })}
        onChanged={loadThreads}
        onNew={() => go("/")}
      />
    );
  } else if (route.view === "gem" && gemOf(route.id)) {
    const g = gemOf(route.id)!;
    const tid = gemThread(g.id);
    page = (
      <GemChat
        key={`${g.id}:${tid}`}
        gem={g}
        gems={gems}
        tools={tools}
        status={status}
        threadId={tid}
        busy={busy}
        onSend={(text, files, near) => send(text, files, near, { gemId: g.id, ...(tid ? { threadId: tid } : {}) })}
        onChanged={loadThreads}
        onNew={() => setFresh((f) => new Set([...f, g.id]))}
        onEdit={() => setSettings("gems")}
      />
    );
  } else {
    page = <ArgonHome gems={gems} status={status} busy={busy} onSend={(t, f, n) => send(t, f, n)} onSample={sample} onOpenGem={(id) => go(`/gem/${id}`)} />;
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <div className="drawer-backdrop" aria-hidden="true" onClick={() => setCollapsed(true)} />
      <aside className="sidebar" aria-label="Argon, bridges and Gems" inert={collapsed}>
        <div className="sidebar-top">
          <div className="window-tools">
            {tip(
              "Hide sidebar  ⌘\\",
              <button className="icon ghost" aria-label="Hide sidebar" onClick={() => setCollapsed(true)}>
                <PanelLeft size={17} />
              </button>,
            )}
            {tip(
              "Search  ⌘K",
              <button className="icon round" aria-label="Search" onClick={() => setPalette(true)}>
                <Search size={17} />
              </button>,
            )}
            {tip(
              "New bridge or Gem  ⌘N",
              <button className="icon round" aria-label="Create" onClick={() => setPalette(true)}>
                <Plus size={19} />
              </button>,
            )}
          </div>
        </div>
        <div className="sidebar-scroll">
          <div className="featured">
            <button className={`featured-bot ${route.view === "argon" ? "active" : ""}`} onClick={() => go("/")}>
              <Gem argon size={66} name="argon-featured" mood={argonWorking ? "busy" : "idle"} />
              <span>Argon</span>
              <small>Orchestrator</small>
              {argonWorking && <span className="review-dot pulse" aria-label="Working" />}
            </button>
          </div>

          <section className="bot-group" aria-label="Bridges">
            {heading("bridges", "Bridges", bridges.length)}
            {!folded.has("bridges") && !bridges.length && <small className="bots-empty">Message Argon to start one.</small>}
            {!folded.has("bridges") &&
              bridges.map((t) => (
                <button key={t.id} className={`bot-row ${route.view === "bridge" && route.id === t.id ? "active" : ""}`} onClick={() => go(`/bridge/${t.id}`)}>
                  <GroupGem gems={t.gems.map(gemOf).filter((g): g is GemDef => !!g)} size={34} busy={t.working} />
                  <span className="bot-text">
                    <strong>{t.title}</strong>
                    <small>{t.working ? "Working…" : t.awaiting ? `${t.awaiting} action${t.awaiting > 1 ? "s" : ""} waiting` : `${ago(t.updatedAt)}${t.demo ? " · demo" : ""}`}</small>
                  </span>
                  {(t.working || t.awaiting > 0) && <span className={`unread ${t.working ? "pulse" : ""}`} aria-label={t.working ? "Working" : "Needs review"} />}
                </button>
              ))}
          </section>

          <section className="bot-group" aria-label="Gems">
            {heading("gems", "Gems", gems.length)}
            {!folded.has("gems") &&
              gems.map((g) => {
                const working = gemWorking(g.id);
                const t = threads.find((x) => x.target === g.id);
                return (
                  <button key={g.id} className={`bot-row ${route.view === "gem" && route.id === g.id ? "active" : ""}`} style={gemStyle(g)} onClick={() => go(`/gem/${g.id}`)}>
                    <Gem color={g.color} size={34} name={g.id} mood={working ? "busy" : "idle"} />
                    <span className="bot-text">
                      <strong>{g.name}</strong>
                      <small>{working ? "Working…" : g.purpose.split(/[,.]/)[0]}</small>
                    </span>
                    {(working || (t?.awaiting ?? 0) > 0) && <span className={`unread ${working ? "pulse" : ""}`} />}
                  </button>
                );
              })}
            {!folded.has("gems") && (
              <button className="bot-row add-row" onClick={() => setSettings("gems")}>
                <span className="add-gem">
                  <Plus size={16} />
                </span>
                <span className="bot-text">
                  <strong>Create a Gem</strong>
                  <small>Describe it, Argon designs it</small>
                </span>
              </button>
            )}
          </section>
        </div>
        <div className="sidebar-bottom">
          <button className="account-button" aria-label="Settings" title="Settings" onClick={() => setSettings("general")}>
            <Settings size={16} />
          </button>
          <button className="connect-apps" onClick={() => setSettings("integrations")}>
            <span className="keys-label">
              <KeyRound size={15} /> Connect keys
            </span>
            <span className={`key-status ${status?.demo ? "demo" : "live"}`}>{status ? (status.demo ? "Demo" : `${live}/${status.integrations.length} live`) : "…"}</span>
          </button>
        </div>
      </aside>

      <main>
        <button className="sidebar-reveal icon ghost" aria-label="Show sidebar" tabIndex={collapsed ? 0 : -1} aria-hidden={!collapsed} onClick={() => setCollapsed(false)} title="Show sidebar  ⌘\">
          <PanelLeft size={17} />
        </button>
        {offline && (
          <div className="offline-banner" role="status">
            <b>Paalam's server isn't running.</b> Start it with <code>npm start</code> in the Paalam folder (or open the desktop app). This page reconnects by itself.
          </div>
        )}
        {err && (
          <div className="error-toast" onClick={() => setErr("")}>
            {err}
          </div>
        )}
        {page}
      </main>

      {palette && (
        <Palette
          gems={gems}
          threads={bridges}
          onClose={() => setPalette(false)}
          onArgon={() => go("/")}
          onGem={(id) => go(`/gem/${id}`)}
          onThread={(id) => go(`/bridge/${id}`)}
          onCreateGem={() => setSettings("gems")}
          onSettings={() => setSettings("general")}
        />
      )}
      {settings && <SettingsDialog tab={settings} gems={gems} tools={tools} status={status} theme={theme} onTheme={setTheme} onGemsChanged={loadGems} onClose={() => setSettings(null)} />}
    </div>
  );
}
