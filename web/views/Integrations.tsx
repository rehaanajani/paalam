import { CircleCheck, CircleDashed, ExternalLink } from "lucide-react";
import type { Status, ToolInfo } from "../types";

const where: Record<string, { label: string; url: string }> = {
  gemini: { label: "Vertex AI → Model Garden", url: "https://console.cloud.google.com/vertex-ai/model-garden" },
  maps: { label: "Cloud console → Credentials", url: "https://console.cloud.google.com/apis/credentials" },
  cloud: { label: "Cloud console → Credentials", url: "https://console.cloud.google.com/apis/credentials" },
  dlp: { label: "IAM → Service accounts (paalam)", url: "https://console.cloud.google.com/iam-admin/serviceaccounts" },
  sms: { label: "Twilio console", url: "https://console.twilio.com" },
  image: { label: "AI Studio → model list", url: "https://aistudio.google.com" },
  embed: { label: "AI Studio → model list", url: "https://aistudio.google.com" },
  health: { label: "Enable the Healthcare API", url: "https://console.cloud.google.com/apis/library/healthcare.googleapis.com" },
  armor: { label: "Security → Model Armor → Create template", url: "https://console.cloud.google.com/security/modelarmor" },
  firestore: { label: "Firestore → Create database", url: "https://console.cloud.google.com/firestore" },
};

/** Which integrations are live and exactly which env var switches each one on. */
export function Integrations({ status, tools }: { status: Status | null; tools: ToolInfo[] }) {
  if (!status) return null;
  return (
    <div className="integrations">
      <header className="page-head">
        <h1>Integrations</h1>
        <p className="muted">
          Everything runs without keys: missing ones fall back to clearly labelled demo data. Put keys in <code>{status.envFile ?? ".env"}</code> (template: <code>.env.example</code>) and restart. Step-by-step guide: <code>docs/KEYS.md</code>. Keys never reach the browser.
        </p>
      </header>
      <section className="int-list">
        {status.integrations.map((i) => (
          <article key={i.id} className={`panel int ${i.live ? "live" : ""}`}>
            <div className="int-head">
              {i.live ? <CircleCheck size={18} className="ok" /> : <CircleDashed size={18} />}
              <h3>{i.name}</h3>
              <span className={`live-pill ${i.live ? "live" : "demo"}`}>{i.live ? "LIVE" : i.optional ? "OPTIONAL" : "DEMO"}</span>
            </div>
            <div className="env">
              {i.env.map((e) => (
                <code key={e}>{e}</code>
              ))}
            </div>
            {i.uses && <p className="small">{i.uses}</p>}
            {i.checks?.map((c) => (
              <p key={c.model} className={`small model-check ${c.ok ? "ok" : "bad"}`} title={c.error}>
                {c.ok ? "✓" : "✕"} <code>{c.model}</code> {c.ok ? "found on your key" : "not available on your key: set another ID in .env"}
              </p>
            ))}
            {i.models && (
              <p className="small muted">
                Argon: <code>{i.models.argon}</code> · Gems: <code>{i.models.gem}</code>
              </p>
            )}
            {!i.live && i.fallback && <p className="small muted">Without it: {i.fallback}</p>}
            {where[i.id] && (
              <a className="small" href={where[i.id]!.url} target="_blank" rel="noreferrer">
                {where[i.id]!.label} <ExternalLink size={12} />
              </a>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Tool registry ({tools.length})</h2>
        <table className="tool-table">
          <tbody>
            {tools.map((t) => (
              <tr key={t.id}>
                <td>
                  <code>{t.id}</code>
                </td>
                <td>{t.name}</td>
                <td className="muted">{t.group}</td>
                <td className="muted small">{t.needs}</td>
                <td>
                  <span className={`live-pill ${t.live ? "live" : "demo"}`}>{t.live ? "LIVE" : "DEMO"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
