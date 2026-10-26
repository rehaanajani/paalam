import { useEffect, useState } from "react";
import { Cable, Gauge, Gem as GemIcon, Mic, Monitor, Moon, NotebookPen, Puzzle, SlidersHorizontal, Sun, Target, X } from "lucide-react";
import { Mission } from "./Mission";
import { api } from "../api";
import { Plugins } from "./Plugins";
import { GemStudio } from "./GemStudio";
import { Harness } from "./Harness";
import { Integrations } from "./Integrations";
import { applyTheme, type Theme } from "../theme";
import type { SimplePrefs } from "../elder";
import type { GemDef, Status, ToolInfo } from "../types";

export type SettingsTab = "general" | "mission" | "gems" | "plugins" | "harness" | "integrations";

const tabs: { id: SettingsTab; label: string; icon: typeof Cable }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "mission", label: "Mission", icon: Target },
  { id: "gems", label: "Gems", icon: GemIcon },
  { id: "plugins", label: "Plugins", icon: Puzzle },
  { id: "harness", label: "Harness", icon: NotebookPen },
  { id: "integrations", label: "Keys", icon: Cable },
];

/** Socius's floating Settings dialog: sections on the left, the pane on the right. */
export function SettingsDialog({ tab: initial, gems, tools, status, theme, onTheme, simple, onSimple, onGemsChanged, onClose }: { tab: SettingsTab; gems: GemDef[]; tools: ToolInfo[]; status: Status | null; theme: Theme; onTheme: (t: Theme) => void; simple: SimplePrefs; onSimple: (p: SimplePrefs) => void; onGemsChanged: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>(initial);
  const [prefs, setPrefs] = useState<{ router: "gem" | "argon"; models: { gem: string; argon: string } } | null>(null);
  useEffect(() => void api("settings").then(setPrefs).catch(() => {}), []);
  const setRouter = async (router: "gem" | "argon") => {
    if (!prefs) return;
    setPrefs({ ...prefs, router });
    await api("settings", { method: "PUT", json: { router } }).catch(() => {});
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, []);
  const live = status?.integrations.filter((i) => i.live).length ?? 0;
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="settings-dialog" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav" aria-label="Settings sections">
          <h2>Settings</h2>
          <div role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "selected" : ""} onClick={() => setTab(t.id)}>
                <t.icon size={16} />
                {t.label}
                {t.id === "gems" && <span className="count">{gems.length}</span>}
                {t.id === "integrations" && status && (
                  <span className="count">
                    {live}/{status.integrations.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
        <div className="settings-pane">
          <button type="button" className="icon ghost dialog-close" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
          {tab === "general" && (
            <div className="pane">
              <h1>General</h1>
              <section className="settings-card">
                <div className="settings-heading">
                  <Monitor size={18} />
                  <div>
                    <strong>Appearance</strong>
                    <p>Follow the system, or pick light or dark.</p>
                  </div>
                </div>
                <div className="segmented" role="radiogroup" aria-label="Theme">
                  {(
                    [
                      { value: "system", label: "System", icon: Monitor },
                      { value: "light", label: "Light", icon: Sun },
                      { value: "dark", label: "Dark", icon: Moon },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.value}
                      role="radio"
                      aria-checked={theme === t.value}
                      className={theme === t.value ? "selected" : ""}
                      onClick={() => {
                        applyTheme(t.value);
                        onTheme(t.value);
                      }}
                    >
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-card">
                <div className="settings-heading">
                  <Mic size={18} />
                  <div>
                    <strong>Simple mode, for elders</strong>
                    <p>One big button to talk, answers in large text read aloud in Tamil, English or Hindi, and a 112 button always on screen. Saved on this device only, so set it on the phone they use.</p>
                  </div>
                </div>
                <div className="segmented" role="radiogroup" aria-label="Simple mode">
                  <button role="radio" aria-checked={!simple.on} className={!simple.on ? "selected" : ""} onClick={() => onSimple({ ...simple, on: false })}>
                    Full app
                  </button>
                  <button role="radio" aria-checked={simple.on} className={simple.on ? "selected" : ""} onClick={() => onSimple({ ...simple, on: true })}>
                    Simple mode
                  </button>
                </div>
                <div className="simple-family-fields">
                  <label>
                    Family member's name
                    <input value={simple.familyName} placeholder="Amma, Ravi…" onChange={(e) => onSimple({ ...simple, familyName: e.target.value })} />
                  </label>
                  <label>
                    Their number (a big call button)
                    <input value={simple.family} inputMode="tel" placeholder="+91…" onChange={(e) => onSimple({ ...simple, family: e.target.value })} />
                  </label>
                </div>
              </section>
              {prefs && (
                <section className="settings-card">
                  <div className="settings-heading">
                    <Gauge size={18} />
                    <div>
                      <strong>Who reads each message first</strong>
                      <p>Every message is split into problems before the Gems start. The fast model does this in about 5 seconds; Argon is the bigger model and can take 10–25 seconds. The Gems always use the fast model.</p>
                    </div>
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="Routing model">
                    <button role="radio" aria-checked={prefs.router === "gem"} className={prefs.router === "gem" ? "selected" : ""} onClick={() => setRouter("gem")}>
                      Fast · {prefs.models.gem}
                    </button>
                    <button role="radio" aria-checked={prefs.router === "argon"} className={prefs.router === "argon" ? "selected" : ""} onClick={() => setRouter("argon")}>
                      Argon · {prefs.models.argon}
                    </button>
                  </div>
                </section>
              )}
              {status && (
                <section className="settings-card">
                  <div className="settings-heading">
                    <SlidersHorizontal size={18} />
                    <div>
                      <strong>Region</strong>
                      <p>Used when nobody shares a location, and for the numbers on action cards. Change with DEFAULT_CITY, EMERGENCY_NUMBER and friends in .env.</p>
                    </div>
                  </div>
                  <dl className="budget">
                    <div>
                      <dt>City</dt>
                      <dd>
                        {status.city.name} ({status.city.lat.toFixed(3)}, {status.city.lng.toFixed(3)})
                      </dd>
                    </div>
                    <div>
                      <dt>Emergency</dt>
                      <dd>{status.numbers.emergency}</dd>
                    </div>
                    <div>
                      <dt>Ambulance</dt>
                      <dd>{status.numbers.ambulance}</dd>
                    </div>
                    <div>
                      <dt>Disaster helpline</dt>
                      <dd>{status.numbers.disaster}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </div>
          )}
          {tab === "mission" && <Mission onChanged={onGemsChanged} />}
          {tab === "gems" && <GemStudio gems={gems} tools={tools} onChanged={onGemsChanged} />}
          {tab === "plugins" && <Plugins onReloaded={onGemsChanged} />}
          {tab === "harness" && <Harness gems={gems} />}
          {tab === "integrations" && <Integrations status={status} tools={tools} />}
        </div>
      </div>
    </div>
  );
}
