import { useEffect, useState } from "react";
import { Cable, Gem as GemIcon, Monitor, Moon, NotebookPen, Puzzle, SlidersHorizontal, Sun, X } from "lucide-react";
import { Plugins } from "./Plugins";
import { GemStudio } from "./GemStudio";
import { Harness } from "./Harness";
import { Integrations } from "./Integrations";
import { applyTheme, type Theme } from "../theme";
import type { GemDef, Status, ToolInfo } from "../types";

export type SettingsTab = "general" | "gems" | "plugins" | "harness" | "integrations";

const tabs: { id: SettingsTab; label: string; icon: typeof Cable }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "gems", label: "Gems", icon: GemIcon },
  { id: "plugins", label: "Plugins", icon: Puzzle },
  { id: "harness", label: "Harness", icon: NotebookPen },
  { id: "integrations", label: "Keys", icon: Cable },
];

/** Socius's floating Settings dialog: sections on the left, the pane on the right. */
export function SettingsDialog({ tab: initial, gems, tools, status, theme, onTheme, onGemsChanged, onClose }: { tab: SettingsTab; gems: GemDef[]; tools: ToolInfo[]; status: Status | null; theme: Theme; onTheme: (t: Theme) => void; onGemsChanged: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>(initial);
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
          {tab === "gems" && <GemStudio gems={gems} tools={tools} onChanged={onGemsChanged} />}
          {tab === "plugins" && <Plugins onReloaded={onGemsChanged} />}
          {tab === "harness" && <Harness gems={gems} />}
          {tab === "integrations" && <Integrations status={status} tools={tools} />}
        </div>
      </div>
    </div>
  );
}
