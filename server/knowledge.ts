import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { live } from "./config.js";
import { embed } from "./gemini.js";
import { cosine, overlap } from "./vectors.js";

/**
 * The knowledge base Gems cite: Markdown or text files in knowledge/ (and
 * plugins/knowledge/). With a Gemini key it's searched by meaning (Gemini
 * Embeddings); without one, by keywords. Vectors are cached in data/.
 */

interface Chunk {
  id: string;
  file: string;
  title: string;
  source?: string;
  text: string;
  vec?: number[];
}

const DIRS = [join(process.cwd(), "knowledge"), join(process.cwd(), "plugins", "knowledge")];
const CACHE = join(process.cwd(), "data", "knowledge-vectors.json");
let chunks: Chunk[] = [];
let embedded = false;
let indexing: Promise<void> | null = null;

function chunkFile(path: string): Chunk[] {
  const raw = readFileSync(path, "utf8");
  const file = basename(path);
  const title = /^#\s+(.+)$/m.exec(raw)?.[1]?.trim() ?? file;
  const source = /^(?:source|sources?):\s*(\S+)/im.exec(raw)?.[1];
  const out: Chunk[] = [];
  let section = title;
  let buf = "";
  const flush = () => {
    const text = buf.trim();
    if (text.length > 40) out.push({ id: createHash("sha1").update(file + text).digest("hex").slice(0, 12), file, title: section, ...(source ? { source } : {}), text });
    buf = "";
  };
  for (const line of raw.split("\n")) {
    const h = /^#{1,3}\s+(.+)$/.exec(line);
    if (h || buf.length > 900) flush();
    if (h) section = h[1]!.trim();
    else if (!/^sources?:/i.test(line.trim())) buf += `${line}\n`;
  }
  flush();
  return out;
}

export function loadKnowledge() {
  chunks = DIRS.filter(existsSync).flatMap((d) =>
    readdirSync(d)
      .filter((f) => /\.(md|txt)$/i.test(f) && f.toLowerCase() !== "readme.md")
      .map((f) => join(d, f)),
  ).flatMap(chunkFile);
  embedded = false;
  return chunks.length;
}

/** One shared indexing job, so Gems searching at the same moment don't each embed everything. */
export function ensureVectors() {
  if (embedded || !live.gemini || !chunks.length) return Promise.resolve();
  indexing ??= buildVectors().finally(() => (indexing = null));
  return indexing;
}

async function buildVectors() {
  let cache: Record<string, number[]> = {};
  try {
    if (existsSync(CACHE)) cache = JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    cache = {};
  }
  const missing = chunks.filter((c) => !cache[c.id]);
  if (missing.length) {
    const vecs = await embed(missing.map((c) => `${c.title}\n${c.text}`), "RETRIEVAL_DOCUMENT");
    missing.forEach((c, i) => (cache[c.id] = vecs[i]!));
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  for (const c of chunks) c.vec = cache[c.id];
  embedded = true;
}

export async function searchKnowledge(query: string, k = 3) {
  if (!chunks.length) loadKnowledge();
  let scored: { c: Chunk; score: number }[];
  let engine = "keywords";
  try {
    await ensureVectors();
    if (embedded) {
      const [q] = await embed([query], "RETRIEVAL_QUERY");
      scored = chunks.map((c) => ({ c, score: c.vec ? cosine(q!, c.vec) : 0 }));
      engine = "Gemini Embeddings";
    } else scored = chunks.map((c) => ({ c, score: overlap(query, `${c.title} ${c.text}`) }));
  } catch {
    scored = chunks.map((c) => ({ c, score: overlap(query, `${c.title} ${c.text}`) }));
  }
  const min = engine === "keywords" ? 0.15 : 0.55;
  const hits = scored
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ c, score }) => ({ file: c.file, title: c.title, source: c.source, score: +score.toFixed(2), text: c.text.slice(0, 600) }));
  return { engine, hits, total: chunks.length };
}
