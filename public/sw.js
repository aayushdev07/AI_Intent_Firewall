/* IntentGuard service worker: risk alerts that reach you when the app isn't open.
 * It only shows notifications and relays your Allow once / Block choice to the server.
 * The server still re-checks everything; a notification button cannot approve a blocked action. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function show(alert) {
  const approval = alert.kind === "approval";
  return self.registration.showNotification(alert.title, {
    body: alert.body,
    tag: alert.tag,
    renotify: true,
    requireInteraction: approval,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    data: { url: alert.url, actionId: alert.actionId, kind: alert.kind },
    actions: approval
      ? [
          { action: "block", title: "Block" },
          { action: "allow", title: "Allow once" },
        ]
      : [{ action: "open", title: "View" }],
  });
}

self.addEventListener("push", (event) => {
  let alert = null;
  try {
    alert = event.data ? event.data.json() : null;
  } catch (e) {
    alert = null;
  }
  if (!alert || !alert.title) return;
  event.waitUntil(show(alert));
});

// Pages can ask the worker to show an alert (used while the tab is open in the background).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "ig-alert") event.waitUntil(show(event.data.alert));
});

async function focusOrOpen(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if (new URL(c.url).origin === self.location.origin) {
      await c.focus();
      if ("navigate" in c) await c.navigate(url).catch(() => {});
      return;
    }
  }
  await self.clients.openWindow(url);
}

async function decide(actionId, decision) {
  const res = await fetch(`/api/approval/${encodeURIComponent(actionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  const ok = res.ok;
  const data = await res.json().catch(() => ({}));
  await self.registration.showNotification(ok ? (decision === "APPROVE" ? "Allowed once" : "Blocked") : "Couldn't apply your choice", {
    body: ok
      ? decision === "APPROVE"
        ? "The assistant will carry on with this one step."
        : "The step was not carried out. The assistant will continue without it."
      : data.error || "Open IntentGuard to decide.",
    tag: `ig-result-${actionId}`,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
  });
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  all.forEach((c) => c.postMessage({ type: "ig-refresh" }));
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();
  if (data.kind === "approval" && (event.action === "allow" || event.action === "block")) {
    event.waitUntil(decide(data.actionId, event.action === "allow" ? "APPROVE" : "DENY"));
    return;
  }
  event.waitUntil(focusOrOpen(data.url || "/chat"));
});
