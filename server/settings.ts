import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_DIR } from "./paths.js";
import type { ModelTier } from "./types.js";

/** Settings people change from the app, without restarting. Saved in DATA_DIR/settings.json. */
export interface Settings {
  /** Which model splits and routes each message: the fast Gem model, or Argon. */
  router: ModelTier;
  /** A model chosen for a Gem in its chat's model picker, by Gem id. */
  gemModels: Record<string, string>;
}

const FILE = join(DATA_DIR, "settings.json");
const defaults: Settings = { router: process.env.ROUTER === "argon" ? "argon" : "gem", gemModels: {} };

let current: Settings = { ...defaults };
try {
  if (existsSync(FILE)) current = { ...defaults, ...JSON.parse(readFileSync(FILE, "utf8")) };
} catch {
  current = { ...defaults };
}

export const settings = {
  get: () => current,
  update(patch: Partial<Settings>) {
    if (patch.router && patch.router !== "gem" && patch.router !== "argon") throw new Error("router must be gem or argon");
    if (patch.gemModels && typeof patch.gemModels !== "object") throw new Error("gemModels must be an object");
    current = { ...current, ...patch, gemModels: { ...current.gemModels, ...(patch.gemModels ?? {}) } };
    for (const [k, v] of Object.entries(current.gemModels)) if (!v) delete current.gemModels[k];
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(current, null, 2));
    return current;
  },
};
