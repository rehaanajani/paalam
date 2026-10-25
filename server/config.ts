import "dotenv/config";

const env = (k: string) => (process.env[k] ?? "").trim();

/** Everything Paalam reads from the environment, plus which integrations are live. */
export const config = {
  port: Number(env("PORT") || 8080),
  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    project: env("GOOGLE_CLOUD_PROJECT"),
    location: env("GOOGLE_CLOUD_LOCATION") || "global",
    argonModel: env("ARGON_MODEL") || "gemini-4-argon",
    gemModel: env("GEM_MODEL") || "gemini-3.6-flash",
    imageModel: env("IMAGE_MODEL") || "gemini-3.1-flash-image-preview",
    embedModel: env("EMBED_MODEL") || "gemini-embedding-001",
  },
  modelArmor: {
    template: env("MODEL_ARMOR_TEMPLATE"),
    location: env("MODEL_ARMOR_LOCATION") || "us-central1",
  },
  healthcareLocation: env("HEALTHCARE_LOCATION") || "us-central1",
  persist: (env("PERSIST") || "file") as "file" | "firestore" | "memory",
  serviceAccount: env("GOOGLE_APPLICATION_CREDENTIALS"),
  mapsKey: env("GOOGLE_MAPS_API_KEY"),
  cloudKey: env("GOOGLE_CLOUD_API_KEY") || env("GOOGLE_MAPS_API_KEY"),
  twilio: {
    sid: env("TWILIO_ACCOUNT_SID"),
    token: env("TWILIO_AUTH_TOKEN"),
    from: env("TWILIO_FROM_NUMBER"),
  },
  numbers: {
    emergency: env("EMERGENCY_NUMBER") || "112",
    ambulance: env("AMBULANCE_NUMBER") || "108",
    disaster: env("DISASTER_HELPLINE") || "1070",
  },
  city: {
    name: env("DEFAULT_CITY") || "Chennai",
    lat: Number(env("DEFAULT_LAT") || 13.0827),
    lng: Number(env("DEFAULT_LNG") || 80.2707),
  },
};

export const live = {
  gemini: !!config.gemini.apiKey || !!config.gemini.project,
  maps: !!config.mapsKey,
  cloud: !!config.cloudKey,
  dlp: !!config.serviceAccount && !!config.gemini.project,
  serviceAccount: !!config.serviceAccount && !!config.gemini.project,
  modelArmor: !!config.serviceAccount && !!config.gemini.project && !!config.modelArmor.template,
  firestore: config.persist === "firestore" && !!config.serviceAccount && !!config.gemini.project,
  sms: !!config.twilio.sid && !!config.twilio.token && !!config.twilio.from,
};

/** Results of checking each configured model exists on this key (filled at startup). */
export const modelCheck: Record<string, { model: string; ok: boolean; error?: string }> = {};

/** The integration status the Keys screen shows. Never includes key values. */
export function integrationStatus() {
  const m = (k: string) => modelCheck[k];
  return [
    { id: "gemini", name: config.gemini.apiKey ? "Gemini (AI Studio key): Argon + Gems" : "Gemini on Vertex AI: Argon + Gems", live: live.gemini, env: config.gemini.apiKey ? ["GEMINI_API_KEY (AI Studio)"] : ["GOOGLE_CLOUD_PROJECT", "GOOGLE_APPLICATION_CREDENTIALS", "Vertex AI User role"], models: { argon: config.gemini.argonModel, gem: config.gemini.gemModel }, checks: [m("argon"), m("gem")].filter(Boolean), uses: "Splitting, routing, every Gem's two passes, Google Search grounding" },
    { id: "image", name: "Gemini image model: posters", live: live.gemini, env: ["IMAGE_MODEL (optional)"], checks: [m("image")].filter(Boolean), uses: "Shareable warning and evacuation posters, made only after you approve", fallback: "A plain text poster" },
    { id: "embed", name: "Gemini Embeddings: knowledge + similar reports", live: live.gemini, env: ["EMBED_MODEL (optional)"], checks: [m("embed")].filter(Boolean), uses: "Searching the knowledge/ folder, spotting repeat reports of one incident", fallback: "Keyword search" },
    { id: "maps", name: "Maps Platform: Places, Routes, Geocoding, Weather + alerts, Air Quality", live: live.maps, env: ["GOOGLE_MAPS_API_KEY"], uses: "Locations, nearest help, drive times, rain, official weather alerts" },
    { id: "cloud", name: "Cloud Vision, Translation, Text-to-Speech, Safe Browsing", live: live.cloud, env: ["GOOGLE_CLOUD_API_KEY"], uses: "Reverse image search for old photos, Tamil translation and voice, phishing link checks" },
    { id: "dlp", name: "Cloud DLP: masking", live: live.dlp, env: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"], fallback: "Local Aadhaar / phone / PAN masking" },
    { id: "health", name: "Healthcare Natural Language API", live: live.serviceAccount, env: ["GOOGLE_APPLICATION_CREDENTIALS", "HEALTHCARE_LOCATION (optional)"], uses: "Standard names for medicines and conditions in prescriptions" },
    { id: "armor", name: "Model Armor: prompt-injection shield", live: live.modelArmor, env: ["MODEL_ARMOR_TEMPLATE", "GOOGLE_APPLICATION_CREDENTIALS"], uses: "Screens forwards and web pages for hidden instructions aimed at the AI", fallback: "Local pattern screening" },
    { id: "firestore", name: "Firestore: saved Bridges", live: live.firestore, env: ["PERSIST=firestore", "GOOGLE_APPLICATION_CREDENTIALS"], fallback: config.persist === "memory" ? "Not saved" : "Saved to data/ on this machine" },
    { id: "sms", name: "SMS / WhatsApp (Twilio)", live: live.sms, env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"], fallback: "Simulated send, logged in the audit trail" },
  ];
}
