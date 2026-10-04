import { handle, readJson, str } from "@/lib/api";
import { processProposal } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/**
 * POST { runId, toolName, arguments, reason } — THE SECURITY BOUNDARY.
 * Evaluates and records a proposed action. It never executes it;
 * execution requires a separate call to /api/actions/execute.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const runId = str(body.runId, "runId");
    const result = await processProposal(
      runId,
      { toolName: body.toolName, arguments: body.arguments, reason: typeof body.reason === "string" ? body.reason : "" },
      "API",
      { autoExecute: false },
    );
    return { actionId: result.actionId, sequence: result.sequence, ...result.evaluation };
  });
}
