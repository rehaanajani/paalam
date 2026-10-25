/**
 * The no-key demo: one family's WhatsApp during a Chennai flood. Three problems
 * arrive mixed together (flood, insulin without power, a relief scam), which is
 * exactly what single-purpose apps can't handle.
 *
 * Only Gemini's answers are scripted here. Tool calls still execute, so with a
 * Maps key the places, routes and weather become live even in demo mode.
 */
import { config } from "../config.js";
import type { ToolContext } from "../tools/index.js";
import type { Evidence, ToolCall } from "../types.js";

export const sampleText = `Anna please help 🙏 Velachery Vijayanagar 3rd main road la irukom, veetukulla knee level thanni, still rising. Naan, amma, paati (78, sugar patient, nadakka mudiyadhu). Paati insulin fridge la irukku, current illa since last night. Phone 20% dhaan.

Forwarded: 🇮🇳 TN Govt Flood Relief ₹5000 for every family! Register within 24 hours: http://tn-gov-relief.online/apply — enter your bank account number and OTP to receive money.`;

export const sampleEvidence: Evidence[] = [
  {
    id: "E1",
    kind: "audio",
    name: "voice-note-0412.ogg (transcribed)",
    mimeType: "text/plain",
    text: "Voice note, Tamil, 38 s, transcribed: 'Water is coming in fast. The road is completely under water, cars are half sunk. Paati can't climb the stairs. Nobody from the corporation has come. Please send a boat.'",
  },
  {
    id: "E2",
    kind: "image",
    name: "IMG-20261027-WA0007.jpg",
    mimeType: "text/plain",
    text: "Photo (described): a residential street under brown water roughly up to car door level, two cars partly submerged, a blue house gate, a sign reading 'Vijayanagar 3rd Main Rd'. No EXIF data (WhatsApp forward).",
  },
  {
    id: "E3",
    kind: "image",
    name: "prescription.jpg",
    mimeType: "text/plain",
    text: "Prescription (OCR): Patient: Lakshmi S., 78 F. Dx: Type 2 DM, HTN. Rx: 1) Inj. Human Mixtard 30/70: 18 U before breakfast, 12 U before dinner. 2) Tab Metformin 500 mg 1-0-1. 3) Tab Amlodipine 5 mg 1-0-0. Ph: 98410 55321.",
  },
  {
    id: "E4",
    kind: "text",
    name: "forwarded-message.txt",
    mimeType: "text/plain",
    text: "🇮🇳 TN Govt Flood Relief ₹5000 for every family! Register within 24 hours: http://tn-gov-relief.online/apply. Enter your bank account number and OTP to receive money. Forward to 10 groups.",
  },
];

const find = (calls: ToolCall[], tool: string) => calls.find((c) => c.tool === tool && c.ok);
const firstOpen = (calls: ToolCall[]) => find(calls, "places_nearby")?.data?.places?.find((p: any) => p.openNow !== false);

export const scenario = {
  split: {
    headline: "Family of three trapped by rising flood water in Velachery, an insulin-dependent 78-year-old without power, and a relief scam in the family chat",
    language: "Tanglish (Tamil + English)",
    locationHint: "Velachery Vijayanagar 3rd main road",
    fragments: [
      { gemId: "flood", title: "Family trapped by rising flood water", summary: "Three people including a 78-year-old who cannot walk are inside a house in Vijayanagar, Velachery, with knee-deep water still rising. They are asking for a boat.", evidence: ["E1", "E2"], urgency: "critical" as const },
      { gemId: "health", title: "Insulin at risk, fridge has no power", summary: "Paati (Lakshmi, 78) is on twice-daily insulin and metformin. The insulin was in a fridge that has had no power since last night.", evidence: ["E3", "E1"], urgency: "high" as const },
      { gemId: "scam", title: "Fake ₹5000 flood-relief link", summary: "A forwarded message asks families to enter bank details and OTP on a non-government site to get ₹5000.", evidence: ["E4"], urgency: "medium" as const },
    ],
  },

  plan: {
    flood: {
      facts: [],
      toolCalls: [
        { tool: "geocode", argsJson: JSON.stringify({ address: "Vijayanagar 3rd Main Road, Velachery" }), why: "pin the house" },
        { tool: "weather", argsJson: "{}", why: "confirm heavy rain right there" },
        { tool: "official_alerts", argsJson: "{\"place\":\"Velachery, Chennai\"}", why: "IMD / state alerts in force (NDMA SACHET)" },
        { tool: "reverse_image_search", argsJson: JSON.stringify({ evidenceId: "E2" }), why: "is the street photo new" },
        { tool: "similar_reports", argsJson: JSON.stringify({ text: "Family trapped by rising flood water, Vijayanagar 3rd Main Road, Velachery" }), why: "same house already reported?" },
        { tool: "search_web", argsJson: JSON.stringify({ question: "Is there flooding in Velachery Chennai right now?" }), why: "confirm reported flooding" },
        { tool: "places_nearby", argsJson: JSON.stringify({ query: "flood relief shelter" }), why: "nearest shelter" },
        { tool: "route", argsJson: "{}", why: "drive time for the rescue team" },
      ],
    },
    health: {
      facts: [],
      toolCalls: [
        { tool: "medical_entities", argsJson: JSON.stringify({ text: sampleEvidence[2]!.text }), why: "medicines and conditions from the prescription" },
        { tool: "drug_label", argsJson: JSON.stringify({ drug: "insulin", section: "storage" }), why: "is warm insulin still usable" },
        { tool: "knowledge_search", argsJson: JSON.stringify({ query: "insulin storage without refrigeration during power cut" }), why: "official guidance" },
        { tool: "places_nearby", argsJson: JSON.stringify({ query: "24 hour pharmacy" }), why: "replacement insulin" },
        { tool: "route", argsJson: "{}", why: "how far" },
        { tool: "redact", argsJson: JSON.stringify({ text: sampleEvidence[2]!.text }), why: "mask the phone number before sharing" },
      ],
    },
    scam: {
      facts: [],
      toolCalls: [
        { tool: "check_link", argsJson: JSON.stringify({ text: sampleEvidence[3]!.text }), why: "check the link and the ask" },
        { tool: "search_web", argsJson: JSON.stringify({ question: "Is there a Tamil Nadu government ₹5000 flood relief scheme with online registration?" }), why: "does the scheme exist" },
        { tool: "browse", argsJson: JSON.stringify({ url: `http://localhost:${config.port}/practice/complaint` }), why: "see the complaint form's fields" },
      ],
    },
  },

  act: {
    flood(calls: ToolCall[], ctx: ToolContext) {
      const geo = find(calls, "geocode");
      const wx = find(calls, "weather");
      const news = find(calls, "search_web");
      const shelter = firstOpen(calls);
      const route = find(calls, "route");
      const id = (t: string) => calls.find((c) => c.tool === t)?.id ?? "";
      const where = geo?.data?.address ?? "Vijayanagar 3rd Main Road, Velachery";
      return {
        summary: `Your location is pinned and heavy rain is confirmed there. A rescue request with paati's details is ready for the disaster helpline. Approve it first, then send the SOS to family while your phone still has charge.`,
        location: { lat: ctx.near.lat, lng: ctx.near.lng, label: "Family's house (approx.)" },
        facts: [
          { field: "Location", value: where, status: "reported" as const, sources: ["E1", "E2", id("geocode")], verification: "verified" as const, note: "Street sign in the photo matches the address given." },
          { field: "House number", value: "Not given", status: "unknown" as const, sources: [], verification: "unverified" as const, note: "Ask the family or use their live location." },
          { field: "Water level", value: "Knee-deep inside the house, rising", status: "reported" as const, sources: ["E1", "E2"], verification: "unverified" as const },
          { field: "Rain right now", value: wx?.summary ?? "Unknown", status: "inferred" as const, sources: [id("weather")], verification: "verified" as const },
          { field: "Official alert", value: find(calls, "official_alerts")?.summary ?? "Unknown", status: "inferred" as const, sources: [id("official_alerts")], verification: find(calls, "official_alerts") ? ("verified" as const) : ("unverified" as const) },
          { field: "Street photo", value: find(calls, "reverse_image_search")?.summary ?? "Not checked", status: "inferred" as const, sources: ["E2", id("reverse_image_search")], verification: find(calls, "reverse_image_search") ? ("verified" as const) : ("unverified" as const) },
          { field: "Earlier reports", value: find(calls, "similar_reports")?.summary ?? "Not checked", status: "inferred" as const, sources: [id("similar_reports")], verification: find(calls, "similar_reports") ? ("verified" as const) : ("unverified" as const) },
          { field: "Area flooding", value: news?.summary ?? "Unknown", status: "inferred" as const, sources: [id("search_web")], verification: "verified" as const },
          { field: "People", value: "3: caller, mother, grandmother (78)", status: "reported" as const, sources: ["E1"], verification: "unverified" as const },
          { field: "Can't walk", value: "Grandmother, 78. Needs to be carried", status: "reported" as const, sources: ["E1"], verification: "unverified" as const },
          { field: "Phone battery", value: "20%", status: "reported" as const, sources: ["E1"], verification: "unverified" as const },
        ],
        actions: [
          {
            kind: "request" as const,
            title: `Send rescue request to ${config.numbers.disaster}`,
            detail: "Boat needed: 3 people, one 78-year-old who can't walk and depends on insulin. Water rising inside the house.",
            effect: `Sends a structured rescue request to the disaster control room (${config.numbers.disaster}) and logs it as an open incident.`,
            payloadJson: JSON.stringify({ to: config.numbers.disaster, body: `RESCUE: 3 people at ${where}. Knee-deep water inside, rising. 78F cannot walk, insulin-dependent. Needs boat. Caller phone at 20%. Evidence: voice note + street photo.` }),
            evidence: ["E1", "E2", id("geocode"), id("weather")],
            unresolved: ["Exact house number", "Whether the ground floor exit is still passable"],
            priority: 1,
          },
          {
            kind: "sms" as const,
            title: "Send SOS with live location to family",
            detail: "Tell relatives where you are and that a rescue request is filed, before the battery runs out.",
            effect: "Sends one SMS with your location link to the family contacts you choose.",
            payloadJson: JSON.stringify({ to: "family", body: `We are stuck at ${where}, water rising. Rescue requested via ${config.numbers.disaster}. Location: https://maps.google.com/?q=${ctx.near.lat},${ctx.near.lng}. Phone low, will reply when I can.` }),
            evidence: ["E1"],
            unresolved: ["Which family members to send to"],
            priority: 2,
          },
          ...(shelter
            ? [
                {
                  kind: "navigate" as const,
                  title: `Route to ${shelter.name}`,
                  detail: `Nearest open relief shelter${route ? `, ${route.summary}` : ""}. For the rescue team or if you can leave safely.`,
                  effect: "Opens turn-by-turn directions in Google Maps.",
                  payloadJson: JSON.stringify({ lat: shelter.lat, lng: shelter.lng, label: shelter.name }),
                  evidence: [id("places_nearby"), id("route")],
                  unresolved: ["Whether roads on the way are passable"],
                  priority: 3,
                },
              ]
            : []),
          {
            kind: "readback" as const,
            title: "Read the plan back in Tamil",
            detail: "Confirms the details with the family in their language before anything is dispatched.",
            effect: "Plays a short Tamil summary aloud.",
            payloadJson: JSON.stringify({ lang: "ta-IN", text: "உங்கள் இடம் வேளச்சேரி விஜயநகர் 3வது மெயின் ரோடு. மூன்று பேர், பாட்டிக்கு நடக்க முடியாது. மீட்பு படகு கோரிக்கை அனுப்பப்படுகிறது. மேல் தளத்துக்கு செல்லுங்கள்." }),
            evidence: ["E1"],
            unresolved: [],
            priority: 4,
          },
        ],
      };
    },

    health(calls: ToolCall[], _ctx: ToolContext) {
      const label = find(calls, "drug_label");
      const pharmacy = firstOpen(calls);
      const route = find(calls, "route");
      const red = find(calls, "redact");
      const id = (t: string) => calls.find((c) => c.tool === t)?.id ?? "";
      return {
        summary: "Paati's insulin is likely still usable at room temperature for now, per the official label. Keep it out of heat and water. A masked medical summary is ready to share with a doctor or the rescue team.",
        facts: [
          { field: "Patient", value: "Lakshmi S., 78 F. Type 2 diabetes, hypertension", status: "reported" as const, sources: ["E3"], verification: "unverified" as const },
          { field: "Insulin", value: "Human Mixtard 30/70: 18 U before breakfast, 12 U before dinner", status: "reported" as const, sources: ["E3"], verification: "unverified" as const, note: "Copied exactly from the prescription. Not changed." },
          { field: "Other medicines", value: "Metformin 500 mg twice daily; Amlodipine 5 mg morning", status: "reported" as const, sources: ["E3", id("medical_entities")], verification: find(calls, "medical_entities") ? ("verified" as const) : ("unverified" as const), note: "Names confirmed by medical entity extraction; doses copied from the prescription." },
          { field: "Official guidance", value: find(calls, "knowledge_search")?.summary.slice(0, 220) ?? "None found", status: "inferred" as const, sources: [id("knowledge_search")], verification: find(calls, "knowledge_search") ? ("verified" as const) : ("unverified" as const) },
          { field: "Insulin storage", value: label?.summary ?? "Unknown. Ask a pharmacist", status: "inferred" as const, sources: [id("drug_label")], verification: label ? ("verified" as const) : ("unverified" as const) },
          { field: "Fridge power", value: "Off since last night", status: "reported" as const, sources: ["E1"], verification: "unverified" as const },
          { field: "Sugar reading", value: "Not given", status: "unknown" as const, sources: [], verification: "unverified" as const, note: "Ask if they have a glucometer." },
          { field: "Shared copy", value: red?.summary ?? "Not redacted", status: "inferred" as const, sources: [id("redact")], verification: red ? ("verified" as const) : ("unverified" as const) },
        ],
        actions: [
          {
            kind: "share" as const,
            title: "Share masked medical summary",
            detail: "One page for the rescue team or doctor: conditions, exact doses, what's at risk. The phone number is masked.",
            effect: "Copies the summary or opens your share sheet. Nothing is sent automatically.",
            payloadJson: JSON.stringify({ text: `MEDICAL SUMMARY: Lakshmi S., 78 F. T2DM + HTN. Insulin Human Mixtard 30/70: 18 U before breakfast, 12 U before dinner. Metformin 500 mg 1-0-1. Amlodipine 5 mg 1-0-0. Insulin unrefrigerated since last night. Cannot walk. ph 98410 55321.` }),
            evidence: ["E3", id("redact")],
            unresolved: ["Last sugar reading"],
            priority: 1,
          },
          ...(pharmacy
            ? [
                {
                  kind: "navigate" as const,
                  title: `Get insulin at ${pharmacy.name}`,
                  detail: `Nearest open pharmacy${route ? `, ${route.summary}` : ""}. For a relative outside the flood zone.`,
                  effect: "Opens directions in Google Maps.",
                  payloadJson: JSON.stringify({ lat: pharmacy.lat, lng: pharmacy.lng, label: pharmacy.name }),
                  evidence: [id("places_nearby"), id("route")],
                  unresolved: ["Whether they have Human Mixtard 30/70 in stock"],
                  priority: 2,
                },
              ]
            : []),
          {
            kind: "call" as const,
            title: `Call ${config.numbers.ambulance} if she feels unwell`,
            detail: "Signs of very high or low sugar (confusion, drowsiness, sweating, vomiting) need an ambulance.",
            effect: `Opens the dialer with ${config.numbers.ambulance} and shows a read-out script.`,
            payloadJson: JSON.stringify({ number: config.numbers.ambulance, script: "78-year-old diabetic woman on insulin, trapped by flood at Vijayanagar 3rd Main Road, Velachery. Cannot walk. Insulin unrefrigerated since last night." }),
            evidence: ["E3", "E1"],
            unresolved: [],
            priority: 3,
          },
        ],
      };
    },

    scam(calls: ToolCall[], _ctx: ToolContext) {
      const link = find(calls, "check_link");
      const news = find(calls, "search_web");
      const id = (t: string) => calls.find((c) => c.tool === t)?.id ?? "";
      return {
        summary: "This relief message is fake. The link is not a .gov.in site and it asks for bank details and OTP, which no government scheme does. Don't open it; warn the family group.",
        facts: [
          { field: "Claim", value: "₹5000 flood relief per family, register within 24 hours", status: "reported" as const, sources: ["E4"], verification: "conflict" as const, note: "No official source has this scheme." },
          { field: "Link", value: "tn-gov-relief.online (not a .gov.in domain)", status: "inferred" as const, sources: ["E4", id("check_link")], verification: "verified" as const },
          { field: "Scam signals", value: link?.summary ?? "Unknown", status: "inferred" as const, sources: [id("check_link")], verification: link ? ("verified" as const) : ("unverified" as const) },
          { field: "Official position", value: news?.summary ?? "Unknown", status: "inferred" as const, sources: [id("search_web")], verification: news ? ("verified" as const) : ("unverified" as const) },
        ],
        actions: [
          {
            kind: "warn" as const,
            title: "Don't open the link",
            detail: "It's built to steal bank details and OTP. Entering them can empty a bank account.",
            effect: "Marks the message as a scam on this device.",
            payloadJson: JSON.stringify({ text: "This ₹5000 relief link is fake. Never share bank details or OTP." }),
            evidence: ["E4", id("check_link")],
            unresolved: [],
            priority: 1,
          },
          {
            kind: "share" as const,
            title: "Warn the family group",
            detail: "Others in the group may already be filling it in.",
            effect: "Copies a short warning in Tamil and English for you to forward.",
            payloadJson: JSON.stringify({ text: "⚠️ The '₹5000 TN Govt flood relief' link is FAKE. It's not a .gov.in site. Don't enter bank details or OTP. Real relief comes through ration-card lists. இது போலி செய்தி. வங்கி விவரங்கள், OTP கொடுக்காதீர்கள்." }),
            evidence: ["E4", id("check_link"), id("search_web")],
            unresolved: [],
            priority: 2,
          },
          {
            kind: "poster" as const,
            title: "Make a warning poster for the family group",
            detail: "A picture travels further on WhatsApp than a text correction. Generated only if you approve.",
            effect: "Creates one image you can save and forward. Nothing is sent.",
            payloadJson: JSON.stringify({
              headline: "₹5000 flood relief link is FAKE",
              lines: ["It is not a .gov.in website", "No government scheme asks for bank details or OTP on a link", "Don't open it. Don't forward it.", "Report fraud: call 1930", "போலி செய்தி. வங்கி விவரங்கள், OTP கொடுக்காதீர்கள்."],
              lang: "English and Tamil",
            }),
            evidence: ["E4", id("check_link"), id("search_web")],
            unresolved: [],
            priority: 3,
          },
          {
            kind: "browser_fill" as const,
            title: "Fill the complaint form (practice)",
            detail: "Paalam opens the form and fills in what it already knows. It stops before Submit so you can check everything.",
            effect: "Opens the practice complaint form in a browser and fills 5 fields.",
            payloadJson: JSON.stringify({
              url: `http://localhost:${config.port}/practice/complaint`,
              steps: [
                { field: "Type of incident", value: "Fake relief or scheme" },
                { field: "Suspicious link or number", value: "http://tn-gov-relief.online/apply" },
                { field: "When did you receive it?", value: new Date().toISOString().slice(0, 10) },
                { field: "What happened?", value: "A WhatsApp forward claiming 'TN Govt Flood Relief ₹5000' asks families to enter bank details and OTP at tn-gov-relief.online. It is not a .gov.in site and no such scheme exists on official sources." },
                { field: "I confirm the details are true", value: "true" },
                { field: "OTP sent to your phone", value: "000000" },
              ],
            }),
            evidence: ["E4", id("check_link"), id("browse")],
            unresolved: ["Your name and mobile number"],
            priority: 3,
          },
          {
            kind: "call" as const,
            title: "Report to cybercrime helpline 1930",
            detail: "Reporting gets the domain taken down faster.",
            effect: "Opens the dialer with 1930.",
            payloadJson: JSON.stringify({ number: "1930", script: "Reporting a phishing site tn-gov-relief.online pretending to be Tamil Nadu flood relief, collecting bank details and OTP." }),
            evidence: ["E4"],
            unresolved: [],
            priority: 4,
          },
        ],
      };
    },
  },
};
