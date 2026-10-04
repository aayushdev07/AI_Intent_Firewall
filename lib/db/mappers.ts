import type { Action as ActionRow, Approval, Intent as IntentRow } from "@prisma/client";
import type { ActionStatus, Decision, IntentConstraint, OriginalIntent, ResultMeta, RiskTolerance, TrajectoryEntry } from "@/lib/types";
import { parseJson } from "./json";

export function intentFromRow(row: IntentRow): OriginalIntent | null {
  if (row.status !== "CONFIRMED" || !row.immutable) return null;
  return {
    id: row.id,
    goal: row.goal,
    constraints: parseJson<IntentConstraint[]>(row.constraints, []),
    allowedResources: parseJson<string[]>(row.allowedResources, []),
    expectedActions: parseJson<string[]>(row.expectedActions, []),
    restrictedActions: parseJson<string[]>(row.restrictedActions, []),
    sensitiveDataAllowed: row.sensitiveDataAllowed,
    externalTransferAllowed: row.externalTransferAllowed,
    allowedDestinations: parseJson<string[]>(row.allowedDestinations, []),
    budgetLimit: row.budgetLimit ?? undefined,
    riskTolerance: row.riskTolerance as RiskTolerance,
    createdAt: row.createdAt.toISOString(),
    immutable: true,
    ambiguities: parseJson<string[]>(row.ambiguities, []),
  };
}

export function intentView(row: IntentRow) {
  return {
    id: row.id,
    userRequest: row.userRequest,
    goal: row.goal,
    constraints: parseJson<IntentConstraint[]>(row.constraints, []),
    allowedResources: parseJson<string[]>(row.allowedResources, []),
    expectedActions: parseJson<string[]>(row.expectedActions, []),
    restrictedActions: parseJson<string[]>(row.restrictedActions, []),
    sensitiveDataAllowed: row.sensitiveDataAllowed,
    externalTransferAllowed: row.externalTransferAllowed,
    allowedDestinations: parseJson<string[]>(row.allowedDestinations, []),
    budgetLimit: row.budgetLimit,
    riskTolerance: row.riskTolerance as RiskTolerance,
    ambiguities: parseJson<string[]>(row.ambiguities, []),
    parserSource: row.parserSource,
    status: row.status,
    immutable: row.immutable,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}
export type IntentView = ReturnType<typeof intentView>;

export function trajectoryEntryFromRow(row: ActionRow & { approval?: Approval | null }): TrajectoryEntry {
  return {
    actionId: row.id,
    sequence: row.sequence,
    toolName: row.toolName,
    arguments: parseJson<Record<string, unknown>>(row.arguments, {}),
    status: row.status as ActionStatus,
    decision: (row.decision as Decision) ?? undefined,
    alignmentScore: row.alignmentScore ?? undefined,
    riskScore: row.riskScore ?? undefined,
    approval: (row.approval?.decision as TrajectoryEntry["approval"]) ?? undefined,
    resultMeta: parseJson<ResultMeta | undefined>(row.resultMeta, undefined),
  };
}
