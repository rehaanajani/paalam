import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import { api } from "../api";

type Model = { id: string; label: string; note?: string };
type Prefs = { gemModels: Record<string, string>; models: { gem: string; argon: string } };

/** Socius-style model pill for a Gem's chat: pick any Gemini model this project can use. */
export function ModelPicker({ gemId, tier = "gem" }: { gemId: string; tier?: "gem" | "argon" }) {
  const [models, setModels] = useState<Model[]>([]);
  const [current, setCurrent] = useState("");
  const [fallback, setFallback] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Model[]>("models").then(setModels).catch(() => {});
    api<Prefs>("settings").then((p) => {
      setFallback(tier === "argon" ? p.models.argon : p.models.gem);
      setCurrent(p.gemModels?.[gemId] ?? "");
    });
  }, [gemId, tier]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [open]);

  async function pick(id: string) {
    setCurrent(id === fallback ? "" : id);
    setOpen(false);
    await api("settings", { method: "PUT", json: { gemModels: { [gemId]: id === fallback ? "" : id } } }).catch(() => {});
  }

  const active = current || fallback;
  if (!models.length) return null;
  return (
    <div className="model-picker" ref={box}>
      <button type="button" className="model-pill" onClick={() => setOpen((o) => !o)} title="Model this Gem uses">
        <Cpu size={13} />
        <span>{active.replace(/^gemini-/, "")}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="floating-panel model-menu" role="listbox">
          {models.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={m.id === active} className={m.id === active ? "on" : ""} onClick={() => pick(m.id)}>
              <span className="model-name">
                {m.label}
                {m.note && <small>{m.note}</small>}
              </span>
              {m.id === active && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
