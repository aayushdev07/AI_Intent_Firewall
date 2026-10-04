/** Browser side of risk alerts: service worker, permission and Web Push subscription. */

export type Alert = {
  kind: "approval" | "blocked" | "test";
  title: string;
  body: string;
  tag: string;
  url: string;
  actionId: string;
  createdAt: string;
};

export type AlertSupport = "unsupported" | "default" | "granted" | "denied";

export function alertSupport(): AlertSupport {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as AlertSupport;
}

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Asks for permission and subscribes to Web Push. Returns how alerts will be delivered:
 * "push" reaches you even with the tab closed (browser running); "local" works while a tab is open.
 */
export async function enableAlerts(): Promise<"push" | "local" | "denied" | "unsupported"> {
  if (alertSupport() === "unsupported") return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registerWorker();
  if (!reg) return "unsupported";
  try {
    await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch("/api/push")).json();
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    return res.ok ? "push" : "local";
  } catch {
    // Push needs the browser's push service (internet). Without it, alerts still work while a tab is open.
    return "local";
  }
}

export async function disableAlerts() {
  const reg = await registerWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

export async function pushSubscribed(): Promise<boolean> {
  const reg = await registerWorker();
  return Boolean(await reg?.pushManager.getSubscription());
}

/** Show a system notification from an open (background) tab, via the worker so the buttons work. */
export async function showSystemAlert(alert: Alert) {
  if (alertSupport() !== "granted") return;
  const reg = await registerWorker();
  await navigator.serviceWorker.ready.catch(() => null);
  reg?.active?.postMessage({ type: "ig-alert", alert });
}

/** When the page is visible the in-app toast is enough: clear any duplicate system notification. */
export async function clearSystemAlert(tag: string) {
  const reg = await registerWorker();
  const list = (await reg?.getNotifications({ tag }).catch(() => [])) ?? [];
  list.forEach((n) => n.close());
}
