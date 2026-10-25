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
    config: { tools: [{ googleSearch: {} }], temperature: 0, maxOutputTokens: 400, ...(unsupported.has(`${config.gemini.gemModel}:thinking`) ? {} : { thinkingConfig: { thinkingBudget: 0 } }) },
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

let embedClient: GoogleGenAI | null = null;
const embedAi = () =>
  config.gemini.apiKey ? ai() : (embedClient ??= new GoogleGenAI({ vertexai: true, project: config.gemini.project, location: config.gemini.embedLocation }));

type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";
const pending = new Map<EmbedTask, { texts: string[]; waiters: { start: number; count: number; resolve: (v: number[][]) => void; reject: (e: unknown) => void }[]; timer: NodeJS.Timeout }>();

async function embedNow(texts: string[], task: EmbedTask): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const res = await embedAi().models.embedContent({
      model: config.gemini.embedModel,
      contents: texts.slice(i, i + 100),
      config: { outputDimensionality: 768, taskType: task },
    });
    out.push(...(res.embeddings ?? []).map((e) => e.values ?? []));
  }
  return out;
}

/**
 * Text embeddings for knowledge search and similar-report matching. Requests made
 * within a few milliseconds of each other (three Gems searching at once) are merged
 * into one call instead of queuing behind each other.
 */
export function embed(texts: string[], task: EmbedTask = "SEMANTIC_SIMILARITY"): Promise<number[][]> {
  if (texts.length > 20) return embedNow(texts, task);
  return new Promise((resolve, reject) => {
    let batch = pending.get(task);
    if (!batch) {
      batch = {
        texts: [],
        waiters: [],
        timer: setTimeout(async () => {
          pending.delete(task);
          try {
            const vecs = await embedNow(batch!.texts, task);
            for (const w of batch!.waiters) w.resolve(vecs.slice(w.start, w.start + w.count));
          } catch (e) {
            for (const w of batch!.waiters) w.reject(e);
          }
        }, 30),
      };
      pending.set(task, batch);
    }
    batch.waiters.push({ start: batch.texts.length, count: texts.length, resolve, reject });
    batch.texts.push(...texts);
  });
}

/** Resolves with the value, or rejects once `ms` pass: for calls with a cheaper fallback. */
export const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`slower than ${ms} ms`)), ms))]);

/** One image from Gemini's image model. Returns the bytes and their type. */
export async function generateImage(prompt: string): Promise<{ data: Buffer; mimeType: string }> {
  const res = await ai().models.generateContent({
    model: config.gemini.imageModel,
    contents: prompt,
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error(`${config.gemini.imageModel} returned no image`);
  return { data: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType ?? "image/png" };
}

/** Confirms each configured model exists for this key, so a retired name shows up on the Keys screen, not mid-demo. */
export async function checkModels() {
  if (!live.gemini) return;
  const { modelCheck } = await import("./config.js");
  const models = { argon: config.gemini.argonModel, gem: config.gemini.gemModel, image: config.gemini.imageModel, embed: config.gemini.embedModel };
  await Promise.all(
    Object.entries(models).map(async ([k, model]) => {
      try {
        // Embedding models don't support a metadata lookup on Vertex, so test them by embedding.
        if (k === "embed") await embed(["ok"]);
        else await ai().models.get({ model });
        modelCheck[k] = { model, ok: true };
      } catch (e) {
        modelCheck[k] = { model, ok: false, error: (e as Error).message.slice(0, 160) };
        console.warn(`Model check failed for ${k} (${model}): ${(e as Error).message.slice(0, 160)}`);
      }
    }),
  );
}

/**
 * Google's first call on a fresh connection is slow (embeddings measured at ~16 s cold
 * vs ~2 s warm). Warm the embedding and model connections at startup and every few
 * minutes, with tiny calls, so a person's first message doesn't pay for it.
 */
export function keepWarm() {
  if (!live.gemini) return;
  const warm = async () => {
    await Promise.allSettled([
      embed(["warm"]),
      ai().models.generateContent({ model: config.gemini.gemModel, contents: "ok", config: { maxOutputTokens: 1 } }),
      ai().models.generateContent({ model: config.gemini.argonModel, contents: "ok", config: { maxOutputTokens: 1 } }),
    ]);
  };
  void warm();
  setInterval(warm, 4 * 60 * 1000).unref();
}
