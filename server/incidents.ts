import { live } from "./config.js";
import { embed, within } from "./gemini.js";
import { cosine, km, overlap } from "./vectors.js";
import type { Run } from "./types.js";

/**
 * Every problem Paalam has handled, so a new report can be matched against
 * earlier ones: five calls about the same flooded street are one incident.
 * Matching uses Gemini Embeddings when available, keywords otherwise, and
 * boosts reports that are close together on the map.
 */

export interface Incident {
  threadId: string;
  runId: string;
  fragmentId: string;
  gemId: string;
  title: string;
  summary: string;
  at: string;
  lat?: number;
  lng?: number;
  vec?: number[];
}

let incidents: Incident[] = [];
export const allIncidents = () => incidents;
export const setIncidents = (list: Incident[]) => (incidents = list);

export async function recordRun(run: Run) {
  const fresh: Incident[] = run.fragments.map((f) => {
    const r = run.results.find((x) => x.fragmentId === f.id);
    const pin = r?.pins.find((p) => p.kind === "incident");
    return {
      threadId: run.threadId,
      runId: run.id,
      fragmentId: f.id,
      gemId: f.gemId,
      title: f.title,
      summary: r?.summary ?? f.summary,
      at: run.createdAt,
      ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
    };
  });
  if (live.gemini && fresh.length)
    try {
      const vecs = await embed(fresh.map((i) => `${i.title}. ${i.summary}`));
      fresh.forEach((i, n) => (i.vec = vecs[n]));
    } catch {
      /* keywords still work */
    }
  incidents = [...incidents.filter((i) => i.runId !== run.id), ...fresh].slice(-2000);
}

export async function similar(text: string, opts: { near?: { lat: number; lng: number }; excludeThread?: string } = {}) {
  const pool = incidents.filter((i) => i.threadId !== opts.excludeThread);
  if (!pool.length) return { engine: "none", matches: [] as (Incident & { score: number; km?: number })[] };
  let q: number[] | undefined;
  if (live.gemini && pool.some((i) => i.vec))
    try {
      [q] = await within(embed([text]), 4000);
    } catch {
      q = undefined;
    }
  const matches = pool
    .map((i) => {
      let score = q && i.vec ? cosine(q, i.vec) : overlap(text, `${i.title} ${i.summary}`) * 0.9;
      const d = opts.near && i.lat !== undefined && i.lng !== undefined ? km(opts.near, { lat: i.lat, lng: i.lng }) : undefined;
      if (d !== undefined) score += d < 1 ? 0.15 : d < 3 ? 0.07 : d > 25 ? -0.2 : 0;
      return { ...i, score: +score.toFixed(2), ...(d !== undefined ? { km: +d.toFixed(1) } : {}) };
    })
    .filter((m) => m.score >= (q ? 0.72 : 0.45))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ vec, ...m }) => m);
  return { engine: q ? "Gemini Embeddings" : "keywords", matches };
}
