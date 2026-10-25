# What Paalam can do

Everything below works today unless it says otherwise. "Live" means it runs against real Google services with your keys; without keys the same feature runs on clearly labelled demo data.

## 1. Talk to it any way you like

| Feature | How it works | Try it |
|---|---|---|
| **Messy input, all at once** | Type, record a voice note, attach photos, PDFs or text files, share your location: in one message, any language (Tamil, Tanglish, English…) | Paste a WhatsApp forward with a photo and a voice note |
| **Voice notes** | Recorded in the browser as small 16 kHz WAV; Gemini listens to it directly | Mic button in the composer |
| **Photos and documents** | Gemini reads prescriptions, notices and photos; photo metadata (date, GPS) is read first | Attach a prescription photo |
| **Casual chat** | Greetings and general questions get a direct reply from Argon, with no Gems involved | "hi", "what's the capital of France?" |

## 2. Argon, Gems and Bridges

| | What it is |
|---|---|
| **Argon** | The orchestrator. Reads each message (plus the Bridge's history), splits it into separate problems, merges duplicates and sends each to the right Gem. If nothing fits a real problem, it designs a new Gem on the spot. Routes with the fast model by default (~5 s); Settings → General switches routing to `gemini-4-argon` |
| **Gems** | Specialists: instructions + a model + the tools they may use + what they know. Starters: Flood Rescue, Health Guard, Scam Shield, Road Responder. Plugins: Paperwork Helper, Missing Person Search. Plus any you make |
| **Bridges** | One conversation about one situation. They **remember**: earlier messages and answers go to Argon and the Gems. Each message to a Gem's own chat skips Argon |
| **Gem Studio** | Settings → Gems: describe a Gem and Argon designs it, tick its tools, pick fast or Argon model, save |
| **Model picker** | In any Gem's chat: a pill listing every Gemini chat model on your project (4 Argon, 3.8 Flash, 3.1 Pro, 2.5 Pro…). Saved per Gem; if a model fails or hits its quota, the Gem falls back to its default |

## 3. Answers that fit the situation

Each Gem picks the simplest shape that helps:

| Shape | When | Looks like |
|---|---|---|
| **answer** | Advice, explanations, quick questions | A normal chat reply in the Gem's own voice |
| **plan** | Something to follow over time (diet, workout, study, recovery) | Reply + plan in sections + **follow-ups** |
| **actions** | Real-world steps that need approval | Verified facts + approval cards + map |

## 4. Follow-ups and notifications

| Feature | How |
|---|---|
| **Reminders** | Gems set them when useful: "06:00 daily: breakfast", "in 4 hours: check her sugar". Time-zone aware. No approval needed (they only notify you); each has an on/off switch |
| **Desktop app** | Native macOS notifications while Paalam runs, even with the window closed; clicking opens the Bridge |
| **Website** | Browser notification and in-app popup while open; **Web Push** when closed (Chrome, Edge, Firefox; iPhone after "Add to Home Screen") |
| **Android app** | Scheduled on the phone itself, so they fire offline and with the app closed ([ANDROID.md](ANDROID.md)) |

## 5. Verification: Gemini doesn't mark its own homework

| Check | Service |
|---|---|
| Location from messy addresses ("Vijayanagar 3rd main road, Velachery") | Geocoding, double-checked with Places by distance |
| Is it actually raining / any official alert? | Weather API, public alerts (Google doesn't cover India's alerts yet; it says so) |
| Is this photo old or viral? | Photo metadata + **Cloud Vision reverse image search** |
| Is this news/scheme real? | **Google Search grounding** with sources |
| Is this link a scam? | Safe Browsing + Indian scam patterns + "this domain doesn't exist" |
| Medicines and conditions | **Healthcare Natural Language API** + openFDA labels |
| Official guidance | Knowledge base (`knowledge/`, searched with Gemini Embeddings) |
| Same incident reported before? | Similar-report matching across Bridges (Embeddings + distance) |
| **Trust layer** | Plain code after the model: a fact is "verified" only if a successful tool backs it; invented citations, phone numbers and places are flagged |

## 6. Actions you approve

| Action | What happens |
|---|---|
| Call | Opens the phone's dialer with 108 / 112 / 1930 filled in, plus a read-out script. You press call (no app can call by itself) |
| Navigate | Google Maps directions to a verified place |
| Share / SMS | Phone share sheet (WhatsApp…) or copy; Twilio SMS if configured |
| Rescue request | Logged as an incident (simulated: real dispatch needs a control-room API) |
| Read back | Spoken in Tamil (Cloud Text-to-Speech) |
| Poster | **Gemini image model** draws a shareable warning; only for things meant to spread |
| **Browser: fill a form** | Opens the page, fills the fields shown on the card, takes a screenshot and **stops before Submit**; submitting is a second approval. Never fills passwords, OTPs, PINs or card details |

## 7. Safety and privacy

- **Masking**: Aadhaar, PAN, phone, card numbers, names and emails are masked before anything is shared (local Indian patterns + Cloud DLP)
- **Injection shield**: forwards and web pages are screened for text aimed at the AI (Model Armor, or local patterns); flagged text is read as data, never as instructions
- **Private addresses blocked**: the browser and link reader refuse local and private network addresses
- **Keys never reach the browser**; the desktop app keeps keys and data outside the app bundle

## 8. Built to be extended

| | |
|---|---|
| **Plugins** | Drop a tool (`plugins/tools/*.ts`) or a Gem (`plugins/gems/*.json`) in; reload from Settings → Plugins. Guide: [PLUGINS.md](PLUGINS.md) |
| **Knowledge** | Drop Markdown or text into `knowledge/`; Gems cite it |
| **Harness** | Settings → Harness: the playbooks every model follows (editable while running), the token budget, and short rules the models wrote for themselves (they can't weaken safety rules) |

## 9. Runs everywhere

| | |
|---|---|
| Website / PWA | `npm start` → http://localhost:8080; installable on phones |
| Desktop app | `npm run desktop`, or `npm run install:mac` for a double-clickable Paalam.app |
| Android app | Build-ready in `android/` (Capacitor): `PAALAM_SERVER_URL=… npm run android:apk` |
| Cloud Run | `Dockerfile` + deploy steps in [KEYS.md](KEYS.md) |
| One-command install | See the README (Mac, Linux, Windows) |

## Not done yet

- **A hosted public link** (Cloud Run deploy), needed for phones and the APK
- **Real-phone testing** of the dialer, Maps, share, voice and photos
- **Server-sent push to the Android app** (Firebase), for alerts that aren't scheduled in advance
- **Live voice conversation** (Gemini Live API)
- **Real dispatch integrations** (control rooms, SMS without Twilio)
- **Official documents** in `knowledge/` instead of the starter summaries
