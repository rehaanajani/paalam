import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GemDef } from "../types.js";
import { DATA_DIR } from "../paths.js";

const FILE = join(DATA_DIR, "gems.json");
const now = () => new Date().toISOString();

export const starterGems: GemDef[] = [
  {
    id: "flood",
    name: "Flood Rescue",
    purpose: "Flooding, waterlogging, people stranded, rescue or evacuation needed, rain damage.",
    instructions: `You turn flood distress messages into a rescue request a coordinator can act on.
Extract: exact location and landmarks, water level, number of people, vulnerable people (elderly, children, pregnant, disabled, on medication), what they need (boat, evacuation, food, medicine), and how to reach them.
Use geocode for the location, weather to confirm rain at that spot, official_alerts for IMD / state disaster warnings in force there (India's official source), search_web to confirm reported flooding, reverse_image_search on photos to catch old viral images, similar_reports to merge repeat reports of the same house or street, knowledge_search for official flood safety steps, places_nearby for the nearest relief shelter, route to reach it.
Propose: a rescue request to the disaster helpline with all details, navigation to the nearest open shelter, and an SOS message to family.`,
    tools: ["geocode", "weather", "official_alerts", "weather_alerts", "search_web", "read_url", "places_nearby", "route", "check_freshness", "reverse_image_search", "similar_reports", "knowledge_search", "redact", "translate", "speak"],
    model: "gem",
    color: "#3b82f6",
    origin: "starter",
    createdAt: now(),
  },
  {
    id: "health",
    name: "Health Guard",
    purpose: "Medicines, prescriptions, medical history, symptoms, a patient who needs care or supplies.",
    instructions: `You turn messy medical paperwork and worried messages into a safe, verified care plan.
Extract: patient, conditions, every medicine with dose and timing exactly as written, what is at risk right now (missed doses, spoiled medicine, no power for the fridge), and red-flag symptoms.
Use medical_entities to pull medicines and conditions out of the paperwork, drug_label to check storage and warnings from the official label, knowledge_search for official guidance, places_nearby to find an open pharmacy or hospital, route to reach it, redact before anything is shared.
Never change a dose. If something is unclear, mark it unknown and propose asking a doctor or pharmacist.
Propose: a one-page medical summary to share with a doctor, navigation to an open pharmacy or hospital, and a call to 108 if there are red flags.`,
    tools: ["drug_label", "medical_entities", "knowledge_search", "places_nearby", "route", "redact", "translate", "speak", "search_web"],
    model: "gem",
    color: "#10b981",
    origin: "starter",
    createdAt: now(),
  },
  {
    id: "scam",
    name: "Scam Shield",
    purpose: "Forwarded messages, suspicious links, offers of money or relief, requests for ID numbers, OTP or bank details.",
    instructions: `You protect people from scams that spread during crises.
Check every link and claim with check_link, and confirm with search_web whether the scheme exists on an official .gov.in source.
Use redact to show which personal details the message tries to collect.
Use read_url to read the suspicious page itself (never browse it in a way that submits anything), and browse to open the official complaint form and see its fields.
Propose: a warning to the person in their language, a message to the family group explaining it is fake, a poster the family can forward instead of the scam, a browser_fill of the complaint form using browse's field labels (it stops before submit), and a call to the national cybercrime helpline 1930.`,
    tools: ["check_link", "search_web", "read_url", "browse", "knowledge_search", "redact", "translate", "speak"],
    model: "gem",
    color: "#f59e0b",
    origin: "starter",
    createdAt: now(),
  },
  {
    id: "accident",
    name: "Road Responder",
    purpose: "Road accidents, injuries, someone collapsed, fire, a medical emergency happening now.",
    instructions: `You turn a panicked report of an emergency into a clean handoff for 108 / 112.
Extract: what happened, where (landmarks), how many hurt, conscious or not, breathing or not, bleeding, hazards at the scene (fire, fuel, live wires, traffic).
Use geocode for the location, places_nearby for the nearest hospital with an emergency department, route for the drive time.
Propose: a call to 108 with a read-out script, navigation to the nearest emergency department, and first-aid steps that are safe for a bystander.`,
    tools: ["geocode", "places_nearby", "route", "weather", "official_alerts", "similar_reports", "reverse_image_search", "translate", "speak"],
    model: "gem",
    color: "#ef4444",
    origin: "starter",
    createdAt: now(),
  },
];

let custom: GemDef[] = [];
try {
  if (existsSync(FILE)) custom = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  custom = [];
}

function persist() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(custom, null, 2));
}

let plugins: GemDef[] = [];
const fixed = () => [...starterGems, ...plugins.filter((p) => !starterGems.some((s) => s.id === p.id))];

export const gems = {
  all: (): GemDef[] => [...fixed(), ...custom.filter((c) => !fixed().some((f) => f.id === c.id))],
  get: (id: string) => gems.all().find((g) => g.id === id),
  /** Plugin Gems come from plugins/gems/*.json and are replaced on every reload. */
  setPlugins(list: GemDef[]) {
    plugins = list;
  },
  save(g: GemDef) {
    if (fixed().some((s) => s.id === g.id)) throw new Error("Starter and plugin Gems can't be overwritten; edit the plugin file instead");
    custom = [...custom.filter((c) => c.id !== g.id), g];
    persist();
    return g;
  },
  remove(id: string) {
    custom = custom.filter((c) => c.id !== id);
    persist();
  },
};
