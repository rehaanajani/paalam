# Paalam · பாலம்

**Send anything. Get verified action.**

Paalam is a Gemini-powered bridge between people in a crisis and the systems that can help them. Drop in a panicked Tamil voice note, a photo of a flooded street, a crumpled prescription and a forwarded "₹5000 relief" message, all at once. **Argon** splits the chaos into separate problems, routes each to a specialist **Gem**, the Gems check every claim with Google's tools, a deterministic **trust layer** decides what may be called verified, and **you approve** every action.

Built for PromptWars x ACM SRM (Societal Benefit). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it

```bash
npm install
cp .env.example .env     # fill in whatever keys you have; blanks run in DEMO mode
npm run build
npm start                # http://localhost:8080
```

For development with hot reload: `npm run dev` (web on :5173, API on :8080).

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
