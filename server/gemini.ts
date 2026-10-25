import { GoogleGenAI, MediaResolution, type GenerateContentConfig, type Part } from "@google/genai";
import { config, live } from "./config.js";
import { budget, record, type Usage } from "./harness/index.js";
import type { Evidence, ModelTier } from "./types.js";

let client: GoogleGenAI | null = null;

function ai() {
  if (!live.gemini) throw new Error("Gemini is not configured. Set GEMINI_API_KEY (or Vertex settings) in .env.");
  if (!client)
    client = config.gemini.apiKey
      ? new GoogleGenAI({ apiKey: config.gemini.apiKey })
      : new GoogleGenAI({ vertexai: true, project: config.gemini.project, location: config.gemini.location });
  return client;
}

export const modelFor = (tier: ModelTier) => (tier === "argon" ? config.gemini.argonModel : config.gemini.gemModel);

/** Evidence → Gemini parts. Every item is labelled so the model can cite it by id. */
export function evidenceParts(items: Evidence[]): Part[] {
  const parts: Part[] = [];
  for (const e of items) {
    const meta = [`[${e.id}] ${e.kind} "${e.name}"`, e.capturedAt && `captured ${e.capturedAt}`, e.gps && `gps ${e.gps.lat},${e.gps.lng}`]
      .filter(Boolean)
      .join(" · ");
    parts.push({ text: meta });
    if (e.text) parts.push({ text: e.text });
    else if (e.data) parts.push({ inlineData: { mimeType: e.mimeType, data: e.data } });
  }
  return parts;
}

// Models that don't accept a thinking budget or media resolution get a second try without them.
const unsupported = new Set<string>();

/**
 * Ask a model for JSON matching `schema`, within the harness budget for its tier.
 * The schema is enforced by the API; correctness is not, which is why everything
 * goes through the trust layer after.
 */
export async function askJSON<T>(opts: {
  tier: ModelTier;
  step: string;
  usage: Usage;
  system: string;
  prompt: string;
  schema: object;
  evidence?: Evidence[];
  temperature?: number;
}): Promise<T> {
  const model = modelFor(opts.tier);
  const b = opts.tier === "argon" ? budget.argon : budget.gem;
  const base: GenerateContentConfig = {
    systemInstruction: opts.system,
    responseMimeType: "application/json",
    responseJsonSchema: opts.schema,
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: b.maxOutput,
  };
  const tuned: GenerateContentConfig = { ...base };
  if (!unsupported.has(`${model}:thinking`) && b.thinking >= 0) tuned.thinkingConfig = { thinkingBudget: b.thinking };
  if (!unsupported.has(`${model}:media`) && opts.evidence?.some((e) => e.data)) tuned.mediaResolution = MediaResolution[b.media];

  const contents = [{ role: "user", parts: [...evidenceParts(opts.evidence ?? []), { text: opts.prompt }] }];
  const started = Date.now();
  let res;
  try {
    res = await ai().models.generateContent({ model, contents, config: tuned });
  } catch (e) {
    const msg = (e as Error).message;
    if (!/thinking|media.?resolution|INVALID_ARGUMENT/i.test(msg)) throw e;
    if (/thinking/i.test(msg)) unsupported.add(`${model}:thinking`);
    if (/media/i.test(msg)) unsupported.add(`${model}:media`);
    res = await ai().models.generateContent({ model, contents, config: base });
  }
  const u = res.usageMetadata;
  record(opts.usage, {
    step: opts.step,
    model,
    input: u?.promptTokenCount ?? 0,
    output: u?.candidatesTokenCount ?? 0,
    thinking: u?.thoughtsTokenCount ?? 0,
    ms: Date.now() - started,
  });
  const text = res.text ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${opts.step}: model returned invalid JSON (${text.slice(0, 160)})`);
  }
}

/** Google Search grounding: a short answer plus the web sources it used. */
export async function groundedSearch(question: string, usage?: Usage) {
  const started = Date.now();
  const res = await ai().models.generateContent({
    model: config.gemini.gemModel,
    contents: `${question}\nAnswer in at most 2 sentences.`,
    config: { tools: [{ googleSearch: {} }], temperature: 0, maxOutputTokens: 300 },
  });
  if (usage)
    record(usage, {
      step: "tool:search_web",
      model: config.gemini.gemModel,
      input: res.usageMetadata?.promptTokenCount ?? 0,
      output: res.usageMetadata?.candidatesTokenCount ?? 0,
      thinking: res.usageMetadata?.thoughtsTokenCount ?? 0,
      ms: Date.now() - started,
    });
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title: string } => !!w?.uri)
    .map((w) => ({ title: w.title ?? w.uri, url: w.uri }))
    .slice(0, 5);
  return { answer: res.text ?? "", sources };
}
