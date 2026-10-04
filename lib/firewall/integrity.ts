import { createHash } from "node:crypto";

/** Canonical JSON (sorted keys) so equal arguments always hash identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function actionSignature(toolName: string, args: Record<string, unknown>): string {
  return createHash("sha256").update(`${toolName}|${canonicalJson(args)}`).digest("hex").slice(0, 32);
}

/** Binds a decision to the exact action that was evaluated (tool + args + run + position). */
export function integrityHash(runId: string, sequence: number, toolName: string, args: Record<string, unknown>): string {
  return createHash("sha256").update(`${runId}|${sequence}|${toolName}|${canonicalJson(args)}`).digest("hex");
}

/** Fingerprint of a confirmed Original Intent — lets us prove it never changed. */
export function intentHash(intent: {
  goal: string;
  allowedResources: string[];
  expectedActions: string[];
  restrictedActions: string[];
  sensitiveDataAllowed: boolean;
  externalTransferAllowed: boolean;
  allowedDestinations?: string[];
  budgetLimit?: number | null;
  riskTolerance: string;
}): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        goal: intent.goal,
        allowedResources: intent.allowedResources,
        expectedActions: intent.expectedActions,
        restrictedActions: intent.restrictedActions,
        sensitiveDataAllowed: intent.sensitiveDataAllowed,
        externalTransferAllowed: intent.externalTransferAllowed,
        allowedDestinations: intent.allowedDestinations ?? [],
        budgetLimit: intent.budgetLimit ?? null,
        riskTolerance: intent.riskTolerance,
      }),
    )
    .digest("hex");
}
