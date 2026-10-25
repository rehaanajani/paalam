import { CircleHelp, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import type { Evidence, Fact, ToolCall } from "../types";

const badge = {
  verified: { Icon: ShieldCheck, label: "Verified" },
  unverified: { Icon: ShieldQuestion, label: "Unverified" },
  conflict: { Icon: ShieldX, label: "Conflict" },
  pending: { Icon: CircleHelp, label: "Pending" },
};

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

/** Every fact shows where it came from and whether a tool backs it: the visible half of the trust layer. */
export function FactTable({ facts, tools, evidence }: { facts: Fact[]; tools: ToolCall[]; evidence: Evidence[] }) {
  const cite = (id: string) => {
    const t = tools.find((x) => x.id === id);
    if (t) return `${t.tool}${t.demo ? " (demo)" : ""}: ${t.summary}`;
    const e = evidence.find((x) => x.id === id);
    return e ? `${e.kind}: ${e.name}` : id;
  };
  return (
    <div className="facts">
      {facts.map((f) => {
        const b = badge[f.verification] ?? badge.unverified;
        return (
          <div key={f.id} className={`fact v-${f.verification} s-${f.status}`}>
            <div className="fact-field">{f.field}</div>
            <div className="fact-value">
              {f.value}
              {f.note && <div className="fact-note">{f.note}</div>}
            </div>
            <div className="fact-meta">
              <span className={`status s-${f.status}`}>{f.status}</span>
              <span className={`verify v-${f.verification}`} title={f.verifiedBy ? `${b.label} by ${f.verifiedBy} at ${time(f.verifiedAt)}` : b.label}>
                <b.Icon size={13} />
                {b.label}
                {f.verifiedBy && <em>· {f.verifiedBy.replace(" (demo data)", "")}</em>}
              </span>
              <span className="sources">
                {f.sources.map((s) => (
                  <span key={s} className={`src ${s.startsWith("T") ? "tool" : "ev"}`} title={cite(s)}>
                    {s}
                  </span>
                ))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
