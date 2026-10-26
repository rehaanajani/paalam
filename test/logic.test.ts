import "./setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDaily } from "../server/reminders.js";
import { cleanMission } from "../server/mission.js";
import { cosine, km, overlap } from "../server/vectors.js";

test("daily reminders fire at the person's local time", () => {
  // 10:00 in Chennai (UTC+5:30) is 04:30 UTC; asked at 03:00 UTC, the next 18:00 IST is 12:30 UTC the same day.
  const from = new Date("2026-10-27T03:00:00Z");
  assert.equal(nextDaily("18:00", "Asia/Kolkata", from).toISOString(), "2026-10-27T12:30:00.000Z");
  // Already past 06:00 IST, so tomorrow's.
  assert.equal(nextDaily("06:00", "Asia/Kolkata", from).toISOString(), "2026-10-28T00:30:00.000Z");
});

test("a mission edit keeps only valid fields", () => {
  const m = cleanMission({ statement: "New problem", suggestions: ["a", "", 5, "b", "c", "d", "e", "f", "g"], hiddenGems: ["flood", 3], showDemo: "yes", evil: "x" });
  assert.equal(m.statement, "New problem");
  assert.deepEqual(m.suggestions, ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(m.hiddenGems, ["flood"]);
  assert.equal("showDemo" in m, false);
  assert.equal("evil" in m, false);
});

test("distance and similarity helpers", () => {
  const d = km({ lat: 12.9791, lng: 80.2209 }, { lat: 13.0827, lng: 80.2707 }); // Velachery to Chennai Central
  assert.ok(d > 11 && d < 14, `got ${d}`);
  assert.equal(Math.round(cosine([1, 0], [1, 0]) * 100), 100);
  assert.ok(overlap("flood water rising velachery", "water rising in velachery since morning") > overlap("flood water rising velachery", "insulin storage without power"));
});
