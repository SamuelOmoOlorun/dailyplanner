// Notification display only. This worker does not cache or fetch app pages.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const planner = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (planner) return planner.focus();
    return self.clients.openWindow('/');
  }));
});
