import { evaluateAction } from "@/lib/firewall/decision-engine";
import { executeGuarded } from "@/lib/firewall/execution-guard";
import { integrityHash } from "@/lib/firewall/integrity";
import { parseIntentRuleBased } from "@/lib/llm/intent-parser";
import { getExecutor } from "@/lib/tools/registry";
import type { ActionProposal, Evaluation, OriginalIntent, TrajectoryEntry } from "@/lib/types";
import { DEFAULT_SECURITY, DEFAULT_THRESHOLDS } from "@/lib/types";
import type { PriorResult } from "@/lib/tools/types";

export const CONFIG = { thresholds: DEFAULT_THRESHOLDS, security: DEFAULT_SECURITY };

export function confirmedIntent(request: string): OriginalIntent {
  const d = parseIntentRuleBased(request);
  return { ...d, id: "intent-test", createdAt: new Date(0).toISOString(), immutable: true };
}

/**
 * In-memory replica of the service loop (evaluate → guard → execute) so the
 * end-to-end security story can be tested without a database.
 */
export async function simulate(
  intent: OriginalIntent,
  proposals: ActionProposal[],
  approvals: Record<number, "APPROVED" | "DENIED"> = {},
  executor = getExecutor,
) {
  const trajectory: TrajectoryEntry[] = [];
  const results: PriorResult[] = [];
  const evaluations: Evaluation[] = [];
  for (const [i, p] of proposals.entries()) {
    const sequence = i + 1;
    const e = evaluateAction(p, intent, trajectory, CONFIG);
    evaluations.push(e);
    const entry: TrajectoryEntry = {
      actionId: `a${sequence}`, sequence, toolName: p.toolName, arguments: p.arguments,
      status: e.decision === "ALLOW" ? "ALLOWED" : e.decision === "WARN" ? "WARNED" : "BLOCKED",
      decision: e.decision, alignmentScore: e.alignmentScore, riskScore: e.riskScore,
    };
    const approvalDecision = e.decision === "WARN" ? approvals[sequence] ?? "DENIED" : undefined;
    if (approvalDecision) entry.approval = approvalDecision;
    const out = await executeGuarded(
      { id: entry.actionId, runId: "run", sequence, toolName: p.toolName, arguments: p.arguments, status: entry.status, decision: e.decision, integrityHash: integrityHash("run", sequence, p.toolName, p.arguments) },
      approvalDecision ? { decision: approvalDecision } : null,
      { runId: "run", priorResults: results },
      executor,
    );
    if (out.executed) {
      entry.status = "EXECUTED";
      entry.resultMeta = out.result.meta;
      results.push({ toolName: p.toolName, output: out.result.output, meta: out.result.meta });
    }
    trajectory.push(entry);
  }
  return { evaluations, trajectory };
}
