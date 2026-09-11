/* DeskBreak service worker: offline shell + background push. */

const VERSION = "deskbreak-v3-1";
const SHELL = ["/app", "/app/start", "/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/character/stretch-fallback.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Network first for pages so a deploy is picked up immediately; cache first
 * for the character art and icons, which never change without a new file name.
 * Anything under /api is never cached.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isAsset =
    url.pathname.startsWith("/character/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/");

  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const app = await caches.match("/app");
          return app || caches.match("/offline");
        }),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Good time to move", body: "Your Desk Reset is ready.", url: "/app/start?source=push" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* a plain-text push still shows the default */
  }
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "deskbreak-reminder",
    renotify: false,
    data: { url: payload.url, breakId: payload.breakId || null },
    actions: payload.actions || [
      { action: "start", title: "Start" },
      { action: "snooze", title: "15 min" },
      { action: "skip", title: "Skip" },
    ],
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  const action = event.action || "start";
  const base = data.url || "/app/start?source=push";
  const target =
    action === "snooze"
      ? `/app?break=${encodeURIComponent(data.breakId || "")}&action=snooze`
      : action === "skip"
        ? `/app?break=${encodeURIComponent(data.breakId || "")}&action=skip`
        : base.includes("source=") ? base : `${base}${base.includes("?") ? "&" : "?"}source=push`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
