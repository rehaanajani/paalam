import "./setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderStore, validDaily } from "../server/reminders.js";

const ctx = { threadId: "t1", runId: "r1", gemId: "g1", tz: "Asia/Kolkata" };

test("daily times must be real 24-hour times", () => {
  assert.equal(validDaily("6:00"), "06:00");
  assert.equal(validDaily("23:59"), "23:59");
  assert.equal(validDaily("24:00"), undefined);
  assert.equal(validDaily("25:99"), undefined);
  assert.equal(validDaily("12:60"), undefined);
  assert.equal(validDaily("noon"), undefined);
  assert.equal(validDaily(undefined), undefined);
});

test("an impossible daily time with no fallback is not saved", () => {
  assert.equal(reminderStore.add({ title: "x", message: "y", daily: "25:99" }, ctx), null);
});

test("a reminder needs a message, and gets a default title", () => {
  assert.equal(reminderStore.add({ title: "Hi", message: "  " , daily: "07:00" }, ctx), null);
  const r = reminderStore.add({ message: "Drink water", daily: "07:00" } as never, ctx);
  assert.ok(r);
  assert.equal(r.title, "Reminder");
  assert.equal(r.message, "Drink water");
});

test("a past one-off can't be switched back on", () => {
  const r = reminderStore.add({ title: "Check", message: "insulin", inMinutes: 1 }, ctx)!;
  assert.equal(reminderStore.update(r.id, { active: false })!.active, false);
  r.nextAt = new Date(Date.now() - 60_000).toISOString(); // its time has passed
  assert.equal(reminderStore.update(r.id, { active: true })!.active, false);
});

test("a daily reminder re-arms for its next occurrence", () => {
  const r = reminderStore.add({ title: "Breakfast", message: "protein", daily: "06:00" }, ctx)!;
  reminderStore.update(r.id, { active: false });
  const back = reminderStore.update(r.id, { active: true })!;
  assert.equal(back.active, true);
  assert.ok(Date.parse(back.nextAt) > Date.now());
});
