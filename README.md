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

| Screen | What it shows |
|---|---|
| **Home** | Argon and the Gems in orbit; the composer takes text, voice, photos, PDFs and your location |
| **Run** | Live pipeline · what came in · each Gem's facts with verification badges and sources · map · approval queue · audit trail · token usage |
| **Gem Studio** | Describe a Gem and Argon designs it; tick its tools; save |
| **Harness** | Playbooks, token budget, and the rules models have written for themselves |
| **Integrations** | Which keys are live, exactly which env var turns each one on |

It installs like an app (PWA) on phones and desktops.

## Stack

Node + Express + `@google/genai` · React + Vite · Leaflet (OpenStreetMap) · Google Maps Platform (Places, Routes, Geocoding, Weather, Air Quality) · Cloud DLP · Translation · Text-to-Speech · Safe Browsing · openFDA. Deploys to Cloud Run (`Dockerfile`).

The living gem faces are ported from Socius's bot avatars: breathing, blinking, glancing, eyes that follow the cursor and circle while working.
