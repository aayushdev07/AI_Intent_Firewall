import { handle, readJson } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { ServiceError } from "@/lib/services/run-service";
import { sendAlert } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

/**
 * POST { delaySeconds? } — sends a test risk alert through Web Push after a delay,
 * so you can leave or close the tab and check that background notifications arrive.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const delay = Math.min(Math.max(Number(body.delaySeconds ?? 10) || 10, 3), 60);
    const subs = await prisma.pushSubscription.count();
    if (!subs) throw new ServiceError("Background alerts aren't set up in this browser yet. Press “Enable background” first.", 409, "NO_SUBSCRIPTION");
    setTimeout(() => {
      void sendAlert({
        kind: "test",
        title: "IntentGuard test alert",
        body: "Background alerts work. This is how you'll hear about risky actions when the app isn't open.",
        tag: `ig-test-${Date.now()}`,
        url: "/settings",
        actionId: "test",
      });
    }, delay * 1000);
    return { ok: true, delaySeconds: delay, subscriptions: subs };
  });
}
