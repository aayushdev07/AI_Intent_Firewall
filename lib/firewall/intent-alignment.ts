import type { ActionProposal, OriginalIntent, ScoreFactor, ToolMetadata } from "@/lib/types";
import { keywordTokens, matchDestination, referencedResources, SENSITIVE_RESOURCES, toolMentionedInGoal } from "./resources";
import type { TrajectoryState } from "./trajectory";

export type AlignmentResult = { score: number; factors: ScoreFactor[]; referencedResources: string[] };

/**
 * Intent Alignment Engine — deterministic 0–100 score of how well a proposed
 * action fits the confirmed Original Intent, given the trajectory so far.
 *
 * An optional semantic hint (0–1) from the LLM may nudge the score by at most
 * ±4 points. It can never move an action across a policy boundary on its own:
 * the number is always computed and bounded here.
 */
export function calculateAlignment(
  proposal: ActionProposal,
  tool: ToolMetadata,
  intent: OriginalIntent,
  state: TrajectoryState,
  semanticHint?: number,
): AlignmentResult {
  const factors: ScoreFactor[] = [{ label: "Baseline", points: 50 }];
  const add = (label: string, points: number) => points !== 0 && factors.push({ label, points });

  const expected = intent.expectedActions.includes(tool.name);
  const restricted = intent.restrictedActions.includes(tool.name);
  const allowed = new Set(intent.allowedResources);

  // 1–4. Goal relevance, expected and restricted actions
  if (expected) add("Listed in the intent's expected actions", 38);
  else if (restricted) add("Listed in the intent's restricted/unnecessary actions", -15);
  else add("Not among the intent's expected actions", -8);
  if (toolMentionedInGoal(tool.name, intent.goal)) add("Tool subject is named in the user's goal", 2);

  // 2. Allowed resources
  if (tool.resource) {
    if (allowed.has(tool.resource)) add(`Reads an authorized resource (${tool.resource})`, 8);
    else add(`Reads a resource outside the intent (${tool.resource})`, restricted ? -5 : -10);
  }

  // 7. Arguments — which data does this action actually touch?
  const refs = referencedResources(proposal.arguments, { taintedFiles: state.taintedFiles, toolName: tool.name }).filter(
    (r) => r !== tool.resource,
  );
  const unauthorizedRefs = refs.filter((r) => !allowed.has(r));
  if (unauthorizedRefs.length) add(`Arguments reference unauthorized data (${unauthorizedRefs.join(", ")})`, -8 * Math.min(unauthorizedRefs.length, 2));

  if (!tool.resource && (tool.category === "COMPUTE" || tool.category === "CREATE")) {
    const inputs = refs.length ? refs : Array.from(state.executedResources);
    if (inputs.length > 0 && inputs.every((r) => allowed.has(r)) && !state.sensitiveDataHeld) {
      add("Operates only on data already authorized for this task", 6);
    }
  }
  const goalTokens = new Set(keywordTokens(intent.goal));
  const argTokens = keywordTokens(Object.values(proposal.arguments).filter((v) => typeof v === "string").join(" "));
  const overlap = argTokens.filter((t) => goalTokens.has(t)).length;
  if (overlap > 0) add("Arguments match terms from the goal", Math.min(overlap * 2, 4));

  // 5. Sensitive data
  if (tool.dataClassification === "SENSITIVE" && !intent.sensitiveDataAllowed) add("Sensitive data not authorized by the user", -5);

  // 6. External transfer
  if (tool.externalImpact === "HIGH") {
    if (!intent.externalTransferAllowed) add("External transfer not authorized by the user", -20);
    else {
      const m = matchDestination(proposal.arguments[tool.destinationArg ?? ""], intent.allowedDestinations);
      if (m === "EXACT") add("Destination exactly matches the user's instruction", 4);
      if (m === "AMBIGUOUS") add("Destination only loosely matches the user's instruction", -6);
      if (m === "MISMATCH") add("Destination was never named by the user", -18);
    }
  }

  // 8–9. Previous trajectory and its direction
  const consumesSensitive = refs.some((r) => SENSITIVE_RESOURCES.has(r));
  if ((tool.category === "CREATE" || tool.category === "TRANSFER") && consumesSensitive) add("Moves sensitive data further along the trajectory", -10);
  if (state.expectedCompleted && !expected) add("Requested task was already complete", -4);
  if (state.deviationCount > 0) add(`Trajectory already contains ${state.deviationCount} deviating action(s)`, -4 * Math.min(state.deviationCount, 3));
  if (state.untrustedInstructionsDetected && !expected) add("Follows untrusted content that contained instructions", -8);

  // Optional, bounded semantic hint
  if (typeof semanticHint === "number" && Number.isFinite(semanticHint)) {
    const h = Math.max(0, Math.min(1, semanticHint));
    add("Model relevance hint (bounded ±4)", Math.round((h - 0.5) * 8));
  }

  const raw = factors.reduce((s, f) => s + f.points, 0);
  return { score: Math.max(0, Math.min(100, Math.round(raw))), factors, referencedResources: refs };
}
