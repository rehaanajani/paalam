export type { ActionCard, AuditEntry, Evidence, Fact, Fragment, GemDef, GemResult, MapPin, Run, RunEvent, Stage, ToolCall, Usage } from "../server/types";

export interface Integration {
  id: string;
  name: string;
  live: boolean;
  env: string[];
  fallback?: string;
  uses?: string;
  models?: { argon: string; gem: string };
  checks?: { model: string; ok: boolean; error?: string }[];
}

export interface Status {
  demo: boolean;
  integrations: Integration[];
  city: { name: string; lat: number; lng: number };
  numbers: { emergency: string; ambulance: string; disaster: string };
  sample: { text: string; evidence: { id: string; name: string; kind: string }[] };
}

export interface ToolInfo {
  id: string;
  name: string;
  group: string;
  description: string;
  needs: string;
  live: boolean;
}
