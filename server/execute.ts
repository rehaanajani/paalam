import { config, live } from "./config.js";
import { toolRegistry } from "./tools/index.js";
import { fillForm, submitForm, type FillStep } from "./browser/index.js";
import type { ActionCard, Run } from "./types.js";

export interface Execution {
  ok: boolean;
  result: string;
  shotId?: string;
  /** a new card this action produced, e.g. "Submit the form" after a fill */
  followUp?: ActionCard;
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
    case "browser_fill": {
      const steps = (Array.isArray(p.steps) ? p.steps : []) as FillStep[];
      const r = await fillForm(String(p.url), steps);
      const host = new URL(r.url).host;
      const result = `Filled ${r.filled.length} field${r.filled.length === 1 ? "" : "s"} on ${host}. Not submitted.${r.refused.length ? ` Skipped: ${r.refused.join("; ")}.` : ""}${r.visible ? " The browser window is open for you to check." : ""}`;
      return {
        ok: r.filled.length > 0,
        result,
        shotId: r.shotId,
        followUp: {
          id: `${a.id}.submit`,
          gemId: a.gemId,
          fragmentId: a.fragmentId,
          kind: "browser_submit",
          title: `Submit the form on ${host}`,
          detail: "Check the filled form in the screenshot above. Submitting sends it to the website.",
          effect: `Presses the form's submit button on ${host}. This can't be undone.`,
          payload: { holdId: r.holdId, url: r.url },
          evidence: a.evidence,
          unresolved: r.refused.length ? [`Fields Paalam left for you: ${r.refused.map((x) => x.split(":")[0]).join(", ")}`] : [],
          priority: a.priority,
          status: "awaiting",
        },
      };
    }
    case "browser_submit": {
      const r = await submitForm(String(p.holdId));
      return { ok: true, result: `Submitted. The site now shows: "${r.title || r.url}".`, shotId: r.shotId };
    }
  }
}
