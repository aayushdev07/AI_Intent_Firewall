import { handle, readJson, str } from "@/lib/api";
import { startFromIntent } from "@/lib/services/chat-service";

export const dynamic = "force-dynamic";

/** POST { intentId } — the user confirmed the understood request: seal it and start the agent. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return { runId: await startFromIntent(str(body.intentId, "intentId")) };
  });
}
