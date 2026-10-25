import express from "express";
import multer from "multer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config, integrationStatus, live } from "./config.js";
import { draftGem, newRun, runBridge, saveGem } from "./argon.js";
import { execute } from "./execute.js";
import { gems } from "./gems/registry.js";
import { publicTools } from "./tools/index.js";
import { allNotes, budget, removeNote, resetNotes } from "./harness/index.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { sampleEvidence, sampleText } from "./demo/scenario.js";
import type { Evidence, Run, RunEvent } from "./types.js";

const app = express();
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 8 } });

// ── Run store (in memory; Firestore slot in docs/ARCHITECTURE.md) ──
const runs = new Map<string, Run>();
const history = new Map<string, RunEvent[]>();
const listeners = new Map<string, Set<(e: RunEvent) => void>>();

function start(run: Run) {
  runs.set(run.id, run);
  history.set(run.id, []);
  const emit = (e: RunEvent) => {
    history.get(run.id)!.push(e);
    for (const l of listeners.get(run.id) ?? []) l(e);
  };
  void runBridge(run, emit);
  return run.id;
}

/** What the browser gets: no raw file bytes. */
const publicRun = (r: Run) => ({ ...r, input: { ...r.input, evidence: r.input.evidence.map(({ data, ...e }) => ({ ...e, hasData: !!data })) } });

const kindOf = (mime: string): Evidence["kind"] =>
  mime.startsWith("image/") ? "image" : mime.startsWith("audio/") || mime === "video/webm" ? "audio" : mime === "application/pdf" ? "pdf" : mime.startsWith("text/") ? "text" : "other";

// ── Routes ─────────────────────────────────────────────────────
app.get("/api/status", (_req, res) => {
  res.json({ demo: !live.gemini, integrations: integrationStatus(), city: config.city, numbers: config.numbers, sample: { text: sampleText, evidence: sampleEvidence.map(({ id, name, kind }) => ({ id, name, kind })) } });
});

app.get("/api/tools", (_req, res) => res.json(publicTools()));

app.get("/api/gems", (_req, res) => res.json(gems.all()));
app.post("/api/gems/draft", async (req, res) => {
  try {
    res.json(await draftGem(String(req.body?.description ?? "")));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
app.post("/api/gems", (req, res) => {
  try {
    res.json(saveGem(req.body, "user"));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.delete("/api/gems/:id", (req, res) => {
  gems.remove(req.params.id);
  res.json({ ok: true });
});

const here = dirname(fileURLToPath(import.meta.url));
app.get("/api/harness", (_req, res) => {
  res.json({
    playbooks: { argon: readFileSync(join(here, "harness/argon.md"), "utf8"), gem: readFileSync(join(here, "harness/gem.md"), "utf8") },
    notes: allNotes(),
    budget,
  });
});
app.delete("/api/harness/notes/:agent/:index", (req, res) => {
  removeNote(req.params.agent, Number(req.params.index));
  res.json({ ok: true });
});
app.delete("/api/harness/notes", (_req, res) => {
  resetNotes();
  res.json({ ok: true });
});

app.post("/api/runs", upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const text = String(req.body?.text ?? "").slice(0, 8000);
  if (!live.gemini) {
    // Without Gemini only the scripted scenario can run; say so in the trail.
    const run = newRun(sampleText, structuredClone(sampleEvidence), true);
    run.audit.push({ at: new Date().toISOString(), who: "harness", what: "Demo mode: no Gemini key yet, so the built-in Chennai scenario is shown instead of your input." });
    return res.json({ id: start(run) });
  }
  const evidence: Evidence[] = files.map((f, i) => {
    const kind = kindOf(f.mimetype);
    return kind === "text"
      ? { id: `E${i + 1}`, kind, name: f.originalname, mimeType: f.mimetype, text: f.buffer.toString("utf8").slice(0, 8000) }
      : { id: `E${i + 1}`, kind, name: f.originalname, mimeType: f.mimetype, data: f.buffer.toString("base64") };
  });
  if (!text && !evidence.length) return res.status(400).json({ error: "Send a message, a recording or a file." });
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : undefined;
  res.json({ id: start(newRun(near ? `${text}\n(Device location: ${lat.toFixed(5)}, ${lng.toFixed(5)})` : text, evidence, false, near)) });
});

app.post("/api/runs/sample", (_req, res) => {
  res.json({ id: start(newRun(sampleText, structuredClone(sampleEvidence), !live.gemini)) });
});

app.get("/api/runs", (_req, res) => {
  res.json([...runs.values()].reverse().slice(0, 30).map((r) => ({ id: r.id, createdAt: r.createdAt, headline: r.headline, stage: r.stage, demo: r.demo })));
});

app.get("/api/runs/:id", (req, res) => {
  const run = runs.get(req.params.id);
  run ? res.json(publicRun(run)) : res.status(404).json({ error: "No such run" });
});

app.get("/api/runs/:id/events", (req, res) => {
  const id = req.params.id;
  if (!runs.has(id)) return res.status(404).end();
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (e: RunEvent) => res.write(`data: ${JSON.stringify(e.type === "done" ? { ...e, data: publicRun(e.data as Run) } : e)}\n\n`);
  for (const e of history.get(id) ?? []) send(e);
  const set = listeners.get(id) ?? new Set();
  set.add(send);
  listeners.set(id, set);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(ping);
    set.delete(send);
  });
});

app.post("/api/runs/:id/actions/:actionId", async (req, res) => {
  const run = runs.get(req.params.id);
  const action = run?.results.flatMap((r) => r.actions).find((a) => a.id === req.params.actionId);
  if (!run || !action) return res.status(404).json({ error: "No such action" });
  if (action.status !== "awaiting") return res.status(409).json({ error: `Already ${action.status}` });
  const at = new Date().toISOString();
  action.decidedAt = at;
  action.decidedBy = "you";
  if (!req.body?.approve) {
    action.status = "declined";
    run.audit.push({ at, who: "you", what: `Declined: ${action.title}` });
    return res.json({ action });
  }
  action.status = "approved";
  run.audit.push({ at, who: "you", what: `Approved: ${action.title}` });
  try {
    const out = await execute(action, run);
    action.status = out.ok ? "done" : "failed";
    action.result = out.result;
    run.audit.push({ at: new Date().toISOString(), who: action.gemId, what: out.result });
    res.json({ action, client: out.client });
  } catch (e) {
    action.status = "failed";
    action.result = (e as Error).message;
    res.status(500).json({ action, error: action.result });
  }
});

// ── Web app (production build) ─────────────────────────────────
const dist = join(process.cwd(), "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

app.listen(config.port, () => {
  const on = integrationStatus().filter((i) => i.live).map((i) => i.id);
  console.log(`Paalam on http://localhost:${config.port}  ·  ${live.gemini ? "live" : "DEMO mode"}  ·  live: ${on.join(", ") || "none"}`);
});
