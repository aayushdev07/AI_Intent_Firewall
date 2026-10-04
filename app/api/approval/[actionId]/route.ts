import { handle, readJson } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { decideApproval, getRunDetail, ServiceError } from "@/lib/services/run-service";
import { driveRun } from "@/lib/services/runner";

export const dynamic = "force-dynamic";

/** POST { decision: "APPROVE" | "DENY", note? } — approval applies to this single action only. */
export async function POST(req: Request, { params }: { params: { actionId: string } }) {
  return handle(async () => {
    const body = await readJson(req);
    const d = body.decision === "APPROVE" ? "APPROVED" : body.decision === "DENY" ? "DENIED" : null;
    if (!d) throw new ServiceError('decision must be "APPROVE" or "DENY".', 400, "INVALID_INPUT");
    const result = await decideApproval(params.actionId, d, "user", typeof body.note === "string" ? body.note.slice(0, 500) : undefined);
    const action = await prisma.action.findUnique({
      where: { id: params.actionId },
      select: { runId: true, run: { select: { status: true, intent: { select: { conversationId: true } } } } },
    });
    // Chat runs are driven on the server: continue the agent after the human decision.
    if (action?.run.status === "RUNNING" && action.run.intent.conversationId) driveRun(action.runId);
    return { ...result, run: action ? await getRunDetail(action.runId) : null };
  });
}
