import { api } from "./api";
import type { Reminder } from "./components/Reminders";

/**
 * Inside the Android app (Capacitor), reminders are scheduled on the phone itself with
 * Local Notifications, so "06:00 daily: breakfast" fires even offline or with Paalam closed.
 * On the web and in the desktop app this file does nothing.
 */

type Cap = { isNativePlatform?: () => boolean };
export const isNativeApp = () => !!(window as unknown as { Capacitor?: Cap }).Capacitor?.isNativePlatform?.();

// Local Notifications need numeric ids; derive a stable one from each reminder's id.
const numericId = (id: string) => {
  let h = 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2147483000;
};

let started = false;

export async function syncPhoneReminders() {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;

  if (!started) {
    started = true;
    await LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
      const thread = e.notification.extra?.threadId;
      if (thread) location.hash = `/bridge/${thread}`;
    });
  }

  const reminders = await api<Reminder[]>("reminders");
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

  const notifications = reminders
    .filter((r) => r.active)
    .map((r) => {
      const [hour, minute] = (r.daily ?? "").split(":").map(Number);
      return {
        id: numericId(r.id),
        title: r.title,
        body: r.message,
        extra: { threadId: (r as Reminder & { threadId?: string }).threadId },
        schedule: r.daily ? { on: { hour: hour!, minute: minute! }, allowWhileIdle: true } : { at: new Date(r.nextAt), allowWhileIdle: true },
      };
    })
    .filter((n) => !("at" in n.schedule) || (n.schedule.at as Date).getTime() > Date.now());
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
