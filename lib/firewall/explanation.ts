import type { Decision, OriginalIntent, RiskLevel, ScoreFactor, ToolMetadata, Violation } from "@/lib/types";
import { PATTERN_LABELS, type TrajectoryPattern } from "./trajectory";

/**
 * Explanation Engine — builds the decision reason from deterministic backend
 * facts only (violations, patterns, factors). Nothing here comes from the LLM.
 */
export function explainDecision(input: {
  decision: Decision;
  tool: ToolMetadata;
  intent: OriginalIntent;
  alignment: number;
  riskScore: number;
  riskLevel: RiskLevel;
  violations: Violation[];
  patterns: TrajectoryPattern[];
  riskFactors: ScoreFactor[];
}): string {
  const { decision, tool, intent, alignment, riskScore, riskLevel, violations, patterns, riskFactors } = input;
  const hard = violations.filter((v) => v.severity === "HARD");
  const escalations = violations.filter((v) => v.severity === "ESCALATE");
  const expected = intent.expectedActions.includes(tool.name);

  if (decision === "ALLOW") {
    if (expected && tool.resource && intent.allowedResources.includes(tool.resource)) {
      return `Allowed because ${tool.name} directly supports the goal "${intent.goal}" and accesses an authorized resource (${tool.resource}).`;
    }
    if (expected) return `Allowed because ${tool.name} is an expected step for "${intent.goal}" and the trajectory risk is ${riskLevel.toLowerCase()} (${riskScore}/100).`;
    return `Allowed with ${alignment}% alignment because no policy was violated and the trajectory risk is ${riskLevel.toLowerCase()} (${riskScore}/100).`;
  }

  if (decision === "WARN") {
    const why: string[] = escalations.map((v) => v.message.charAt(0).toLowerCase() + v.message.slice(1));
    if (riskLevel === "MEDIUM") why.push(`trajectory risk is medium (${riskScore}/100)`);
    const extra = tool.externalImpact === "HIGH" ? "the action has external impact and " : "";
    return `Approval required because ${extra}${why.join("; ")}.`;
  }

  // BLOCK
  const parts: string[] = [];
  if (hard.length) parts.push(hard.map((v) => v.message.charAt(0).toLowerCase() + v.message.slice(1)).join("; "));
  else parts.push(`cumulative trajectory risk reached ${riskScore}/100 (HIGH)`);

  const narrative = trajectoryNarrative(patterns, tool);
  const top = riskFactors
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((f) => f.label.toLowerCase());
  return `Blocked because ${parts.join(". ")}.${narrative ? ` ${narrative}` : ""}${!hard.length && top.length ? ` Largest contributors: ${top.join(", ")}.` : ""}`;
}

/** Human-readable story of why the trajectory changed the risk picture. */
export function trajectoryNarrative(patterns: TrajectoryPattern[], tool: ToolMetadata): string {
  if (patterns.includes("COLLECT_PACKAGE_TRANSFER")) {
    return "Risk increased because the agent accessed sensitive customer data, created a file containing collected information, and then attempted an external transfer that was not included in the original intent.";
  }
  if (patterns.includes("SENSITIVE_COLLECTION_THEN_TRANSFER")) {
    return "Risk increased because sensitive data was collected earlier in this run and the agent is now attempting to move data outside the system.";
  }
  if (patterns.includes("UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION")) {
    return "External content can influence what the agent sees, but it cannot grant new authority.";
  }
  if (patterns.includes("USE_OF_DENIED_DATA")) return `The agent is trying to use data that was already denied or blocked in this run.`;
  if (patterns.length) return `Trajectory signals: ${patterns.map((p) => PATTERN_LABELS[p].toLowerCase()).join("; ")}.`;
  return tool.externalImpact === "HIGH" ? "The action has high external impact." : "";
}
