/**
 * Example plugin tool: look up an Indian PIN code (India Post data, no key needed).
 * Any .ts or .js file in plugins/tools that default-exports a tool is loaded at startup.
 */
import type { ToolDef } from "../../server/tools/index.js";

const tool: Partial<ToolDef> = {
  id: "pincode_lookup",
  name: "PIN code lookup",
  group: "Maps",
  description: "Turn a 6-digit Indian PIN code into its post offices, district and state, or check that an address's PIN matches its area.",
  args: '{ "pin": string }',
  needs: "none (public India Post API)",
  live: () => true,
  async run({ pin }) {
    const code = String(pin ?? "").replace(/\D/g, "");
    if (code.length !== 6) return { ok: false, demo: false, summary: `"${pin}" isn't a 6-digit PIN code` };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, { signal: ctrl.signal });
      const [r] = (await res.json()) as { Status: string; PostOffice: { Name: string; District: string; State: string }[] | null }[];
      const offices = r?.PostOffice ?? [];
      if (!offices.length) return { ok: false, demo: false, summary: `No post offices for PIN ${code}` };
      const { District, State } = offices[0]!;
      return { ok: true, demo: false, summary: `${code}: ${District}, ${State} (${offices.length} post offices, e.g. ${offices.slice(0, 3).map((o) => o.Name).join(", ")})`, data: { pin: code, district: District, state: State, offices: offices.map((o) => o.Name) } };
    } catch (e) {
      return { ok: false, demo: false, summary: `PIN lookup failed: ${(e as Error).message}` };
    } finally {
      clearTimeout(t);
    }
  },
};

export default tool;
