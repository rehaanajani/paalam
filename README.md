# Paalam · பாலம்

**Send anything. Get verified action.**

Paalam is a Gemini-powered bridge between people in a crisis and the systems that can help them. Drop in a panicked Tamil voice note, a photo of a flooded street, a crumpled prescription and a forwarded "₹5000 relief" message, all at once. **Argon** splits the chaos into separate problems, routes each to a specialist **Gem**, the Gems check every claim with Google's tools, a deterministic **trust layer** decides what may be called verified, and **you approve** every action.

Built for PromptWars x ACM SRM (Societal Benefit). **Everything it can do: [docs/FEATURES.md](docs/FEATURES.md)** · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Install (one command)

**Mac / Linux**: paste in Terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/rehaanajani/paalam/main/scripts/install.sh | bash
```

**Windows**: paste in PowerShell:
```powershell
irm https://raw.githubusercontent.com/rehaanajani/paalam/main/scripts/install.ps1 | iex
```

It checks for [Node.js 20+](https://nodejs.org) and [git](https://git-scm.com) (and tells you what to install if they're missing), downloads Paalam into a `paalam` folder in your home folder, sets it up and opens it at **http://localhost:8080**. Run the same command again to update.

Prefer doing it by hand?
```bash
git clone https://github.com/rehaanajani/paalam.git && cd paalam && npm run setup && npm start
```

Want a desktop window instead? Run `npm run desktop` in the same folder.

To use your own Google Cloud keys, copy `.env.example` to `.env` and follow [docs/KEYS.md](docs/KEYS.md).

For development with hot reload: `npm run dev` (web on :5173, API on :8080).

## Desktop app (macOS)

- `npm run desktop` opens Paalam in its own window. It starts its own server in the background, so there's nothing else to run.
- `npm run install:mac` builds a double-clickable `Paalam.app` with the Argon icon and shows it in Finder: drag it into Applications (choose **Replace** when updating).
- The app never contains keys or data. It reads keys from `~/Library/Application Support/Paalam/.env` and keeps Bridges in `~/Library/Application Support/Paalam/data`, so it can be shared safely. Logs: `~/Library/Logs/Paalam/server.log`.
- It's the same code as the website: a change to `web/` or `server/` reaches both.

**No keys yet?** Everything still works. Click *Try it: a Chennai family's flood-night WhatsApp*. Gemini's answers are scripted for that one scenario, but every tool really runs: add a Maps key and the places, routes and weather become live even in demo mode. Anything on sample data is marked **DEMO** in the UI.

## What's where

The layout follows Socius: a sidebar of living faces, a chat in the middle, settings in a floating dialog.

| Where | What it is |
|---|---|
| **Argon** (featured at the top of the sidebar) | The orchestrator. Send it anything (text, voice, photos, PDFs, your location) and it starts a new Bridge |
| **Bridges** | Your conversations. Each one reads you → Argon → each Gem's findings, with verification badges and sources → action cards to approve → map and audit trail. Add more to the same Bridge from its composer |
| **Gems** | Every specialist has its own chat. Messages there go straight to that Gem, skipping Argon's split |
| **+ / ⌘K** | Jump to Argon, a Gem or a Bridge, or create a Gem |
| **Settings** (bottom left) | General (theme, region), Gems (Gem Studio: describe one and Argon designs it), Harness (playbooks, token budget, self-written notes), Keys (which integrations are live) |

It installs like an app (PWA) on phones and desktops.

## How Gems answer

Each Gem picks the shape the situation needs, not a template:

- **answer**: just talk ("should I train today, I'm exhausted?")
- **plan**: a plan you follow, in sections, plus **follow-ups**: reminders like "06:00 daily: breakfast" or "in 4 hours: check her sugar". They're set automatically (they only notify you) and each can be switched off
- **actions**: real-world steps that need your approval (call, message, rescue request, form filling, a warning poster)

A **Bridge** is one conversation (one situation) and remembers what was said in it. A **Gem** is a specialist. Argon reads each new message, with the Bridge's history, and routes it to any Gem, including ones you made.

Reminders reach you as native notifications in the desktop app, browser notifications or Web Push on the website, and on-device notifications in the Android app ([docs/ANDROID.md](docs/ANDROID.md)).

## Browser

Gems can **read a link** (any public page, as text), **open a page** in a real browser to see its form, and **fill a form you approve**. Filling always stops before Submit; submitting is a second approval. Passwords, OTPs, PINs and card details are never filled, and private or local addresses are refused. Try it in the demo: Scam Shield fills a practice complaint form. Set `PAALAM_BROWSER_HEADFUL=1` to watch the window.

## Google Cloud services it uses

| Service | What Paalam does with it |
|---|---|
| Gemini | Argon's routing, every Gem's reasoning, Google Search grounding |
| Gemini image model | Shareable warning / evacuation / missing-person posters, made only on approval |
| Gemini Embeddings | Knowledge search over `knowledge/`, spotting repeat reports of one incident |
| Maps Platform | Geocoding, Places, Routes, Weather **and official weather alerts**, Air Quality |
| Cloud Vision | Reverse image search: catches old viral photos passed off as new |
| Healthcare Natural Language | Standard names for medicines and conditions in prescriptions |
| Model Armor | Screens forwards and web pages for instructions aimed at the AI |
| Cloud DLP | Masks Aadhaar, PAN, phones, cards before anything is shared |
| Translation, Text-to-Speech | Tamil in and out |
| Firestore | Saves Bridges on Cloud Run |

How to get every key: [docs/KEYS.md](docs/KEYS.md). Each one is optional; without it that piece runs on labelled demo data.

## Plugins

Add a tool (`plugins/tools/*.ts`) or a Gem (`plugins/gems/*.json`) without touching the core. See [docs/PLUGINS.md](docs/PLUGINS.md). Two example Gems (Paperwork Helper, Missing Person Search) and one tool (Indian PIN code lookup) ship in `plugins/`.

## Stack

Node + Express + `@google/genai` · React + Vite · Leaflet (OpenStreetMap) · Google Maps Platform (Places, Routes, Geocoding, Weather, Air Quality) · Cloud DLP · Translation · Text-to-Speech · Safe Browsing · openFDA. Deploys to Cloud Run (`Dockerfile`).

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md).

The living gem faces are ported from Socius's bot avatars: breathing, blinking, glancing, eyes that follow the cursor and circle while working.
