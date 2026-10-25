/**
 * Stand-in results used only while an integration has no key. Every one is
 * marked demo:true and the UI shows a DEMO chip on it, so nothing here can be
 * mistaken for live data. Names are deliberately generic.
 */
import type { ToolOutput } from "./index.js";

type P = { lat: number; lng: number };
const jitter = (p: P, dLat: number, dLng: number) => ({ lat: +(p.lat + dLat).toFixed(5), lng: +(p.lng + dLng).toFixed(5) });

const landmarks: Record<string, P & { address: string }> = {
  velachery: { lat: 12.9791, lng: 80.2209, address: "Velachery, Chennai 600042" },
  tambaram: { lat: 12.9249, lng: 80.1, address: "Tambaram, Chennai 600045" },
  adyar: { lat: 13.0012, lng: 80.2565, address: "Adyar, Chennai 600020" },
  "t nagar": { lat: 13.0418, lng: 80.2341, address: "T. Nagar, Chennai 600017" },
  mudichur: { lat: 12.9165, lng: 80.0735, address: "Mudichur, Chennai 600048" },
  pallikaranai: { lat: 12.9349, lng: 80.2137, address: "Pallikaranai, Chennai 600100" },
};

export const demo = {
  geocode(address: string): ToolOutput {
    const key = Object.keys(landmarks).find((k) => String(address).toLowerCase().includes(k));
    const hit = key ? landmarks[key]! : { lat: 13.0827, lng: 80.2707, address: "Chennai (city centre, approximate)" };
    return { ok: true, demo: true, summary: `${hit.address} (${key ? "landmark match" : "approximate"})`, data: { ...hit, precise: false } };
  },
  places(query: string, at: P): ToolOutput {
    const q = String(query).toLowerCase();
    const kind = /pharm|medic|chemist/.test(q) ? "Pharmacy" : /shelter|relief|camp/.test(q) ? "Relief shelter" : /police/.test(q) ? "Police station" : "Hospital";
    const places = [
      { name: `Demo ${kind} A`, ...jitter(at, 0.011, 0.008), openNow: true, phone: "044 0000 0001" },
      { name: `Demo ${kind} B`, ...jitter(at, -0.014, 0.017), openNow: true, phone: "044 0000 0002" },
      { name: `Demo ${kind} C`, ...jitter(at, 0.021, -0.012), openNow: false, phone: null },
    ].map((p) => ({ ...p, address: `${kind}, near ${at.lat.toFixed(3)}, ${at.lng.toFixed(3)}`, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` }));
    return { ok: true, demo: true, summary: `3 results, nearest open: ${places[0]!.name}`, data: { places } };
  },
  route(from: P, to: P): ToolOutput {
    const km = +(Math.hypot(to.lat - from.lat, to.lng - from.lng) * 111 * 1.35).toFixed(1);
    const minutes = Math.max(4, Math.round(km * 3.2));
    const mid = { lat: (from.lat + to.lat) / 2 + 0.003, lng: (from.lng + to.lng) / 2 - 0.004 };
    return { ok: true, demo: true, summary: `${minutes} min, ${km} km (estimated, flooded roads avoided)`, data: { minutes, km, polyline: [[from.lat, from.lng], [mid.lat, mid.lng], [to.lat, to.lng]] } };
  },
  weather(_at: P): ToolOutput {
    return { ok: true, demo: true, summary: "Heavy rain, 26°C, 41 mm in the last hour, 90% chance of more", data: { condition: "HEAVY_RAIN", rainMm: 41, tempC: 26 } };
  },
  search(question: string): ToolOutput {
    const q = String(question).toLowerCase();
    if (/relief|scheme|₹|5000|govt|government/.test(q))
      return { ok: true, demo: true, summary: "No official ₹5000 flood-relief scheme with an online registration form was found. Official relief is announced on tn.gov.in and paid via ration-card lists, never through links.", data: { sources: [{ title: "Tamil Nadu Government (demo source)", url: "https://www.tn.gov.in" }] } };
    if (/flood|rain|water/.test(q))
      return { ok: true, demo: true, summary: "News reports waterlogging in Velachery and Pallikaranai after overnight rain; Greater Chennai Corporation has opened relief centres.", data: { sources: [{ title: "Greater Chennai Corporation (demo source)", url: "https://chennaicorporation.gov.in" }] } };
    return { ok: true, demo: true, summary: "Demo search: add GEMINI_API_KEY for live Google Search grounding.", data: { sources: [] } };
  },
  reverseImage(id: string): ToolOutput {
    return { ok: true, demo: true, summary: `No earlier copies of ${id} found online (demo). With a key, Cloud Vision checks the whole web`, data: { seenBefore: false, pages: [] } };
  },
  alerts(): ToolOutput {
    return { ok: true, demo: true, summary: "Sample alert: heavy-rainfall warning for Chennai district from the state weather service (demo data)", data: { alerts: [{ title: "Heavy rainfall warning", severity: "Severe", area: "Chennai", source: "demo" }] } };
  },
  medical(text: string): ToolOutput {
    const meds = ["Human Mixtard 30/70 (insulin)", "Metformin", "Amlodipine"].filter((m) => text.toLowerCase().includes(m.split(" ")[0]!.toLowerCase()));
    return { ok: meds.length > 0, demo: true, summary: `Medicines: ${meds.join(", ") || "none found"}. Conditions: type 2 diabetes, hypertension (demo)`, data: { entities: meds } };
  },
  drug(drug: string): ToolOutput {
    if (/insulin/i.test(drug))
      return { ok: true, demo: true, summary: "In-use insulin can be kept at room temperature (up to 30°C) for up to 28 days. Keep away from direct heat and light. Do not freeze.", data: { source: "openFDA (cached)" } };
    return { ok: false, demo: true, summary: `No cached label for ${drug}` };
  },
};
