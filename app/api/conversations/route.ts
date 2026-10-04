import { handle } from "@/lib/api";
import { listConversations } from "@/lib/services/chat-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ({ conversations: await listConversations() }));
}
