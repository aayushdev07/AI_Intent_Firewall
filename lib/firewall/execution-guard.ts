import type { Decision, ActionStatus } from "@/lib/types";
import { getExecutor } from "@/lib/tools/registry";
import type { ToolContext, ToolExecutionResult, ToolExecutor } from "@/lib/tools/types";
import { integrityHash } from "./integrity";

export type GuardedAction = {
  id: string;
  runId: string;
  sequence: number;
  toolName: string;
  arguments: Record<string, unknown>;
  status: ActionStatus;
  decision?: Decision | null;
  integrityHash: string;
};

export type ApprovalRecord = { decision: "PENDING" | "APPROVED" | "DENIED"; scope?: string } | null | undefined;

/**
 * Independent execution check. It does not trust the caller (frontend, API
 * client, or even the agent loop): it re-derives authorization from the stored
 * decision, the stored approval, and an integrity hash over the exact action.
 */
export function authorizeExecution(action: GuardedAction, approval: ApprovalRecord): { ok: boolean; reason: string } {
  if (!action.decision) return { ok: false, reason: "Action was never evaluated by IntentGuard." };
  if (action.decision === "BLOCK" || action.status === "BLOCKED") return { ok: false, reason: "Blocked actions never execute (Rule 10)." };
  if (action.status === "EXECUTED") return { ok: false, reason: "Action was already executed." };
  const expected = integrityHash(action.runId, action.sequence, action.toolName, action.arguments);
  if (expected !== action.integrityHash) return { ok: false, reason: "Integrity check failed: action changed after evaluation." };
  if (action.decision === "ALLOW" && action.status === "ALLOWED") return { ok: true, reason: "Allowed by IntentGuard." };
  if (action.decision === "WARN") {
    if (approval?.decision === "APPROVED" && (approval.scope ?? "SINGLE_ACTION") === "SINGLE_ACTION") {
      return { ok: true, reason: "Human approval granted for this single action." };
    }
    return { ok: false, reason: approval?.decision === "DENIED" ? "Human approver denied this action." : "Awaiting human approval." };
  }
  return { ok: false, reason: `Action status ${action.status} is not executable.` };
}

/** The ONLY code path that invokes a tool executor. Authorization is checked before the executor is even looked up. */
export async function executeGuarded(
  action: GuardedAction,
  approval: ApprovalRecord,
  ctx: ToolContext,
  lookup: (name: string) => ToolExecutor | undefined = getExecutor,
): Promise<{ executed: true; result: ToolExecutionResult } | { executed: false; reason: string }> {
  const auth = authorizeExecution(action, approval);
  if (!auth.ok) return { executed: false, reason: auth.reason };
  const executor = lookup(action.toolName);
  if (!executor) return { executed: false, reason: `No executor registered for ${action.toolName}.` };
  return { executed: true, result: await executor(action.arguments, ctx) };
}
