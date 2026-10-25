import { GoogleGenAI } from "@google/genai";
import { config, live } from "./config.js";

/**
 * Every Gemini model this project can chat with, for the model picker in Gem chats.
 * Asked from Google (so new models appear on their own) and cached for an hour.
 * Speech, image, embedding and live-audio models are left out: they can't answer a Gem.
 */

export interface ModelInfo {
  id: string;
  label: string;
  note?: string;
}

const NOT_CHAT = /(tts|image|embedding|live|transcribe|translate|banana|omni|exp-|preview-\d\d-\d\d|-\d{3}$)/i;
let cache: { at: number; list: ModelInfo[] } | null = null;

const version = (id: string) => {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(id);
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : 0;
};

function describe(id: string): ModelInfo {
  const label = id
    .replace(/^gemini-/, "Gemini ")
    .replace(/-/g, " ")
    .replace(/\b(pro|flash|lite|preview|argon)\b/g, (w) => w[0]!.toUpperCase() + w.slice(1));
  const note =
    id === config.gemini.argonModel
      ? "Argon's model: deepest, slowest"
      : id === config.gemini.gemModel
        ? "Default for Gems"
        : /lite/.test(id)
          ? "Fastest, lightest"
          : /pro/.test(id)
            ? "Stronger reasoning, slower"
            : /preview/.test(id)
              ? "Preview"
              : undefined;
  return { id, label, ...(note ? { note } : {}) };
}

export async function chatModels(): Promise<ModelInfo[]> {
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.list;
  const ids = new Set<string>([config.gemini.gemModel, config.gemini.argonModel]);
  if (live.gemini)
    try {
      const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : new GoogleGenAI({ vertexai: true, project: config.gemini.project, location: config.gemini.location });
      const pager = await ai.models.list({ config: { queryBase: true, pageSize: 200 } as never });
      for await (const m of pager) {
        const id = String(m.name ?? "").split("/").pop() ?? "";
        if (/^gemini-/.test(id) && !NOT_CHAT.test(id)) ids.add(id);
      }
    } catch (e) {
      console.warn("Listing models failed, offering the configured ones:", (e as Error).message.slice(0, 120));
    }
  const list = [...ids].sort((a, b) => version(b) - version(a) || a.localeCompare(b)).map(describe);
  cache = { at: Date.now(), list };
  return list;
}
