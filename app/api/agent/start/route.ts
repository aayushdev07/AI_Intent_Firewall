import { handle, readJson, str } from "@/lib/api";
import { startRun } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/** POST { intentId, scenarioId?, agent?: "scripted" | "live" | "auto" } → { runId, mode } */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const agent = body.agent === "live" || body.agent === "scripted" ? body.agent : "auto";
    const run = await startRun(str(body.intentId, "intentId"), {
      scenarioId: typeof body.scenarioId === "string" ? body.scenarioId : undefined,
      agent,
    });
    return { runId: run.id, mode: run.mode, status: run.status };
  });
}
