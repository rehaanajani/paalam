import { config, live } from "./config.js";
import { toolRegistry } from "./tools/index.js";
import type { ActionCard, Run } from "./types.js";

export interface Execution {
  ok: boolean;
  result: string;
  /** what the browser should do next: open a link, dial, copy, play audio */
  client?: { open?: string; tel?: string; copy?: string; audio?: string | null; speak?: { text: string; lang: string } };
}

/**
 * Carries out one approved action. Anything that would reach the outside world
 * without a configured integration is simulated, and says so.
 */
export async function execute(a: ActionCard, run: Run): Promise<Execution> {
  const p = a.payload as Record<string, any>;
  switch (a.kind) {
    case "navigate": {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
      return { ok: true, result: `Directions to ${p.label ?? "destination"} opened`, client: { open: url } };
    }
    case "call":
      return { ok: true, result: `Dialer opened for ${p.number}`, client: { tel: String(p.number), ...(p.script ? { copy: p.script } : {}) } };
    case "sms": {
      if (live.sms && /^\+?\d{8,}$/.test(String(p.to ?? "").replace(/\s/g, ""))) {
        const body = new URLSearchParams({ To: p.to, From: config.twilio.from, Body: p.body });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${config.twilio.sid}:${config.twilio.token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
          body,
        });
        return res.ok ? { ok: true, result: `SMS sent to ${p.to}` } : { ok: false, result: `SMS failed (${res.status})` };
      }
      return { ok: true, result: `Simulated: SMS to ${p.to} (add Twilio keys to send for real). Text copied for you to send.`, client: { copy: p.body } };
    }
    case "share":
      return { ok: true, result: "Copied. Paste it into WhatsApp or anywhere.", client: { copy: p.text } };
    case "alert":
    case "request":
      return { ok: true, result: `Simulated: request logged for ${p.to} as incident #${run.id}-${a.fragmentId}. Real dispatch needs a control-room integration.`, client: { copy: p.body } };
    case "readback": {
      const tts = toolRegistry.get("speak")!;
      const out = await tts.run({ text: p.text, lang: p.lang ?? "ta-IN" }, { evidence: [], near: config.city, usage: run.usage });
      return { ok: true, result: out.demo ? "Reading aloud with the browser voice" : "Reading aloud", client: { audio: out.data?.audio ?? null, speak: { text: p.text, lang: p.lang ?? "ta-IN" } } };
    }
    case "warn":
      return { ok: true, result: p.text ?? "Marked" };
  }
}
