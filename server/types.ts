/** Shared shapes for the whole pipeline. The web app imports these too. */
import type { Usage } from "./harness/index.js";
export type { Usage };

export type ModelTier = "argon" | "gem";

/** One uploaded file or recording, kept as evidence for the whole run. */
export interface Evidence {
  id: string; // "E1", "E2"… cited by facts
  kind: "text" | "image" | "audio" | "pdf" | "other";
  name: string;
  mimeType: string;
  /** base64; dropped from what the client sees */
  data?: string;
  text?: string;
  capturedAt?: string; // EXIF or recording time
  gps?: { lat: number; lng: number };
}

export interface GemDef {
  id: string;
  name: string;
  /** one line the router reads when choosing */
  purpose: string;
  instructions: string;
  tools: string[];
  model: ModelTier;
  color: string;
  /** "starter" ships with Paalam, "user" was built in Gem Studio, "auto" Argon built it */
  origin: "starter" | "user" | "auto" | "plugin";
  knowledge?: string[];
  createdAt: string;
}

/** A slice of the messy input that belongs to one Gem. */
export interface Fragment {
  id: string;
  gemId: string;
  title: string;
  summary: string;
  evidence: string[];
  urgency: "critical" | "high" | "medium" | "low";
  language?: string;
}

export type FactStatus = "reported" | "inferred" | "unknown";
export type Verification = "verified" | "unverified" | "conflict" | "pending";

export interface Fact {
  id: string;
  field: string;
  value: string;
  status: FactStatus;
  /** evidence ids or tool ids this came from */
  sources: string[];
  verification: Verification;
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
}

export type ActionKind =
  | "navigate"
  | "call"
  | "sms"
  | "share"
  | "alert"
  | "readback"
  | "request"
  | "warn"
  | "browser_fill"
  | "browser_submit"
  | "poster";

export interface ActionCard {
  id: string;
  gemId: string;
  fragmentId: string;
  kind: ActionKind;
  title: string;
  detail: string;
  /** what will actually happen on approve, shown verbatim */
  effect: string;
  payload: Record<string, unknown>;
  evidence: string[];
  unresolved: string[];
  priority: number; // 1 = do first
  status: "awaiting" | "approved" | "declined" | "done" | "failed";
  result?: string;
  /** screenshot id from the browser, shown on the card */
  shotId?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  gemId: string;
  args: Record<string, any>;
  ok: boolean;
  demo: boolean;
  summary: string;
  data?: any;
  ms: number;
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "incident" | "help" | "route" | "user";
  gemId?: string;
}

/** What a Gem decided its answer needs to be. */
export type ResponseMode = "answer" | "plan" | "actions";

export interface PlanSection {
  heading: string;
  items: string[];
}

/** A reminder a Gem proposes: once at a time, or daily at a local time. */
export interface FollowUpDraft {
  title: string;
  message: string;
  daily?: string; // "HH:MM" local time
  at?: string; // ISO date-time for a one-off
}

export interface GemResult {
  gemId: string;
  fragmentId: string;
  mode?: ResponseMode;
  /** the Gem's answer in its own words (answer and plan modes) */
  reply?: string;
  plan?: { title: string; sections: PlanSection[] };
  /** reminder ids created from this answer */
  reminders?: string[];
  summary: string;
  facts: Fact[];
  actions: ActionCard[];
  tools: ToolCall[];
  pins: MapPin[];
  route?: { from: [number, number]; to: [number, number]; polyline?: [number, number][]; minutes?: number; km?: number };
}

export type Stage = "intake" | "split" | "gems" | "verify" | "actions" | "done" | "error";

export interface AuditEntry {
  at: string;
  who: string; // "argon", gem id, "you"
  what: string;
}

export interface Run {
  id: string;
  /** a Bridge: the conversation this run belongs to */
  threadId: string;
  /** set when the person messaged one Gem directly, skipping Argon's split */
  target?: string;
  createdAt: string;
  stage: Stage;
  demo: boolean;
  input: {
    text: string;
    evidence: Evidence[];
    near?: { lat: number; lng: number };
    /** Simple mode: an elder speaking, so replies are short, calm and read aloud */
    simple?: boolean;
    /** the person's time zone, for reminders */
    tz?: string;
    /** what was said earlier in this Bridge, condensed, so Argon and the Gems remember */
    history?: string;
  };
  language?: string;
  headline?: string;
  fragments: Fragment[];
  results: GemResult[];
  /** Argon's direct answer when the message had nothing to act on */
  reply?: string;
  /** set when no Gem fitted and Argon drafted one */
  proposedGem?: GemDef;
  audit: AuditEntry[];
  /** what the injection shield found in untrusted input */
  shield?: { flagged: boolean; reasons: string[]; engine: string };
  usage: Usage;
  error?: string;
}

export interface RunEvent {
  type: "stage" | "fragment" | "tool" | "result" | "fact" | "action" | "audit" | "done" | "error";
  stage?: Stage;
  gemId?: string;
  data?: unknown;
}
