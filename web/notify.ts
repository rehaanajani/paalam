import { api } from "./api";

/**
 * Notifications for follow-ups, wherever Paalam runs:
 * - website: browser notifications while open, and Web Push (via the service worker) when closed;
 * - desktop app: the Electron main process shows native notifications itself, so the page stays quiet;
 * - Android app: reminders are scheduled on the phone with Capacitor Local Notifications (see mobile.ts).
 */

const isDesktop = () => !!(window as unknown as { paalamDesktop?: unknown }).paalamDesktop;

export const notificationState = (): NotificationPermission | "unsupported" => (isDesktop() ? "granted" : "Notification" in window ? Notification.permission : "unsupported");

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Asks for permission and, where supported, subscribes this browser to Web Push. */
export async function enableNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (isDesktop()) return "granted";
  if (!("Notification" in window)) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm === "granted") await subscribePush().catch(() => {});
  return perm;
}

async function subscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api<{ key: string }>("push/key");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  await api("push/subscribe", { json: sub.toJSON() });
}

export interface Notice {
  id: string;
  threadId: string;
  title: string;
  message: string;
  at: string;
}

/** Listens for reminders firing while the page is open. Returns the cleanup. */
export function listenForNotices(onNotice: (n: Notice) => void) {
  const es = new EventSource("/api/notifications/stream");
  es.onmessage = (m) => {
    const n = JSON.parse(m.data) as Notice;
    onNotice(n);
    // The desktop app shows its own native notification; a page with a push subscription gets one from the service worker.
    if (!isDesktop() && notificationState() === "granted" && document.visibilityState === "visible") {
      const note = new Notification(n.title, { body: n.message, icon: "/icon.svg", tag: n.id });
      note.onclick = () => {
        window.focus();
        location.hash = `/bridge/${n.threadId}`;
      };
    }
  };
  return () => es.close();
}
