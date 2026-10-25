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
import { loadPlugins, pluginReports } from "./plugins.js";
import { practiceRoutes } from "./practice.js";
import { getShot, browserAvailable } from "./browser/index.js";
import { allowPractice } from "./browser/net.js";
import { store } from "./store.js";
import { allIncidents, recordRun, setIncidents } from "./incidents.js";
import { checkModels, keepWarm } from "./gemini.js";
import { settings } from "./settings.js";
import { chatModels } from "./models.js";
import { addPushSubscription, pushKey, reminderStore, startReminderClock } from "./reminders.js";
import { gems as gemRegistry } from "./gems/registry.js";
import { ensureVectors, loadKnowledge } from "./knowledge.js";
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
    if (e.type === "done" || e.type === "error") void settle(run);
  };
  void runBridge(run, emit);
  return run.id;
}

/** What was said earlier in a Bridge, condensed, so Argon and the Gems remember the conversation. */
function threadHistory(threadId?: string) {
  if (!threadId) return undefined;
  const earlier = [...runs.values()].filter((r) => r.threadId === threadId && r.stage === "done").slice(-4);
  if (!earlier.length) return undefined;
  const lines: string[] = [];
  for (const r of earlier) {
    if (r.input.text) lines.push(`Person: ${r.input.text.replace(/\n\(Device location:[^)]*\)$/, "").slice(0, 300)}`);
    if (r.reply) lines.push(`Argon: ${r.reply.slice(0, 300)}`);
    for (const x of r.results) {
      const name = gemRegistry.get(x.gemId)?.name ?? x.gemId;
      lines.push(`${name}: ${(x.reply || x.summary).slice(0, 350)}${x.plan ? ` [plan: ${x.plan.title}]` : ""}${x.reminders?.length ? ` [${x.reminders.length} reminder(s) set]` : ""}`);
    }
  }
  return lines.join("\n").slice(-2400);
}

/** A finished run is saved and joins the incident index for similar-report matching. */
async function settle(run: Run) {
  if (run.stage === "done") {
    await recordRun(run).catch(() => {});
    void store.saveIncidents(allIncidents());
  }
  void store.saveRun(run);
}

/** What the browser gets: no raw file bytes. */
const publicRun = (r: Run) => ({ ...r, input: { ...r.input, evidence: r.input.evidence.map(({ data, ...e }) => ({ ...e, hasData: !!data })) } });

const kindOf = (mime: string): Evidence["kind"] =>
  mime.startsWith("image/") ? "image" : mime.startsWith("audio/") || mime === "video/webm" ? "audio" : mime === "application/pdf" ? "pdf" : mime.startsWith("text/") ? "text" : "other";

// ── Routes ─────────────────────────────────────────────────────
practiceRoutes(app);
allowPractice(config.port);

app.get("/api/shots/:id", (req, res) => {
  const shot = getShot(req.params.id);
  shot ? res.type(shot.type).set("cache-control", "private, max-age=3600").send(shot.png) : res.status(404).end();
});

app.get("/api/plugins", (_req, res) => res.json({ reports: pluginReports(), browser: browserAvailable() }));
app.post("/api/plugins/reload", async (_req, res) => {
  res.json({ reports: await loadPlugins() });
});
app.get("/api/status", (_req, res) => {
  res.json({ demo: !live.gemini, envFile: process.env.PAALAM_ENV_FILE || join(process.cwd(), ".env"), integrations: integrationStatus(), city: config.city, numbers: config.numbers, sample: { text: sampleText, evidence: sampleEvidence.map(({ id, name, kind }) => ({ id, name, kind })) } });
});

app.get("/api/tools", (_req, res) => res.json(publicTools()));

// ── Reminders and notifications ──
app.get("/api/reminders", (req, res) => res.json(reminderStore.list(req.query.threadId ? String(req.query.threadId) : undefined)));
app.patch("/api/reminders/:id", (req, res) => {
  const r = reminderStore.update(req.params.id, { active: !!req.body?.active });
  r ? res.json(r) : res.status(404).json({ error: "No such reminder" });
});
app.delete("/api/reminders/:id", (req, res) => {
  reminderStore.remove(req.params.id);
  res.json({ ok: true });
});
app.get("/api/notifications", (_req, res) => res.json(reminderStore.notices().slice(-30).reverse()));
app.get("/api/notifications/stream", (req, res) => {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const off = reminderStore.subscribe((n) => res.write(`data: ${JSON.stringify(n)}\n\n`));
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(ping);
    off();
  });
});
app.get("/api/push/key", (_req, res) => res.json({ key: pushKey() }));
app.post("/api/push/subscribe", (req, res) => {
  try {
    addPushSubscription(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get("/api/models", async (_req, res) => res.json(await chatModels()));

app.get("/api/settings", (_req, res) => res.json({ ...settings.get(), models: { gem: config.gemini.gemModel, argon: config.gemini.argonModel } }));
app.put("/api/settings", (req, res) => {
  try {
    res.json(settings.update(req.body ?? {}));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

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
  const threadId = String(req.body?.threadId ?? "") || undefined;
  const target = String(req.body?.gemId ?? "") || undefined;
  if (!live.gemini) {
    // Without Gemini only the scripted scenario can run; say so in the trail.
    const run = newRun(sampleText, structuredClone(sampleEvidence), true, { threadId, target });
    run.audit.push({ at: new Date().toISOString(), who: "harness", what: "Demo mode: no Gemini key yet, so the built-in Chennai scenario is shown instead of your input." });
    return res.json({ id: start(run), threadId: run.threadId });
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
  const tz = String(req.body?.tz ?? "") || undefined;
  const run = newRun(near ? `${text}\n(Device location: ${lat.toFixed(5)}, ${lng.toFixed(5)})` : text, evidence, false, { near, threadId, target, tz, history: threadHistory(threadId) });
  res.json({ id: start(run), threadId: run.threadId });
});

app.post("/api/runs/sample", (req, res) => {
  const run = newRun(sampleText, structuredClone(sampleEvidence), !live.gemini, { threadId: req.body?.threadId, target: req.body?.gemId });
  res.json({ id: start(run), threadId: run.threadId });
});

// A Bridge is a conversation: every run sent into it, oldest first.
app.get("/api/threads", (_req, res) => {
  const byThread = new Map<string, Run[]>();
  for (const r of runs.values()) byThread.set(r.threadId, [...(byThread.get(r.threadId) ?? []), r]);
  res.json(
    [...byThread.entries()]
      .map(([id, list]) => {
        const last = list[list.length - 1]!;
        return {
          id,
          title: list[0]!.headline ?? "Reading…",
          target: list[0]!.target ?? null,
          gems: [...new Set(list.flatMap((r) => r.fragments.map((f) => f.gemId)))],
          updatedAt: last.createdAt,
          runs: list.length,
          working: list.some((r) => !["done", "error"].includes(r.stage)),
          awaiting: list.reduce((n, r) => n + r.results.reduce((m, x) => m + x.actions.filter((a) => a.status === "awaiting").length, 0), 0),
          demo: last.demo,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40),
  );
});

app.get("/api/threads/:id", (req, res) => {
  const list = [...runs.values()].filter((r) => r.threadId === req.params.id);
  list.length ? res.json(list.map(publicRun)) : res.status(404).json({ error: "No such bridge" });
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
    void store.saveRun(run);
    return res.json({ action });
  }
  action.status = "approved";
  run.audit.push({ at, who: "you", what: `Approved: ${action.title}` });
  try {
    const out = await execute(action, run);
    action.status = out.ok ? "done" : "failed";
    action.result = out.result;
    if (out.shotId) action.shotId = out.shotId;
    run.audit.push({ at: new Date().toISOString(), who: action.gemId, what: out.result });
    void store.saveRun(run);
    if (out.followUp) {
      const result = run.results.find((r) => r.actions.includes(action));
      result?.actions.splice(result.actions.indexOf(action) + 1, 0, out.followUp);
    }
    res.json({ action, client: out.client, followUp: out.followUp });
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

await loadPlugins();
loadKnowledge();
void ensureVectors().catch((e) => console.warn("Knowledge indexing failed:", (e as Error).message.slice(0, 120)));
for (const r of await store.loadRuns()) {
  // A run cut off by a restart can't resume; mark it rather than leave it spinning.
  if (!["done", "error"].includes(r.stage)) Object.assign(r, { stage: "error", error: "Interrupted by a server restart. Send it again." });
  runs.set(r.id, r);
  history.set(r.id, []);
}
setIncidents(await store.loadIncidents());
void checkModels();
keepWarm();
startReminderClock();
// Started by the desktop app: exit if the app is gone, so no orphaned server keeps running.
if (process.env.PAALAM_PARENT_PID) {
  const parent = Number(process.env.PAALAM_PARENT_PID);
  setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      process.exit(0);
    }
  }, 5000).unref();
}
app.listen(config.port, () => {
  const on = integrationStatus().filter((i) => i.live).map((i) => i.id);
  console.log(`Paalam on http://localhost:${config.port}  ·  ${live.gemini ? "live" : "DEMO mode"}  ·  live: ${on.join(", ") || "none"}  ·  ${runs.size} saved run(s) (${store.engine()})`);
});
