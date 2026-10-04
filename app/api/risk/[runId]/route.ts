import { handle } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";
import { ServiceError } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  return handle(async () => {
    const run = await prisma.agentRun.findUnique({ where: { id: params.runId }, include: { trajectory: true } });
    if (!run) throw new ServiceError("Run not found.", 404, "NOT_FOUND");
    const assessments = await prisma.riskAssessment.findMany({
      where: { runId: params.runId },
      include: { action: { select: { sequence: true, toolName: true, decision: true } } },
      orderBy: { createdAt: "asc" },
    });
    const latest = assessments.at(-1);
    return {
      runId: params.runId,
      currentRisk: latest?.riskScore ?? 0,
      currentLevel: latest?.riskLevel ?? "LOW",
      maxRisk: run.trajectory?.maxRisk ?? 0,
      patterns: parseJson<string[]>(run.trajectory?.patterns, []),
      history: assessments.map((a) => ({
        sequence: a.action.sequence,
        tool: a.action.toolName,
        decision: a.action.decision,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
        alignmentScore: a.alignmentScore,
        factors: parseJson(a.factors, []),
      })),
    };
  });
}
