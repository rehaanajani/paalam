# Contributing to Paalam

Thanks for helping build the bridge.

## The fastest way to help: a plugin

Most useful contributions are a new tool or a new Gem, and both are single files. Read [docs/PLUGINS.md](docs/PLUGINS.md), add your file under `plugins/`, and open a pull request.

## Working on the core

```bash
npm install
cp .env.example .env     # blanks run in DEMO mode
npm run dev              # web on :5173, API on :8080
npm run typecheck
```

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Ground rules

These hold for every change, core or plugin:

1. **Nothing happens without a human.** Every outward action is a card someone approves.
2. **The model doesn't verify itself.** Only a successful tool result can make a fact "verified". That logic lives in `server/trust.ts`, in plain code.
3. **Demo is labelled.** Sample data is marked `demo: true` and shows as DEMO. Never pass it off as real.
4. **Private by default.** Mask Aadhaar, PAN, phone and card numbers before anything is shared. Never fill passwords, OTPs, PINs or card details.
5. **Keys stay on the server.** Nothing secret goes to the browser or into the repo.
6. **No impersonation.** Demo pages and messages must never pose as a real government body or company.

## Pull requests

- Keep each one focused, and explain the problem it solves for a real person.
- Run `npm run typecheck` and `npm run build`.
- For UI changes, include a screenshot in light and dark.
