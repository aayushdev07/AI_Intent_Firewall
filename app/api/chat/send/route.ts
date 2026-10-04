import { handle, readJson, str } from "@/lib/api";
import { sendMessage } from "@/lib/services/chat-service";

export const dynamic = "force-dynamic";

/** POST { conversationId?, message } — understands the request and, if no confirmation is needed, starts the protected agent. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const conversationId = typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;
    return sendMessage(conversationId, str(body.message, "message"));
  });
}
