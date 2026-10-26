import "./setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceTrust } from "../server/trust.js";
import type { ActionCard, Fact, GemResult, Run, ToolCall } from "../server/types.js";

const run = { input: { text: "flooding at Velachery", evidence: [{ id: "E1", kind: "image", name: "a.jpg", mimeType: "image/jpeg" }] } } as unknown as Run;
const tool = (id: string, extra: Partial<ToolCall> = {}): ToolCall => ({ id, tool: "geocode", gemId: "flood", args: {}, ok: true, demo: false, summary: "", ms: 1, ...extra });
const fact = (f: Partial<Fact>): Fact => ({ id: "f", field: "Location", value: "x", status: "reported", sources: [], verification: "verified", ...f });
const action = (a: Partial<ActionCard>): ActionCard => ({ id: "a", gemId: "flood", fragmentId: "F1", kind: "call", title: "Call", detail: "", effect: "", payload: {}, evidence: [], unresolved: [], priority: 1, status: "awaiting", ...a });
const result = (r: Partial<GemResult>): GemResult => ({ gemId: "flood", fragmentId: "F1", summary: "", facts: [], actions: [], tools: [], pins: [], ...r });

test("a fact marked verified with no tool behind it is downgraded", async () => {
  const r = result({ facts: [fact({ sources: ["MSG"] })] });
  await enforceTrust(r, run);
  assert.equal(r.facts[0]!.verification, "unverified");
});

test("a fact backed by a successful tool stays verified and names the tool", async () => {
  const r = result({ tools: [tool("T1")], facts: [fact({ sources: ["T1"] })] });
  await enforceTrust(r, run);
  assert.equal(r.facts[0]!.verification, "verified");
  assert.equal(r.facts[0]!.verifiedBy, "geocode");
});

test("a failed tool does not count as verification", async () => {
  const r = result({ tools: [tool("T1", { ok: false })], facts: [fact({ sources: ["T1"] })] });
  await enforceTrust(r, run);
  assert.equal(r.facts[0]!.verification, "unverified");
});

test("citations to evidence that doesn't exist are removed", async () => {
  const r = result({ facts: [fact({ sources: ["E1", "E9", "T404"], verification: "unverified" })] });
  const log = await enforceTrust(r, run);
  assert.deepEqual(r.facts[0]!.sources, ["E1"]);
  assert.ok(log.some((l) => l.includes("removed 2")));
});

test("an invented phone number is flagged; official helplines are not", async () => {
  const r = result({ actions: [action({ id: "a1", payload: { number: "9876543210" } }), action({ id: "a2", payload: { number: "108" } })] });
  await enforceTrust(r, run);
  assert.equal(r.actions[0]!.unresolved.length, 1);
  assert.equal(r.actions[1]!.unresolved.length, 0);
});

test("a number returned by Places counts as known", async () => {
  const r = result({ tools: [tool("T1", { tool: "places_nearby", data: { places: [{ name: "Clinic", lat: 1, lng: 1, phone: "044 2222 3333" }] } })], actions: [action({ payload: { number: "044 2222 3333" } })] });
  await enforceTrust(r, run);
  assert.equal(r.actions[0]!.unresolved.length, 0);
});

test("navigation to a place no Maps tool returned is flagged", async () => {
  const r = result({ tools: [tool("T1", { data: { lat: 12.97, lng: 80.22 } })], actions: [action({ id: "near", kind: "navigate", payload: { lat: 12.9701, lng: 80.2201 } }), action({ id: "far", kind: "navigate", payload: { lat: 13.5, lng: 80.9 } })] });
  await enforceTrust(r, run);
  assert.equal(r.actions[0]!.unresolved.length, 0);
  assert.equal(r.actions[1]!.unresolved.length, 1);
});

test("Aadhaar and phone numbers are masked before anything is shared", async () => {
  const r = result({ actions: [action({ kind: "share", payload: { text: "Ravi 1234 5678 9012, call 98765 43210" } })] });
  await enforceTrust(r, run);
  const text = String(r.actions[0]!.payload.text);
  assert.ok(!text.includes("1234 5678 9012"));
  assert.ok(!text.includes("98765 43210"));
  assert.ok(text.includes("9012"), "keeps the last four digits so the person can recognise it");
});
