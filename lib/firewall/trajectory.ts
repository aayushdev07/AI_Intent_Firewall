import type { ActionProposal, OriginalIntent, ToolMetadata, TrajectoryEntry } from "@/lib/types";
import { getToolMetadata } from "@/lib/tools/registry";
import { SENSITIVE_RESOURCES, referencedResources } from "./resources";
import { actionSignature } from "./integrity";

/**
 * Trajectory Tracker — derives the security state of a run from the complete
 * ordered sequence of prior actions. Every new proposal is evaluated against
 * this state, never in isolation.
 */
export type TrajectoryState = {
  entries: TrajectoryEntry[];
  executedTools: string[];
  attemptedTools: string[];
  sensitiveAccessAttempted: boolean;
  sensitiveDataHeld: boolean;
  untrustedContentSeen: boolean;
  untrustedInstructionsDetected: boolean;
  injectionSignals: string[];
  /** filename (lower-case) → resources it was built from (attempted or executed). */
  taintedFiles: Map<string, string[]>;
  expectedCompleted: boolean;
  deviationCount: number;
  warnedCount: number;
  blockedCount: number;
  alignmentHistory: number[];
  blockedSignatures: Set<string>;
  /** Resources whose access was blocked or denied by a human. */
  deniedResources: Set<string>;
  /** Resources actually released to the agent by executed actions. */
  executedResources: Set<string>;
};

export function buildTrajectoryState(entries: TrajectoryEntry[], intent: OriginalIntent): TrajectoryState {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  const state: TrajectoryState = {
    entries: sorted,
    executedTools: [],
    attemptedTools: [],
    sensitiveAccessAttempted: false,
    sensitiveDataHeld: false,
    untrustedContentSeen: false,
    untrustedInstructionsDetected: false,
    injectionSignals: [],
    taintedFiles: new Map(),
    expectedCompleted: false,
    deviationCount: 0,
    warnedCount: 0,
    blockedCount: 0,
    alignmentHistory: [],
    blockedSignatures: new Set(),
    deniedResources: new Set(),
    executedResources: new Set(),
  };

  for (const e of sorted) {
    const meta = getToolMetadata(e.toolName);
    state.attemptedTools.push(e.toolName);
    const executed = e.status === "EXECUTED";
    if (executed) state.executedTools.push(e.toolName);
    if (typeof e.alignmentScore === "number") {
      state.alignmentHistory.push(e.alignmentScore);
      if (e.alignmentScore < 50) state.deviationCount++;
    }
    if (e.decision === "WARN") state.warnedCount++;
    if (e.decision === "BLOCK") {
      state.blockedCount++;
      state.blockedSignatures.add(actionSignature(e.toolName, e.arguments));
    }

    const refs = referencedResources(e.arguments, { taintedFiles: state.taintedFiles, toolName: e.toolName });
    const resources = new Set(refs);
    if (meta?.resource) resources.add(meta.resource);

    if (meta?.dataClassification === "SENSITIVE" || refs.some((r) => SENSITIVE_RESOURCES.has(r))) {
      state.sensitiveAccessAttempted = true;
    }
    if (executed && (meta?.dataClassification === "SENSITIVE" || e.resultMeta?.containsSensitive)) {
      state.sensitiveDataHeld = true;
    }
    if (executed && meta?.resource) state.executedResources.add(meta.resource);

    const deniedOrBlocked = e.decision === "BLOCK" || e.approval === "DENIED";
    if (deniedOrBlocked && meta?.resource) state.deniedResources.add(meta.resource);

    if (executed && e.resultMeta?.untrusted) state.untrustedContentSeen = true;
    if (executed && e.resultMeta?.injectionDetected) {
      state.untrustedInstructionsDetected = true;
      state.injectionSignals.push(...(e.resultMeta.injectionSignals ?? []));
    }

    if (e.toolName === "create_file" && typeof e.arguments.filename === "string") {
      const sensitiveRefs = refs.filter((r) => SENSITIVE_RESOURCES.has(r));
      const taintedByResult = e.resultMeta?.producedFile?.tainted;
      if (sensitiveRefs.length || taintedByResult) {
        state.taintedFiles.set(e.arguments.filename.trim().toLowerCase(), sensitiveRefs.length ? sensitiveRefs : ["tainted_content"]);
      }
    }
  }

  state.injectionSignals = Array.from(new Set(state.injectionSignals));
  state.expectedCompleted =
    intent.expectedActions.length > 0 &&
    intent.expectedActions
      .filter((a) => getToolMetadata(a)?.category !== "TRANSFER")
      .every((a) => state.executedTools.includes(a));
  return state;
}

export type TrajectoryPattern =
  | "SENSITIVE_COLLECTION_THEN_TRANSFER"
  | "COLLECT_PACKAGE_TRANSFER"
  | "SENSITIVE_PACKAGING"
  | "POST_COMPLETION_DEVIATION"
  | "UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION"
  | "USE_OF_DENIED_DATA"
  | "ALIGNMENT_DECLINE"
  | "REPEATED_BLOCKED_ATTEMPT";

export const PATTERN_LABELS: Record<TrajectoryPattern, string> = {
  SENSITIVE_COLLECTION_THEN_TRANSFER: "Sensitive data collection followed by an external transfer",
  COLLECT_PACKAGE_TRANSFER: "Collect → package into file → transfer out",
  SENSITIVE_PACKAGING: "Sensitive data being packaged into a file",
  POST_COMPLETION_DEVIATION: "New activity after the requested task was already complete",
  UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION: "Privileged action proposed after reading untrusted instructions",
  USE_OF_DENIED_DATA: "Attempt to use data whose access was denied or blocked",
  ALIGNMENT_DECLINE: "Trajectory is drifting away from the original intent",
  REPEATED_BLOCKED_ATTEMPT: "Re-proposal of an action that was already blocked",
};

export function detectPatterns(
  proposal: ActionProposal,
  tool: ToolMetadata,
  intent: OriginalIntent,
  state: TrajectoryState,
  currentRefs: string[],
): TrajectoryPattern[] {
  const p: TrajectoryPattern[] = [];
  const expected = intent.expectedActions.includes(tool.name);
  const refsSensitive = currentRefs.some((r) => SENSITIVE_RESOURCES.has(r));
  const touchesTaintedFile = Object.values(proposal.arguments).some(
    (v) => typeof v === "string" && state.taintedFiles.has(v.trim().toLowerCase()),
  );

  if (tool.category === "TRANSFER" && (state.sensitiveAccessAttempted || refsSensitive)) {
    p.push("SENSITIVE_COLLECTION_THEN_TRANSFER");
  }
  if (tool.category === "TRANSFER" && (state.taintedFiles.size > 0 || touchesTaintedFile) && state.sensitiveAccessAttempted) {
    p.push("COLLECT_PACKAGE_TRANSFER");
  }
  if (tool.category === "CREATE" && refsSensitive) p.push("SENSITIVE_PACKAGING");
  if (state.expectedCompleted && !expected) p.push("POST_COMPLETION_DEVIATION");
  if (
    state.untrustedInstructionsDetected &&
    !expected &&
    (tool.requiresExplicitAuthorization || tool.dataClassification === "SENSITIVE" || tool.category === "TRANSFER" || refsSensitive)
  ) {
    p.push("UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION");
  }
  const resources = new Set(currentRefs);
  if (tool.resource) resources.add(tool.resource);
  if (Array.from(resources).some((r) => state.deniedResources.has(r) && !state.executedResources.has(r))) {
    p.push("USE_OF_DENIED_DATA");
  }
  const h = state.alignmentHistory;
  if (h.length >= 2 && h[h.length - 1] < h[h.length - 2] && h[h.length - 1] < 60) p.push("ALIGNMENT_DECLINE");
  if (state.blockedSignatures.has(actionSignature(proposal.toolName, proposal.arguments))) p.push("REPEATED_BLOCKED_ATTEMPT");
  return p;
}

export function isExpected(intent: OriginalIntent, toolName: string) {
  return intent.expectedActions.includes(toolName);
}
