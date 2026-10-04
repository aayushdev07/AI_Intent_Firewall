import type { OriginalIntent, RiskLevel, RiskThresholds, ScoreFactor, ToolMetadata, Violation } from "@/lib/types";
import { matchDestination, SENSITIVE_RESOURCES } from "./resources";
import type { TrajectoryPattern, TrajectoryState } from "./trajectory";
import type { ActionProposal } from "@/lib/types";

export type RiskResult = { score: number; level: RiskLevel; factors: ScoreFactor[] };

/** Risk tolerance shifts the thresholds slightly; "low" uses the configured values. */
export function effectiveThresholds(base: RiskThresholds, tolerance: OriginalIntent["riskTolerance"]): RiskThresholds {
  const shift = tolerance === "high" ? 10 : tolerance === "medium" ? 5 : 0;
  return { mediumMin: Math.min(base.mediumMin + shift, 95), highMin: Math.min(base.highMin + shift, 99) };
}

export function riskLevelFor(score: number, t: RiskThresholds): RiskLevel {
  if (score >= t.highMin) return "HIGH";
  if (score >= t.mediumMin) return "MEDIUM";
  return "LOW";
}

/**
 * Risk Engine — deterministic, trajectory-aware 0–100 risk score.
 * current action + previous actions + trajectory patterns + intent deviation +
 * sensitive data + external transfer + suspicious history + alignment decline +
 * policy violations + external impact.
 */
export function calculateRisk(input: {
  proposal: ActionProposal;
  tool: ToolMetadata;
  intent: OriginalIntent;
  state: TrajectoryState;
  alignment: number;
  referencedResources: string[];
  patterns: TrajectoryPattern[];
  violations: Violation[];
  thresholds: RiskThresholds;
}): RiskResult {
  const { proposal, tool, intent, state, alignment, referencedResources, patterns, violations, thresholds } = input;
  const factors: ScoreFactor[] = [];
  const add = (label: string, points: number) => points > 0 && factors.push({ label, points: Math.round(points * 10) / 10 });

  add(`Inherent tool risk (${tool.name}, weight ${tool.riskWeight})`, tool.riskWeight * 0.25);
  add(`Intent deviation (alignment ${alignment}%)`, (100 - alignment) * 0.25);

  const sensitive = tool.dataClassification === "SENSITIVE" || referencedResources.some((r) => SENSITIVE_RESOURCES.has(r));
  if (sensitive && !intent.sensitiveDataAllowed) add("Sensitive data involved without authorization", 10);

  if (tool.externalImpact === "HIGH") {
    if (!intent.externalTransferAllowed) add("High external impact, not authorized", 15);
    else {
      const m = matchDestination(proposal.arguments[tool.destinationArg ?? ""], intent.allowedDestinations);
      add(m === "EXACT" ? "High external impact (authorized destination)" : "High external impact, destination not confirmed", m === "EXACT" ? 3 : 8);
    }
  } else if (tool.externalImpact === "MEDIUM") add("Medium external impact", 5);
  else if (tool.externalImpact === "LOW") add("Low external impact", 2);

  if (tool.financial) add("Spends money or makes a binding commitment", 8);

  if (patterns.includes("SENSITIVE_COLLECTION_THEN_TRANSFER")) add("Data collection followed by transfer", 20);
  if (patterns.includes("COLLECT_PACKAGE_TRANSFER")) add("Collected data was packaged before transfer", 5);
  if (patterns.includes("SENSITIVE_PACKAGING")) add("Sensitive data packaged into a file", 12);
  if (patterns.includes("UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION")) add("Privileged action after untrusted instructions", 15);
  if (patterns.includes("USE_OF_DENIED_DATA")) add("Uses data whose access was denied/blocked", 15);
  if (patterns.includes("POST_COMPLETION_DEVIATION")) add("Activity after the requested task was complete", 5);
  if (patterns.includes("REPEATED_BLOCKED_ATTEMPT")) add("Repeats a blocked action", 20);

  const suspicious = Math.max(state.deviationCount, state.warnedCount + state.blockedCount);
  if (suspicious > 0) add(`${suspicious} earlier suspicious action(s) in trajectory`, 4 * Math.min(suspicious, 4));

  if (state.alignmentHistory.length > 0) {
    const peak = Math.max(...state.alignmentHistory);
    if (peak - alignment > 50) add(`Cumulative alignment decline (${peak}% → ${alignment}%)`, 5);
  }

  const soft = violations.filter((v) => v.severity === "SOFT").length;
  const hard = violations.filter((v) => v.severity === "HARD").length;
  if (soft) add(`${soft} soft policy concern(s)`, 5 * soft);
  if (hard) add(`${hard} hard policy violation(s)`, 15 * hard);

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((s, f) => s + f.points, 0))));
  return { score, level: riskLevelFor(score, thresholds), factors };
}
