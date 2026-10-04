import type { Prisma } from "@prisma/client";
import type { Evaluation } from "@/lib/types";

export async function nextReceiptId(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.actionReceipt.count();
  return `REC-${(10001 + count).toString()}`;
}

/** Full, self-contained receipt payload — what an auditor needs to reconstruct the decision. */
export function receiptPayload(input: {
  receiptId: string;
  userIntent: string;
  intentHash: string | null;
  runId: string;
  actionId: string;
  sequence: number;
  toolName: string;
  args: Record<string, unknown>;
  reasonProposed: string;
  proposedBy: string;
  evaluation: Evaluation;
}) {
  const e = input.evaluation;
  return {
    receiptId: input.receiptId,
    timestamp: new Date().toISOString(),
    userIntent: input.userIntent,
    intentHash: input.intentHash,
    runId: input.runId,
    actionId: input.actionId,
    sequence: input.sequence,
    agent: "Worker Agent",
    proposedBy: input.proposedBy,
    action: input.toolName,
    arguments: input.args,
    agentReason: input.reasonProposed,
    alignment: e.alignmentScore,
    risk: e.riskScore,
    riskLevel: e.riskLevel,
    decision: e.decision,
    reason: e.reason,
    violations: e.violations,
    policyCodes: e.details.violations.map((v) => v.code),
    patterns: e.details.patterns,
    alignmentFactors: e.details.alignmentFactors,
    riskFactors: e.details.riskFactors,
    evaluationSteps: e.details.evaluationSteps,
    thresholds: e.details.effectiveThresholds,
    failSafe: e.details.failSafe,
  };
}
