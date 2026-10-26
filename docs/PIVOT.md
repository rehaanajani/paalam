# Pointing Paalam at a new problem

Paalam's engine doesn't depend on the problem it's solving. Argon splits messy input, Gems verify with tools, the trust layer checks every claim, and actions wait for approval. What changes between problems is the **mission**, the **Gems** and the **knowledge**. None of those need code.

## In about ten minutes

1. **Settings → Mission.** Paste the new problem statement word for word and save. Every Argon and Gem prompt now starts from it.
2. **Draft Gems for this statement.** Argon proposes up to four specialist Gems with the right tools. Untick any you don't want, then add the rest.
3. **Switch off Gems that don't fit** under *Built-in Gems* (for example Flood Rescue for an education problem). They come back with one tick.
4. **Rewrite the home screen** on the same page: headline, Argon's introduction, three suggested messages that show the new problem. Untick the flood-night demo if it no longer fits.
5. **Add knowledge.** Drop official Markdown or text into `knowledge/` (guidelines, scheme rules, FAQs). Gems cite it through `knowledge_search`.
6. **Try the suggestions.** Check that each one routes to the right Gem and that facts show as verified.

## When you need more than that

| Need | Where | Effort |
|---|---|---|
| A new data source (an API, a portal, a dataset) | A tool in `plugins/tools/*.ts` ([PLUGINS.md](PLUGINS.md)) | ~15 min |
| A Gem you want in the repo, not just on this machine | `plugins/gems/*.json` | ~5 min |
| Different rules for how Argon routes | `server/harness/argon.md` (hot-reloaded) | ~5 min |
| A different default mission for everyone who installs it | `mission.json` in the repo root | ~2 min |
| A new kind of action (beyond call, navigate, share, form-fill…) | `server/schemas.ts` + `server/execute.ts` + `web/components/ActionCard.tsx` | ~45 min |

## What stays the same whatever the problem

- Messy input of any kind: voice, photos, PDFs, forwards, any language
- Verified-or-flagged facts (the trust layer), masking before sharing, the injection shield
- Approvals before anything happens, reminders and follow-ups, Bridges that remember
- Simple mode for elders, Telegram, the desktop app, Android, the one-command install
- Tests (`npm test`) and CI on every push

## Undo

**Settings → Mission → Reset to default** goes back to the repo's `mission.json`. Gems you added stay until you delete them under **Settings → Gems**.
