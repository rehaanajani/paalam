import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "./paths.js";

/**
 * The mission: the problem Paalam is pointed at. Every Argon and Gem prompt starts
 * from it, and the home screen shows its wording. Pivoting to a new problem means
 * editing this (Settings → Mission), not the code. The repo's mission.json is the
 * default; edits are saved in DATA_DIR and win over it.
 */
export interface Mission {
  /** the problem statement, word for word */
  statement: string;
  headline: string;
  headlineAccent: string;
  welcome: string;
  suggestions: string[];
  /** show the scripted flood-night demo button */
  showDemo: boolean;
  /** starter and plugin Gems switched off for this mission */
  hiddenGems: string[];
}

const DEFAULT_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "mission.json");
const FILE = join(DATA_DIR, "mission.json");

const fallback: Mission = { statement: "", headline: "Send anything.", headlineAccent: "Get verified action.", welcome: "", suggestions: [], showDemo: false, hiddenGems: [] };

function read(file: string): Partial<Mission> {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  } catch {
    return {};
  }
}

const defaults = (): Mission => ({ ...fallback, ...read(DEFAULT_FILE) });
let current: Mission = { ...defaults(), ...read(FILE) };

/** Keeps only known fields of the right type, so a bad edit can't break prompts or the UI. */
export function cleanMission(patch: Record<string, unknown>): Partial<Mission> {
  const out: Partial<Mission> = {};
  for (const k of ["statement", "headline", "headlineAccent", "welcome"] as const) if (typeof patch[k] === "string") out[k] = (patch[k] as string).slice(0, 4000);
  if (Array.isArray(patch.suggestions)) out.suggestions = patch.suggestions.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.slice(0, 300)).slice(0, 6);
  if (Array.isArray(patch.hiddenGems)) out.hiddenGems = patch.hiddenGems.filter((s): s is string => typeof s === "string");
  if (typeof patch.showDemo === "boolean") out.showDemo = patch.showDemo;
  return out;
}

export const mission = {
  get: () => current,
  update(patch: Record<string, unknown>) {
    current = { ...current, ...cleanMission(patch) };
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(current, null, 2));
    return current;
  },
  /** Back to the repo's mission.json. */
  reset() {
    current = defaults();
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(current, null, 2));
    return current;
  },
};

/** The section every prompt starts with. Empty when no statement is set. */
export const missionBrief = () => (current.statement.trim() ? `## The mission\nEverything you do serves this problem statement:\n> ${current.statement.trim().replace(/\n/g, "\n> ")}\n\n` : "");
