import type { ActionProposal, Decision, Evaluation, FirewallConfig, OriginalIntent, TrajectoryEntry, Violation } from "@/lib/types";
import { validateProposal } from "./validation";
import { calculateAlignment } from "./intent-alignment";
import { buildTrajectoryState, detectPatterns } from "./trajectory";
import { calculateRisk, effectiveThresholds } from "./risk-engine";
import { detectTamperAttempt, evaluatePolicies } from "./policy-engine";
import { explainDecision } from "./explanation";
import { validateActionAgainstIntentConstraints } from "./constraint-grounding";

export type EvaluateOptions = {
  /** Optional LLM relevance hint (0–1). Bounded to ±4 alignment points. */
  semanticHint?: number;
};

/**
 * IntentGuard.evaluateAction — the security boundary.
 *
 * Evaluation order (never execute first, evaluate later):
 *  1 validate action → 2 validate tool → 3 validate arguments → 4 check intent →
 *  5 intent alignment → 6 update trajectory → 7 trajectory risk →
 *  8 hard policy rules → 9 decision. (10 receipt and 11 execution happen in the
 *  service layer, and execution re-verifies this decision independently.)
 *
 * Fail-safe: any exception or invalid input produces BLOCK (or WARN if the
 * operator explicitly disabled fail-closed). It never produces ALLOW.
 */
export function evaluateAction(
  action: ActionProposal | unknown,
  intent: OriginalIntent | null | undefined,
  trajectory: TrajectoryEntry[],
  config: FirewallConfig,
  options: EvaluateOptions = {},
): Evaluation {
  const steps: Evaluation["details"]["evaluationSteps"] = [];
  const thresholds = intent ? effectiveThresholds(config.thresholds, intent.riskTolerance) : config.thresholds;

  const failSafe = (message: string, code: string, extra: Violation[] = []): Evaluation => {
    const decision: Decision = config.security.failClosed ? "BLOCK" : "WARN";
    const violations: Violation[] = [...extra, { code, severity: "HARD", message }];
    return {
      decision,
      alignmentScore: 0,
      riskScore: 100,
      riskLevel: "HIGH",
      violations: violations.map((v) => v.message),
      reason:
        decision === "BLOCK"
          ? `Blocked (fail-safe): ${message}`
          : `Approval required (fail-closed disabled by operator): ${message}`,
      details: { violations, alignmentFactors: [], riskFactors: [], patterns: [], evaluationSteps: steps, effectiveThresholds: thresholds, failSafe: true },
    };
  };

  try {
    // Steps 1–4
    const validation = validateProposal(action, intent);
    if (!validation.ok) {
      steps.push({ step: validation.step, ok: false, note: validation.message });
      const p = action as Partial<ActionProposal> | null;
      const tamper = p && typeof p.toolName === "string" ? detectTamperAttempt(p.toolName, p.arguments) : [];
      return failSafe(validation.message, validation.code, tamper);
    }
    steps.push({ step: "Validate action", ok: true }, { step: "Validate tool", ok: true }, { step: "Validate arguments", ok: true }, { step: "Check original intent", ok: true });

    const proposal = action as ActionProposal;
    const tool = validation.tool;
    const confirmed = intent as OriginalIntent;

    // HARD GATE: explicit user constraints are checked deterministically before
    // alignment/risk/policy scoring. The model may propose anything; it cannot
    // change what the user explicitly asked for.
    const constraintViolations = validateActionAgainstIntentConstraints(proposal, confirmed);
    if (constraintViolations.length > 0) {
      const violations: Violation[] = constraintViolations.map((v) => ({
        code: "INTENT_CONSTRAINT_MISMATCH",
        severity: "HARD",
        message: v.message,
      }));
      steps.push({
        step: "Validate explicit user constraints",
        ok: false,
        note: violations.map((v) => v.message).join(" "),
      });
      return {
        decision: "BLOCK",
        alignmentScore: 0,
        riskScore: 100,
        riskLevel: "HIGH",
        violations: violations.map((v) => v.message),
        reason: "Blocked by IntentGuard: the proposed action violates an explicit constraint in the user's immutable intent.",
        details: {
          violations,
          alignmentFactors: [],
          riskFactors: [],
          patterns: [],
          evaluationSteps: steps,
          effectiveThresholds: thresholds,
          failSafe: false,
        },
      };
    }
    steps.push({ step: "Validate explicit user constraints", ok: true });

    // Steps 5–6: alignment against the trajectory state, then trajectory patterns
    const state = buildTrajectoryState(trajectory, confirmed);
    const alignment = calculateAlignment(proposal, tool, confirmed, state, options.semanticHint);
    steps.push({ step: "Calculate intent alignment", ok: true, note: `${alignment.score}%` });
    const patterns = detectPatterns(proposal, tool, confirmed, state, alignment.referencedResources);
    steps.push({ step: "Update trajectory", ok: true, note: `${trajectory.length + 1} action(s); ${patterns.length} pattern(s)` });

    // Step 7: trajectory risk (before policy findings)
    const baseRisk = calculateRisk({
      proposal, tool, intent: confirmed, state, alignment: alignment.score,
      referencedResources: alignment.referencedResources, patterns, violations: [], thresholds,
    });
    steps.push({ step: "Calculate trajectory risk", ok: true, note: `${baseRisk.score}/100 before policy findings` });

    // Step 8: hard policy rules (policy findings also feed the final risk score)
    const violations = evaluatePolicies({
      proposal, tool, intent: confirmed, state, referencedResources: alignment.referencedResources, patterns, security: config.security,
    });
    const risk = calculateRisk({
      proposal, tool, intent: confirmed, state, alignment: alignment.score,
      referencedResources: alignment.referencedResources, patterns, violations, thresholds,
    });
    steps.push({ step: "Evaluate policy rules", ok: violations.every((v) => v.severity !== "HARD"), note: violations.length ? violations.map((v) => v.code).join(", ") : "no violations" });

    // Step 9: decision — hard violations override every numeric score
    let decision: Decision;
    if (violations.some((v) => v.severity === "HARD")) decision = "BLOCK";
    else if (risk.level === "HIGH") decision = "BLOCK";
    else if (risk.level === "MEDIUM") decision = config.security.requireApprovalForMedium ? "WARN" : violations.some((v) => v.severity === "ESCALATE") ? "WARN" : "ALLOW";
    else if (violations.some((v) => v.severity === "ESCALATE")) decision = "WARN";
    else decision = "ALLOW";
    steps.push({ step: "Determine decision", ok: decision === "ALLOW", note: decision });

    const reason = explainDecision({
      decision, tool, intent: confirmed, alignment: alignment.score, riskScore: risk.score, riskLevel: risk.level,
      violations, patterns, riskFactors: risk.factors,
    });

    return {
      decision,
      alignmentScore: alignment.score,
      riskScore: risk.score,
      riskLevel: risk.level,
      violations: violations.map((v) => v.message),
      reason,
      details: {
        violations,
        alignmentFactors: alignment.factors,
        riskFactors: risk.factors,
        patterns,
        evaluationSteps: steps,
        effectiveThresholds: thresholds,
        failSafe: false,
      },
    };
  } catch (err) {
    steps.push({ step: "Evaluation", ok: false, note: err instanceof Error ? err.message : "unknown error" });
    return failSafe(`IntentGuard could not evaluate the action (${err instanceof Error ? err.message : "unknown error"}).`, "EVALUATION_FAILURE");
  }
}
