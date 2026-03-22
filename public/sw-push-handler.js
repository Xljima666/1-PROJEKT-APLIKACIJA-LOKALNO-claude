// Push notification service worker listener
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "GEO TERRA INFO";
  const options = {
    body: data.body || "Imate nadolazeći zadatak sutra!",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.url || "/dashboard",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/dashboard")
  );
});
