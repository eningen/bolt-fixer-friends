/* Push notification service worker (not an app-shell cache). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Stickman video", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Stickman video";
  const options = {
    body: payload.body || "",
    icon: "/app-icon-512.png",
    badge: "/app-icon-512.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {}
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
