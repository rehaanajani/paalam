# Getting Paalam's keys from Google Cloud

About 20 minutes, once. Everything here uses your **prompt wars** project and the $300 trial credit. Never paste keys into chat, code or GitHub: they go only in `.env`, which git ignores.

What each key switches on:

| Key | Turns on |
|---|---|
| `GEMINI_API_KEY` | Argon, every Gem, Google Search grounding, posters, embeddings (knowledge search, similar reports) |
| `GOOGLE_MAPS_API_KEY` | Geocoding, Places, Routes, Weather + official alerts, Air Quality |
| `GOOGLE_CLOUD_API_KEY` | Cloud Vision reverse image search, Translation, Text-to-Speech, Safe Browsing |
| Service account JSON | Cloud DLP masking, Healthcare Natural Language, Model Armor shield, Firestore |

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

## 2. Gemini key

1. Go to **aistudio.google.com** → **Get API key** → **Create API key** → pick the **prompt wars** project.
2. Copy it into `.env` as `GEMINI_API_KEY=`.

## 3. Maps key

1. Cloud console → **APIs & Services → Credentials → Create credentials → API key**.
2. Click the new key → rename it `maps-key`.
3. Under **API restrictions** → **Restrict key** → tick: Geocoding API, Places API (New), Routes API, Weather API, Air Quality API → **Save**.
4. Copy it into `.env` as `GOOGLE_MAPS_API_KEY=`.

## 4. Cloud key

1. **Credentials → Create credentials → API key** again → rename it `cloud-key`.
2. **Restrict key** → tick: Cloud Vision API, Cloud Translation API, Cloud Text-to-Speech API, Safe Browsing API → **Save**.
3. Copy it into `.env` as `GOOGLE_CLOUD_API_KEY=`.

## 5. Service account (`paalam`)

Some APIs (DLP, Healthcare, Model Armor, Firestore) don't accept API keys; they need a service account.

1. **IAM & Admin → Service Accounts → Create service account** → name `paalam` → **Create and continue**.
2. Grant these roles, then **Done**:
   - **DLP User**
   - **Healthcare Natural Language Service Viewer**
   - **Model Armor User**
   - **Cloud Datastore User** (for Firestore)
   - **Vertex AI User** (only if you'll use Vertex instead of the AI Studio key)
3. Open the `paalam` account → **Keys → Add key → Create new key → JSON**. A file downloads.
4. Move it **outside** the Paalam folder, for example `~/keys/paalam-sa.json`.
5. In `.env`:
   ```
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/Users/you/keys/paalam-sa.json
   ```
   The project ID is shown in the project picker at the top of the console (it's not the display name).

Same roles from Cloud Shell, if you prefer (replace `PROJECT_ID`):

```bash
for role in dlp.user healthcare.nlpServiceViewer modelarmor.user datastore.user; do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:paalam@PROJECT_ID.iam.gserviceaccount.com" --role="roles/$role"
done
```

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
printf '%s' 'YOUR_GEMINI_KEY' | gcloud secrets create gemini-key --data-file=-
printf '%s' 'YOUR_MAPS_KEY'   | gcloud secrets create maps-key --data-file=-
printf '%s' 'YOUR_CLOUD_KEY'  | gcloud secrets create cloud-key --data-file=-

gcloud run deploy paalam --source . --region asia-south1 --allow-unauthenticated \
  --service-account paalam@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,PERSIST=firestore,MODEL_ARMOR_TEMPLATE=paalam-shield \
  --set-secrets GEMINI_API_KEY=gemini-key:latest,GOOGLE_MAPS_API_KEY=maps-key:latest,GOOGLE_CLOUD_API_KEY=cloud-key:latest
```

On Cloud Run the service account is attached directly, so you don't upload the JSON file there. Give it **Secret Manager Secret Accessor** too.

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
