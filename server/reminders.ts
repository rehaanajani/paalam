import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";
import { DATA_DIR } from "./paths.js";
import type { FollowUpDraft } from "./types.js";

/**
 * Follow-ups. A Gem can propose reminders ("06:00 daily: protein breakfast",
 * "check the insulin in 4 hours"); they're stored here, fired on time in the
 * person's timezone, and delivered three ways: live to any open app (desktop
 * app → native notification, website → browser notification), and by Web Push
 * to phones and browsers that subscribed, even when Paalam isn't open.
 */

export interface Reminder {
  id: string;
  threadId: string;
  runId: string;
  gemId: string;
  title: string;
  message: string;
  daily?: string;
  at?: string;
  tz: string;
  nextAt: string;
  active: boolean;
  createdAt: string;
  lastFiredAt?: string;
}

export interface Notice {
  id: string;
  reminderId: string;
  threadId: string;
  gemId: string;
  title: string;
  message: string;
  at: string;
}

const FILE = join(DATA_DIR, "reminders.json");
const NOTICES = join(DATA_DIR, "notices.json");
const PUSH = join(DATA_DIR, "push.json");
const VAPID = join(DATA_DIR, "vapid.json");

const read = <T>(f: string, d: T): T => {
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : d;
  } catch {
    return d;
  }
};
const write = (f: string, v: unknown) => {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(f, JSON.stringify(v, null, 2));
};

let reminders: Reminder[] = read<Reminder[]>(FILE, []);
let notices: Notice[] = read<Notice[]>(NOTICES, []);
let subs: webpush.PushSubscription[] = read<webpush.PushSubscription[]>(PUSH, []);
const listeners = new Set<(n: Notice) => void>();

// ── Time zones: "06:00 daily" means 06:00 where the person is ──
function offsetMinutes(date: Date, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUTC - date.getTime()) / 60000);
}

export function nextDaily(hhmm: string, tz: string, from = new Date()): Date {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  for (let d = 0; d < 3; d++) {
    const day = new Date(from.getTime() + d * 86400000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(day).split("-").map(Number) as [number, number, number];
    const guess = Date.UTC(ymd[0], ymd[1] - 1, ymd[2], h, m);
    const at = new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
    if (at.getTime() > from.getTime() + 30000) return at;
  }
  return new Date(from.getTime() + 86400000);
}

const validTz = (tz?: string) => {
  try {
    if (tz) new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
};

// ── Store ──
export const reminderStore = {
  list: (threadId?: string) => reminders.filter((r) => !threadId || r.threadId === threadId),
  add(draft: FollowUpDraft & { inMinutes?: number }, ctx: { threadId: string; runId: string; gemId: string; tz?: string }): Reminder | null {
    const tz = validTz(ctx.tz);
    const daily = /^\d{1,2}:\d{2}$/.test(draft.daily ?? "") ? draft.daily!.padStart(5, "0") : undefined;
    const mins = Number(draft.inMinutes ?? 0);
    const at = draft.at ? new Date(draft.at) : mins > 0 ? new Date(Date.now() + mins * 60000) : null;
    if (!daily && (!at || isNaN(at.getTime()))) return null;
    const r: Reminder = {
      id: randomUUID().slice(0, 10),
      ...ctx,
      tz,
      title: String(draft.title).slice(0, 80),
      message: String(draft.message).slice(0, 240),
      ...(daily ? { daily } : { at: at!.toISOString() }),
      nextAt: (daily ? nextDaily(daily, tz) : at!).toISOString(),
      active: true,
      createdAt: new Date().toISOString(),
    };
    reminders.push(r);
    write(FILE, reminders);
    return r;
  },
  update(id: string, patch: Partial<Pick<Reminder, "active">>) {
    const r = reminders.find((x) => x.id === id);
    if (!r) return null;
    if (patch.active !== undefined) {
      r.active = patch.active;
      if (r.active && r.daily) r.nextAt = nextDaily(r.daily, r.tz).toISOString();
    }
    write(FILE, reminders);
    return r;
  },
  remove(id: string) {
    reminders = reminders.filter((r) => r.id !== id);
    write(FILE, reminders);
  },
  notices: () => notices,
  subscribe(fn: (n: Notice) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ── Web Push ──
function vapid() {
  let keys = read<{ publicKey: string; privateKey: string } | null>(VAPID, null);
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    write(VAPID, keys);
  }
  webpush.setVapidDetails("mailto:paalam@users.noreply.github.com", keys.publicKey, keys.privateKey);
  return keys.publicKey;
}
let publicKey = "";
export const pushKey = () => (publicKey ||= vapid());

export function addPushSubscription(sub: webpush.PushSubscription) {
  if (!sub?.endpoint) throw new Error("Not a push subscription");
  subs = [...subs.filter((s) => s.endpoint !== sub.endpoint), sub];
  write(PUSH, subs);
}

async function push(n: Notice) {
  if (!subs.length) return;
  pushKey();
  const payload = JSON.stringify({ title: n.title, body: n.message, url: `/#/bridge/${n.threadId}` });
  const dead: string[] = [];
  await Promise.all(
    subs.map((s) =>
      webpush.sendNotification(s, payload, { TTL: 3600 }).catch((e: { statusCode?: number }) => {
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
      }),
    ),
  );
  if (dead.length) {
    subs = subs.filter((s) => !dead.includes(s.endpoint));
    write(PUSH, subs);
  }
}

// ── The clock ──
function fire(r: Reminder) {
  const n: Notice = { id: randomUUID().slice(0, 10), reminderId: r.id, threadId: r.threadId, gemId: r.gemId, title: r.title, message: r.message, at: new Date().toISOString() };
  notices = [...notices, n].slice(-100);
  write(NOTICES, notices);
  for (const l of listeners) l(n);
  void push(n);
  r.lastFiredAt = n.at;
  if (r.daily) r.nextAt = nextDaily(r.daily, r.tz).toISOString();
  else r.active = false;
}

export function startReminderClock() {
  const tick = () => {
    const now = Date.now();
    let changed = false;
    for (const r of reminders) {
      if (r.active && Date.parse(r.nextAt) <= now) {
        fire(r);
        changed = true;
      }
    }
    if (changed) write(FILE, reminders);
  };
  tick();
  setInterval(tick, 20000).unref();
}
