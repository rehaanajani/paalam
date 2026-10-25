import { config } from "./config.js";
import { redact } from "./tools/redact.js";
import { checkUrl } from "./browser/net.js";
import type { GemResult, Run } from "./types.js";

/**
 * The trust layer. Gemini proposes; this code decides what may be called
 * "verified" and what may leave the device. Nothing here calls a model, so a
 * confident hallucination can't talk its way past it.
 *
 * Returns a human-readable list of every change, which goes into the audit trail.
 */
export async function enforceTrust(r: GemResult, run: Run): Promise<string[]> {
  const log: string[] = [];
  const evidenceIds = new Set(run.input.evidence.map((e) => e.id));
  const calls = new Map(r.tools.map((t) => [t.id, t]));
  const at = new Date().toISOString();

  // 1. Facts: sources must exist, and "verified" needs a successful tool behind it.
  for (const f of r.facts) {
    const before = f.sources.length;
    f.sources = f.sources.filter((s) => evidenceIds.has(s) || calls.has(s));
    if (f.sources.length < before) log.push(`${f.field}: removed ${before - f.sources.length} citation(s) to evidence that doesn't exist`);

    const backing = f.sources.map((s) => calls.get(s)).filter((c) => c?.ok);
    if (f.status === "unknown") {
      f.verification = "unverified";
    } else if (f.verification === "verified" && backing.length === 0) {
      f.verification = "unverified";
      f.note = "Gemini marked this verified, but no tool result backs it.";
      log.push(`${f.field}: downgraded to unverified (no tool evidence)`);
    } else if (f.verification === "verified") {
      const demo = backing.every((c) => c!.demo);
      f.verifiedBy = backing.map((c) => c!.tool).join(" + ") + (demo ? " (demo data)" : "");
      f.verifiedAt = at;
    } else if (!f.verification || (f.verification as string) === "pending") {
      f.verification = "unverified";
    }
  }

  // 2. Photos that are old or stripped of metadata are flagged, not trusted.
  for (const c of r.tools.filter((t) => t.tool === "check_freshness" && t.ok)) {
    if (c.data?.fresh === false) {
      r.facts.push({ id: `${r.fragmentId}.fresh.${c.id}`, field: "Photo age", value: c.summary, status: "inferred", sources: [c.id, String(c.args.evidenceId)], verification: "conflict", verifiedBy: "check_freshness", verifiedAt: at, note: "Possibly an old or forwarded image. Don't rely on it for current conditions." });
      log.push(`Photo ${c.args.evidenceId} flagged as old`);
    }
  }

  // 3. Actions: numbers and places must come from config or a tool, and text is redacted before it leaves.
  const knownNumbers = new Set([config.numbers.ambulance, config.numbers.emergency, config.numbers.disaster, "1930", "100", "101", "108", "112", "1070", "1077"]);
  for (const t of r.tools) for (const p of t.data?.places ?? []) if (p.phone) knownNumbers.add(String(p.phone).replace(/\s/g, ""));
  const knownPoints = r.tools.flatMap((t) => [...(t.data?.places ?? []), ...(t.tool === "geocode" && t.ok ? [t.data] : [])]).filter((p) => p?.lat);

  for (const a of r.actions) {
    const p = a.payload as Record<string, any>;
    for (const key of ["number", "to"] as const) {
      const n = typeof p[key] === "string" ? p[key].replace(/\s/g, "") : "";
      if (n && /^\+?\d{3,}$/.test(n) && !knownNumbers.has(n)) {
        a.unresolved = [...new Set([...a.unresolved, `Number ${p[key]} was not found by any tool. Check it before calling.`])];
        log.push(`${a.title}: number ${p[key]} not verified`);
      }
    }
    if (a.kind === "navigate" && typeof p.lat === "number") {
      const near = knownPoints.some((k: any) => Math.abs(k.lat - p.lat) < 0.002 && Math.abs(k.lng - p.lng) < 0.002);
      if (!near) {
        a.unresolved = [...new Set([...a.unresolved, "Destination wasn't returned by Places or Geocoding."])];
        log.push(`${a.title}: destination not backed by a Maps result`);
      }
    }
    if (["sms", "share", "alert", "request"].includes(a.kind)) {
      for (const key of ["body", "text"] as const) {
        if (typeof p[key] !== "string") continue;
        const red = await redact(p[key]);
        if (red.found.length) {
          p[key] = red.text;
          log.push(`${a.title}: masked ${red.found.join(", ")} before sharing (${red.engine})`);
        }
      }
    }
    if (a.kind === "browser_fill") {
      try {
        checkUrl(String(p.url));
      } catch (e) {
        a.unresolved = [...a.unresolved, `Can't open ${p.url}: ${(e as Error).message}`];
        log.push(`${a.title}: address refused`);
      }
      const steps = Array.isArray(p.steps) ? p.steps : [];
      const unsafe = /pass(word|code)?|\botp\b|cvv|cvc|card|upi.?pin|\bpin\b|mpin|captcha/i;
      const kept = steps.filter((st: any) => st && typeof st.field === "string" && !unsafe.test(st.field));
      if (kept.length < steps.length) {
        a.unresolved = [...a.unresolved, "Removed fields asking for passwords, OTPs, PINs or card details. Fill those yourself."];
        log.push(`${a.title}: removed ${steps.length - kept.length} sensitive field(s)`);
      }
      p.steps = kept;
      a.effect = `${a.effect} It stops before submitting; sending needs a second approval.`;
    }
    a.status = "awaiting";
  }
  return log;
}
