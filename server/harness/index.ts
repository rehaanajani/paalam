import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GemDef } from "../types.js";
import { DATA_DIR } from "../paths.js";

/**
 * The harness: the playbooks every model call starts from, the token budget it
 * runs under, and the notes models have added to their own playbooks.
 *
 * It is deliberately not rigid. Playbooks are Markdown you can edit while the
 * server runs, and models may append short rules (harnessNote). Notes can add
 * guidance but never remove the fixed safety rules: anything that tries is refused.
 */

const here = dirname(fileURLToPath(import.meta.url));
const NOTES_FILE = join(DATA_DIR, "harness-notes.json");
const MAX_NOTES = 8;
const MAX_NOTE_CHARS = 200;

// ── Playbooks (hot-reloaded on edit) ───────────────────────────
const cache = new Map<string, { mtime: number; text: string }>();
function playbook(name: "argon" | "gem") {
  const file = join(here, `${name}.md`);
  const mtime = statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.text;
  const text = readFileSync(file, "utf8");
  cache.set(file, { mtime, text });
  return text;
}

// ── Self-written notes ─────────────────────────────────────────
export interface HarnessNote {
  text: string;
  addedAt: string;
  runId: string;
}
type NoteBook = Record<string, HarnessNote[]>;

let notes: NoteBook = {};
try {
  if (existsSync(NOTES_FILE)) notes = JSON.parse(readFileSync(NOTES_FILE, "utf8"));
} catch {
  notes = {};
}
const save = () => {
  mkdirSync(dirname(NOTES_FILE), { recursive: true });
  writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
};

// A note may add guidance; it may not switch off verification, approval or redaction.
const forbidden = /(ignore|skip|disable|bypass|remove|no need|don'?t|never)\b.{0,30}\b(approv|verif|redact|mask|safety|rule|trust|human)|always\s+(mark|set)\b.{0,20}verified|invent|make up/i;

export function addNote(agent: string, raw: string | undefined, runId: string): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 8) return null;
  if (text.length > MAX_NOTE_CHARS) return `Refused a ${agent} note: longer than ${MAX_NOTE_CHARS} characters`;
  if (forbidden.test(text)) return `Refused a ${agent} note that tried to weaken a safety rule: "${text}"`;
  const list = (notes[agent] ??= []);
  const norm = text.toLowerCase();
  if (list.some((n) => n.text.toLowerCase() === norm)) return null;
  list.push({ text, addedAt: new Date().toISOString(), runId });
  if (list.length > MAX_NOTES) list.shift(); // oldest note retires first
  save();
  return `${agent} added a playbook note: "${text}"`;
}

export function removeNote(agent: string, index: number) {
  notes[agent]?.splice(index, 1);
  save();
}
export function resetNotes(agent?: string) {
  if (agent) delete notes[agent];
  else notes = {};
  save();
}
export const allNotes = () => notes;

const renderNotes = (agent: string) => {
  const list = notes[agent] ?? [];
  return list.length ? `\n\n## Notes learned from earlier runs\n${list.map((n) => `- ${n.text}`).join("\n")}` : "";
};

// ── System prompts ─────────────────────────────────────────────
export function argonSystem() {
  return playbook("argon") + renderNotes("argon");
}

export function gemSystem(gem: GemDef) {
  return `${playbook("gem")}${renderNotes("gems")}\n\n---\n# You are the "${gem.name}" Gem\n${gem.instructions}${renderNotes(`gem:${gem.id}`)}`;
}

// ── Token budget ───────────────────────────────────────────────
const num = (k: string, d: number) => {
  const v = process.env[k];
  return v === undefined || v === "" ? d : Number(v);
};

export const budget = {
  /** Hard ceiling for one run, across every call. Past it, Gems finish without a second pass. */
  perRun: num("RUN_TOKEN_BUDGET", 60000),
  argon: {
    thinking: num("ARGON_THINKING_BUDGET", 512),
    maxOutput: num("ARGON_MAX_OUTPUT", 2048),
    media: "MEDIA_RESOLUTION_LOW" as const, // routing needs gist, not detail
  },
  gem: {
    thinking: num("GEM_THINKING_BUDGET", 0),
    maxOutput: num("GEM_MAX_OUTPUT", 6144),
    media: "MEDIA_RESOLUTION_MEDIUM" as const, // reading prescriptions needs detail
  },
  /** Short text-only input is routed by the fast model instead of Argon's. */
  downshiftChars: num("ROUTER_DOWNSHIFT_CHARS", 0),
  /** A tool call that takes longer than this is dropped and the Gem carries on. */
  toolTimeoutMs: num("TOOL_TIMEOUT_MS", 8000),
  /** Tool data passed back to a Gem is trimmed to this many characters per call. */
  toolDataChars: num("TOOL_DATA_CHARS", 600),
};

// ── Usage meter ────────────────────────────────────────────────
export interface UsageStep {
  step: string;
  model: string;
  input: number;
  output: number;
  thinking: number;
  ms: number;
}
export interface Usage {
  calls: number;
  input: number;
  output: number;
  thinking: number;
  total: number;
  budget: number;
  steps: UsageStep[];
}

export const newUsage = (): Usage => ({ calls: 0, input: 0, output: 0, thinking: 0, total: 0, budget: budget.perRun, steps: [] });

export function record(u: Usage, s: UsageStep) {
  u.calls++;
  u.input += s.input;
  u.output += s.output;
  u.thinking += s.thinking;
  u.total = u.input + u.output + u.thinking;
  u.steps.push(s);
}

export const overBudget = (u: Usage) => u.total >= u.budget;
