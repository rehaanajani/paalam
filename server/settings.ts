import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_DIR } from "./paths.js";
import type { ModelTier } from "./types.js";

/** Settings people change from the app, without restarting. Saved in DATA_DIR/settings.json. */
export interface Settings {
  /** Which model splits and routes each message: the fast Gem model, or Argon. */
  router: ModelTier;
}

const FILE = join(DATA_DIR, "settings.json");
const defaults: Settings = { router: process.env.ROUTER === "argon" ? "argon" : "gem" };

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
    current = { ...current, ...patch };
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(current, null, 2));
    return current;
  },
};
