# Getting Paalam's keys from Google Cloud

About 20 minutes, once. Everything here uses your **prompt wars** project and the $300 trial credit. Never paste keys into chat, code or GitHub: they go only in `.env`, which git ignores.

What each key switches on:

| Key | Turns on |
|---|---|
| Service account + project (Vertex AI) | **Gemini 4 Argon** and every Gem, Google Search grounding, posters, embeddings, plus DLP, Healthcare NL, Model Armor, Firestore. Billed to the project's trial credit |
| `GOOGLE_MAPS_API_KEY` | Geocoding, Places, Routes, Weather + official alerts, Air Quality |
| `GOOGLE_CLOUD_API_KEY` | Cloud Vision reverse image search, Translation, Text-to-Speech, Safe Browsing |

---

## 1. Turn on the APIs (one command)

Google Cloud console → make sure **prompt wars** is selected at the top → click the **>_** icon (Cloud Shell, top right) → paste:

```bash
gcloud services enable \
  generativelanguage.googleapis.com aiplatform.googleapis.com \
  geocoding-backend.googleapis.com places.googleapis.com routes.googleapis.com \
  weather.googleapis.com airquality.googleapis.com \
  vision.googleapis.com translate.googleapis.com texttospeech.googleapis.com safebrowsing.googleapis.com \
  dlp.googleapis.com healthcare.googleapis.com modelarmor.googleapis.com firestore.googleapis.com \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

If one name fails, remove it and run again, then enable that one by hand under **APIs & Services → Library**. Turning APIs on is free; you pay only for use.

Also set a **budget alert** now: **Billing → Budgets & alerts → Create budget → $50**.

## 2. Gemini: use Vertex AI (not an AI Studio key)

Gemini 4 Argon is served through **Vertex AI** on your Cloud project, which bills the trial credit. Nothing to copy here: Paalam signs in with the `paalam` service account from step 5.

- Leave `GEMINI_API_KEY=` **blank** in `.env`. If it's filled, Paalam uses AI Studio instead of Vertex.
- Keep `GOOGLE_CLOUD_LOCATION=global` (the newest models are served from the global endpoint).
- `ARGON_MODEL=gemini-4-argon` and `GEM_MODEL=gemini-3.6-flash` are already set. If the Keys screen shows a ✕ next to either, open **Vertex AI → Model Garden**, find the model, and copy its exact ID into `.env`.
- Some newer models need you to click **Enable** on their Model Garden page once.

## 3. Maps key

1. Cloud console → **APIs & Services → Credentials → Create credentials → API key**.
2. Click the new key → rename it `maps-key`.
3. Under **API restrictions** → **Restrict key** → tick: Geocoding API, Places API (New), Routes API, Weather API, Air Quality API → **Save**.
4. Copy it into `.env` as `GOOGLE_MAPS_API_KEY=`.

## 4. Cloud key

1. **Credentials → Create credentials → API key** again → rename it `cloud-key`.
2. **Restrict key** → tick: Cloud Vision API, Cloud Translation API, Cloud Text-to-Speech API, Safe Browsing API → **Save**.
3. Copy it into `.env` as `GOOGLE_CLOUD_API_KEY=`.

## 5. Google login for Argon and the Cloud APIs (no key file)

Vertex AI (Argon and the Gems), DLP, Healthcare NL, Model Armor and Firestore don't take API keys. Many organizations block service-account key files ("Secure by Default"), and Google recommends against them anyway. Paalam uses **Application Default Credentials** instead:

**On your Mac**, once:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project PROJECT_ID
```

The first command opens a browser: sign in with the Google account that owns the project. Leave `GOOGLE_APPLICATION_CREDENTIALS=` empty in `.env`. You'll need the gcloud CLI: https://cloud.google.com/sdk/docs/install

**On Cloud Run**, the `paalam` service account is attached to the service, so there's no file and no login. Create it with these roles (Cloud Shell, replace `PROJECT_ID`):

```bash
gcloud iam service-accounts create paalam --display-name=paalam
for role in aiplatform.user dlp.user healthcare.nlpServiceViewer modelarmor.user datastore.user; do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:paalam@PROJECT_ID.iam.gserviceaccount.com" --role="roles/$role"
done
```

Only if your organization allows key files can you instead download a JSON key for `paalam` and set `GOOGLE_APPLICATION_CREDENTIALS` to its path.

## 6. Model Armor template (the injection shield)

1. Console → **Security → Model Armor → Create template**.
2. Template ID `paalam-shield`, region `us-central1`.
3. Turn on **Prompt injection and jailbreak detection** and **Malicious URL detection**. Leave the responsible-AI filters at medium.
4. **Create**, then in `.env`: `MODEL_ARMOR_TEMPLATE=paalam-shield` (and `MODEL_ARMOR_LOCATION=us-central1` if you chose another region, change it to match).

Without it, Paalam screens with local patterns, which catch the obvious cases.

## 7. Firestore (only for Cloud Run)

Locally, Bridges are saved in `data/`. Cloud Run wipes its disk, so there:

1. Console → **Firestore → Create database** → **Native mode** → location `asia-south1` (Mumbai) → **Create**.
2. Set `PERSIST=firestore` in the Cloud Run environment.

## 8. Restart and check

```bash
npm run build
npm start
```

Open Paalam → **Settings → Keys**. Every card you configured should say **LIVE**. The Gemini cards also check each model name against your key:

- ✓ means the model exists.
- ✕ means that ID isn't available on your key. Pick a current one from aistudio.google.com and set `ARGON_MODEL`, `GEM_MODEL`, `IMAGE_MODEL` or `EMBED_MODEL` in `.env`.

Then send a real message to Argon. The demo label disappears once Gemini is live.

## 9. Deploying to Cloud Run

Keys go in **Secret Manager**, never in the image:

```bash
printf '%s' 'YOUR_MAPS_KEY'   | gcloud secrets create maps-key --data-file=-
printf '%s' 'YOUR_CLOUD_KEY'  | gcloud secrets create cloud-key --data-file=-

gcloud run deploy paalam --source . --region asia-south1 --allow-unauthenticated \
  --service-account paalam@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,PERSIST=firestore,MODEL_ARMOR_TEMPLATE=paalam-shield \
  --set-secrets GOOGLE_MAPS_API_KEY=maps-key:latest,GOOGLE_CLOUD_API_KEY=cloud-key:latest
```

On Cloud Run the service account is attached directly: no key file, no login. Give it **Secret Manager Secret Accessor** too.

---

## What we deliberately didn't add

| Service | Why not (yet) |
|---|---|
| **Veo** (video generation) | Takes minutes per clip and costs far more. Nothing in a crisis waits for a video. A poster does the same job in seconds |
| **Gemini Live API** (real-time voice) | The best next feature: talk to Argon hands-free. It's a separate streaming connection and needs a confirmed Tamil voice; worth doing after the core is solid |
| **Speech-to-Text (Chirp)** | Gemini already understands voice notes directly. Add it only if Tamil transcripts turn out weak |
| **Document AI** | Gemini reads prescriptions and PDFs itself. Document AI pays off at thousands of forms, not one family's papers |
| **Vertex AI Vector Search / RAG Engine** | Our knowledge base and incident matching use Gemini Embeddings with a local index, which is plenty for one city. Vector Search is the path when it grows past ~100k passages |
| **Earth Engine** (satellite flood maps) | Needs a separate approval and hours of setup |
