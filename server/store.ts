import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, live } from "./config.js";
import { bearer } from "./google.js";
import { getJSON } from "./tools/http.js";
import type { Run } from "./types.js";
import type { Incident } from "./incidents.js";

/**
 * Where Bridges live between restarts. Locally: JSON files in data/. On Cloud
 * Run, whose disk is wiped: Firestore (PERSIST=firestore). Each run is stored
 * as one JSON string field, without file bytes, which keeps documents small.
 */

const DATA = join(process.cwd(), "data");
const strip = (r: Run): Run => ({ ...r, input: { ...r.input, evidence: r.input.evidence.map(({ data, ...e }) => e) } });
const fsBase = () => `https://firestore.googleapis.com/v1/projects/${config.gemini.project}/databases/(default)/documents`;

async function fsPut(collection: string, id: string, value: unknown) {
  const res = await fetch(`${fsBase()}/${collection}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(await bearer()) },
    body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(value) }, at: { timestampValue: new Date().toISOString() } } }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

async function fsList<T>(collection: string): Promise<T[]> {
  const out: T[] = [];
  let page = "";
  do {
    const r = await getJSON(`${fsBase()}/${collection}?pageSize=300${page ? `&pageToken=${page}` : ""}`, { headers: await bearer() });
    for (const d of r.documents ?? []) out.push(JSON.parse(d.fields?.json?.stringValue ?? "null"));
    page = r.nextPageToken ?? "";
  } while (page);
  return out.filter(Boolean);
}

export const store = {
  engine: () => (live.firestore ? "Firestore" : config.persist === "memory" ? "memory" : "file"),

  async saveRun(run: Run) {
    const r = strip(run);
    try {
      if (live.firestore) await fsPut("runs", r.id, r);
      else if (config.persist !== "memory") {
        mkdirSync(join(DATA, "runs"), { recursive: true });
        writeFileSync(join(DATA, "runs", `${r.id}.json`), JSON.stringify(r));
      }
    } catch (e) {
      console.warn("Saving run failed:", (e as Error).message);
    }
  },

  async loadRuns(): Promise<Run[]> {
    try {
      if (live.firestore) return await fsList<Run>("runs");
      const dir = join(DATA, "runs");
      if (config.persist === "memory" || !existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Run);
    } catch (e) {
      console.warn("Loading runs failed:", (e as Error).message);
      return [];
    }
  },

  async saveIncidents(list: Incident[]) {
    try {
      if (live.firestore) await fsPut("meta", "incidents", list);
      else if (config.persist !== "memory") {
        mkdirSync(DATA, { recursive: true });
        writeFileSync(join(DATA, "incidents.json"), JSON.stringify(list));
      }
    } catch (e) {
      console.warn("Saving incidents failed:", (e as Error).message);
    }
  },

  async loadIncidents(): Promise<Incident[]> {
    try {
      if (live.firestore) {
        const r = await getJSON(`${fsBase()}/meta/incidents`, { headers: await bearer() }).catch(() => null);
        return r ? JSON.parse(r.fields?.json?.stringValue ?? "[]") : [];
      }
      const f = join(DATA, "incidents.json");
      return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
    } catch {
      return [];
    }
  },
};
