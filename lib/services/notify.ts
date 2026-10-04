import webpush from "web-push";
import { prisma } from "@/lib/db/client";

/**
 * Web Push alerts for risky actions. Lets the user leave the tab (or close it, with the browser
 * still running) and still be told when IntentGuard pauses or blocks something.
 * VAPID keys come from the environment, or are generated once and stored in the Setting table.
 */

const VAPID_KEY = "vapid";
type Vapid = { publicKey: string; privateKey: string };

let cached: Vapid | null = null;

export async function getVapidKeys(): Promise<Vapid> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const row = await prisma.setting.findUnique({ where: { key: VAPID_KEY } });
  if (row) {
    try {
      cached = JSON.parse(row.value) as Vapid;
      return cached;
    } catch {
      /* regenerate below */
    }
  }
  const keys = webpush.generateVAPIDKeys();
  await prisma.setting.upsert({ where: { key: VAPID_KEY }, create: { key: VAPID_KEY, value: JSON.stringify(keys) }, update: { value: JSON.stringify(keys) } });
  cached = keys;
  return keys;
}

export async function saveSubscription(sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }) {
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new Error("Invalid push subscription.");
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, p256dh, auth }, update: { p256dh, auth } });
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type { AlertPayload } from "@/lib/chat-policy";
import type { AlertPayload } from "@/lib/chat-policy";

/** Best effort: alerting must never break or delay the security pipeline. */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  try {
    const subs = await prisma.pushSubscription.findMany();
    if (!subs.length) return;
    const { publicKey, privateKey } = await getVapidKeys();
    webpush.setVapidDetails("mailto:alerts@intentguard.local", publicKey, privateKey);
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 900, urgency: "high" });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await removeSubscription(s.endpoint);
        }
      }),
    );
  } catch (err) {
    console.warn("[IntentGuard alerts] push failed:", err instanceof Error ? err.message : err);
  }
}
