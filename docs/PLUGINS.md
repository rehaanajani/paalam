# Writing a Paalam plugin

Paalam is built so anyone can teach it a new skill without touching its core. There are two kinds of plugin, and both are single files:

| You want to… | Add a file to | It becomes |
|---|---|---|
| Give Paalam a new **capability** (call an API, check a database, look something up) | `plugins/tools/<name>.ts` | A tool any Gem can be allowed to use |
| Give Paalam a new **specialist** (a domain, a kind of problem) | `plugins/gems/<name>.json` | A Gem with its own chat, which Argon can route to |

Plugins load when the server starts, or when you press **Settings → Plugins → Reload**. A broken plugin is listed with its error; it never stops Paalam.

---

## A tool

```ts
// plugins/tools/pincode.ts
import type { ToolDef } from "../../server/tools/index.js";

const tool: Partial<ToolDef> = {
  id: "pincode_lookup",                 // snake_case, unique
  name: "PIN code lookup",              // shown in the UI
  group: "Maps",                        // groups tools in Gem Studio
  description: "Turn a 6-digit Indian PIN code into its district and state.", // the Gem reads this to decide when to call it
  args: '{ "pin": string }',            // the Gem reads this to know what to pass
  needs: "none (public India Post API)",// shown on the Keys screen
  live: () => true,                     // false → the UI marks it DEMO
  async run({ pin }, ctx) {
    // ctx.evidence: everything the person sent · ctx.near: best-known location
    return { ok: true, demo: false, summary: "600042: Chennai, Tamil Nadu", data: { district: "Chennai" } };
  },
};
export default tool;
```

**Rules a tool must follow**

- `summary` is one or two sentences: that's what the Gem and the person see. Put details in `data`; it is trimmed before it goes back to a model.
- Return `ok: false` with a reason instead of throwing, when you can.
- If you return sample data because a key is missing, set `demo: true`. The UI labels it. Never pass sample data off as real.
- Don't fetch arbitrary URLs yourself; use `readUrl` from `server/browser/index.ts`, which refuses private and local addresses.
- A plugin can't replace a built-in tool.

**Verification comes free.** When a Gem cites your tool call (T1, T2…) for a fact and your tool returned `ok: true`, the trust layer lets that fact show as *Verified by pincode_lookup*. If your tool fails, the fact stays unverified.

---

## A Gem

```json
{
  "id": "paperwork",
  "name": "Paperwork Helper",
  "purpose": "Government schemes, certificates, forms and applications.",
  "instructions": "What to extract → which tools to verify with → which actions to propose.",
  "tools": ["search_web", "read_url", "browse", "pincode_lookup", "redact"],
  "color": "#0ea5e9",
  "model": "gem"
}
```

- `purpose` is one line. **Argon routes on it**, so say what kinds of messages belong here.
- `instructions` follow the pattern every starter Gem uses: *extract → verify with tools → propose actions*. Keep them under about 150 words. The shared playbook (`server/harness/gem.md`) already covers facts, citations, safety and output format.
- `tools` may list built-in tools and plugin tools. Unknown tools are ignored and reported.
- `model`: `"gem"` (fast, default) or `"argon"` (slower, smarter).
- Plugin Gems can't be edited in the UI; edit the file and reload.

---

## Actions your Gem can propose

`navigate` · `call` · `sms` · `share` · `request` · `alert` · `readback` · `warn` · `browser_fill`

Every action is a card a human approves. `browser_fill` opens a page, fills the fields you name (using the labels the `browse` tool reported) and **stops before submitting**. Submitting is a second card. Paalam never fills passwords, OTPs, PINs or card details, whatever the plugin asks.

## Ideas

Ration-card status · bus and train times · blood-bank stock · crop prices (Agmarknet) · school admissions · pension status · power-cut notices · disaster alerts (NDMA/SACHET) · hospital bed availability · legal-aid clinics.
