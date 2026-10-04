import { handle, readJson, str } from "@/lib/api";
import { confirmIntent } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/** POST { intentId } — the user's confirmation makes the Original Intent immutable. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return { intent: await confirmIntent(str(body.intentId, "intentId")) };
  });
}
