// App-shell cache so Paalam opens on a bad connection. API calls always go to the network.
const CACHE = "paalam-v3";
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icon.svg", "/manifest.webmanifest"])).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/") || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      // Offline: the cached copy, and the cached app shell only for page loads (never HTML for a script).
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("/") : Response.error()))),
  );
});

// Follow-up reminders pushed by the Paalam server, shown even when Paalam isn't open.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Paalam", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(self.registration.showNotification(data.title || "Paalam", { body: data.body || "", icon: "/icon.svg", badge: "/icon.svg", data: { url: data.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      if (open) return open.focus().then(() => open.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
