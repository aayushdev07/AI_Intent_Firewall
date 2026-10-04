import { handle, readJson } from "@/lib/api";
import { ServiceError } from "@/lib/services/run-service";
import { getVapidKeys, removeSubscription, saveSubscription } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

/** GET — the public VAPID key the browser needs to subscribe. */
export async function GET() {
  return handle(async () => ({ publicKey: (await getVapidKeys()).publicKey }));
}

/** POST PushSubscription JSON — store this browser's subscription for risk alerts. */
export async function POST(req: Request) {
  return handle(async () => {
    try {
      await saveSubscription((await readJson(req)) as Parameters<typeof saveSubscription>[0]);
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : "Invalid subscription.", 400, "INVALID_INPUT");
    }
    return { ok: true };
  });
}

/** DELETE { endpoint } */
export async function DELETE(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    if (typeof body.endpoint === "string") await removeSubscription(body.endpoint);
    return { ok: true };
  });
}
