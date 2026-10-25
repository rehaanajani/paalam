import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { gems } from "./gems/registry.js";
import { registerTool, toolRegistry, type ToolDef } from "./tools/index.js";
import type { GemDef } from "./types.js";

/**
 * Drop-in plugins. Anyone can extend Paalam without touching the core:
 *   plugins/tools/<name>.ts  – default-export a tool (see plugins/tools/pincode.ts)
 *   plugins/gems/<name>.json – a Gem: name, purpose, instructions, tools
 * Tools load first so Gems can use them. A broken plugin is reported, never fatal.
 */

export interface PluginReport {
  kind: "tool" | "gem";
  file: string;
  id?: string;
  ok: boolean;
  error?: string;
}

const DIR = join(process.cwd(), "plugins");
let reports: PluginReport[] = [];
export const pluginReports = () => reports;

const palette = ["#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#0ea5e9"];

export async function loadPlugins() {
  reports = [];
  const toolDir = join(DIR, "tools");
  if (existsSync(toolDir))
    for (const file of readdirSync(toolDir).filter((f) => /\.(ts|js|mjs)$/.test(f) && !f.endsWith(".d.ts")).sort()) {
      try {
        // Cache-bust so a reload picks up edits.
        const mod = await import(`${pathToFileURL(join(toolDir, file)).href}?v=${Date.now()}`);
        const t = (mod.default ?? mod.tool) as Partial<ToolDef>;
        if (!t || typeof t.run !== "function" || !t.id || !/^[a-z][a-z0-9_]{1,40}$/.test(t.id)) throw new Error("Default export must be a tool with an id (snake_case) and run()");
        registerTool({
          name: t.id,
          group: "Plugin",
          description: "",
          args: "{}",
          needs: "plugin",
          live: () => true,
          ...t,
        } as ToolDef);
        reports.push({ kind: "tool", file: `plugins/tools/${file}`, id: t.id, ok: true });
      } catch (e) {
        reports.push({ kind: "tool", file: `plugins/tools/${file}`, ok: false, error: (e as Error).message });
      }
    }

  const gemDir = join(DIR, "gems");
  const loaded: GemDef[] = [];
  if (existsSync(gemDir))
    for (const file of readdirSync(gemDir).filter((f) => f.endsWith(".json")).sort()) {
      try {
        const g = JSON.parse(readFileSync(join(gemDir, file), "utf8"));
        const id = String(g.id ?? basename(file, ".json")).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
        if (!g.name || !g.purpose || !g.instructions) throw new Error("A Gem needs name, purpose and instructions");
        const tools: string[] = Array.isArray(g.tools) ? g.tools : [];
        const missing = tools.filter((t) => !toolRegistry.has(t));
        loaded.push({
          id,
          name: String(g.name),
          purpose: String(g.purpose),
          instructions: String(g.instructions),
          tools: tools.filter((t) => toolRegistry.has(t)),
          model: g.model === "argon" ? "argon" : "gem",
          color: typeof g.color === "string" ? g.color : palette[loaded.length % palette.length]!,
          origin: "plugin",
          createdAt: new Date().toISOString(),
        });
        reports.push({ kind: "gem", file: `plugins/gems/${file}`, id, ok: true, ...(missing.length ? { error: `Unknown tools ignored: ${missing.join(", ")}` } : {}) });
      } catch (e) {
        reports.push({ kind: "gem", file: `plugins/gems/${file}`, ok: false, error: (e as Error).message });
      }
    }
  gems.setPlugins(loaded);
  const bad = reports.filter((r) => !r.ok).length;
  console.log(`Plugins: ${reports.length - bad} loaded${bad ? `, ${bad} failed` : ""}`);
  return reports;
}
