import "dotenv/config";

const env = (k: string) => (process.env[k] ?? "").trim();

/** Everything Paalam reads from the environment, plus which integrations are live. */
export const config = {
  port: Number(env("PORT") || 8080),
  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    project: env("GOOGLE_CLOUD_PROJECT"),
    location: env("GOOGLE_CLOUD_LOCATION") || "us-central1",
    argonModel: env("ARGON_MODEL") || "gemini-2.5-pro",
    gemModel: env("GEM_MODEL") || "gemini-2.5-flash",
  },
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
  sms: !!config.twilio.sid && !!config.twilio.token && !!config.twilio.from,
};

/** The integration status the Settings screen shows. Never includes key values. */
export function integrationStatus() {
  return [
    { id: "gemini", name: "Gemini (Argon + Gems)", live: live.gemini, env: ["GEMINI_API_KEY", "or GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS"], models: { argon: config.gemini.argonModel, gem: config.gemini.gemModel } },
    { id: "maps", name: "Maps Platform: Places, Routes, Geocoding, Weather, Air Quality", live: live.maps, env: ["GOOGLE_MAPS_API_KEY"] },
    { id: "cloud", name: "Translation, Text-to-Speech, Safe Browsing", live: live.cloud, env: ["GOOGLE_CLOUD_API_KEY"] },
    { id: "dlp", name: "Cloud DLP (redaction)", live: live.dlp, env: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"], fallback: "Local Aadhaar / phone / PAN redaction" },
    { id: "sms", name: "SMS / WhatsApp (Twilio)", live: live.sms, env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"], fallback: "Simulated send, logged in the audit trail" },
  ];
}
