import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Gem as GemIcon, Plus, Settings, Sparkles, X } from "lucide-react";
import { Gem } from "./Gem";
import type { GemDef } from "../types";

type Item = { key: string; label: string; icon: React.ReactNode; run: () => void };

/** Socius's "To: Start a chat with…" picker, opened from + or search (⌘K). */
export function Palette({ gems, threads, onClose, onArgon, onGem, onThread, onCreateGem, onSettings }: { gems: GemDef[]; threads: { id: string; title: string }[]; onClose: () => void; onArgon: () => void; onGem: (id: string) => void; onThread: (id: string) => void; onCreateGem: () => void; onSettings: () => void }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      { key: "new", label: "New bridge with Argon", icon: <Sparkles size={16} />, run: onArgon },
      { key: "gem", label: "Create a Gem", icon: <Plus size={16} />, run: onCreateGem },
      { key: "argon", label: "Argon", icon: <Gem argon size={20} name="pal-argon" />, run: onArgon },
      ...gems.map((g) => ({ key: `g:${g.id}`, label: g.name, icon: <Gem color={g.color} size={20} name={g.id} />, run: () => onGem(g.id) })),
      ...threads.slice(0, 8).map((t) => ({ key: `t:${t.id}`, label: t.title, icon: <GemIcon size={16} />, run: () => onThread(t.id) })),
      { key: "settings", label: "Settings", icon: <Settings size={16} />, run: onSettings },
    ];
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => i.label.toLowerCase().includes(s)) : all;
  }, [q, gems, threads]);

  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAt((a) => Math.min(items.length - 1, a + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAt((a) => Math.max(0, a - 1));
    }
    if (e.key === "Enter" && items[at]) {
      items[at]!.run();
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="to-bar">
          <span>To:</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={keys}
            placeholder="Start a bridge with…"
          />
          <button type="button" className="icon ghost" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="floating-panel palette-list" role="listbox">
          {items.map((i, n) => (
            <button
              key={i.key}
              type="button"
              role="option"
              aria-selected={n === at}
              className={n === at ? "on" : ""}
              onMouseEnter={() => setAt(n)}
              onClick={() => {
                i.run();
                onClose();
              }}
            >
              <span className="pal-icon">{i.icon}</span>
              <span className="pal-label">{i.label}</span>
              {n < 9 && (
                <span className="kbd-pair">
                  <kbd>⌘</kbd>
                  <kbd>{n + 1}</kbd>
                </span>
              )}
            </button>
          ))}
          {!items.length && <p className="muted small pal-empty">No match</p>}
        </div>
      </div>
    </div>
  );
}
