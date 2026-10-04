import { handle, readJson, str } from "@/lib/api";
import { getRunDetail, stepRun } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/** POST { runId } — the worker agent proposes exactly one next action; IntentGuard decides. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const runId = str(body.runId, "runId");
    const step = await stepRun(runId);
    return {
      outcome: step.outcome,
      evaluation: "action" in step && step.action ? { actionId: step.action.actionId, ...step.action.evaluation } : null,
      run: await getRunDetail(runId),
    };
  });
}
