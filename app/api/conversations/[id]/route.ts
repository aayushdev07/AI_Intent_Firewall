import { handle, readJson, str } from "@/lib/api";
import { archiveConversation, getConversation, renameConversation } from "@/lib/services/chat-service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(() => getConversation(params.id));
}

/** PATCH { title } — rename a chat. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const body = await readJson(req);
    await renameConversation(params.id, str(body.title, "title"));
    return { ok: true };
  });
}

/** DELETE — hides the chat. Its action receipts stay in the audit log. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await archiveConversation(params.id);
    return { ok: true };
  });
}
