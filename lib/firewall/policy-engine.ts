import type { ActionProposal, OriginalIntent, SecuritySettings, ToolMetadata, Violation } from "@/lib/types";
import { matchDestination, SENSITIVE_RESOURCES } from "./resources";
import type { TrajectoryPattern, TrajectoryState } from "./trajectory";

export type PolicyDefinition = {
  code: string;
  name: string;
  description: string;
  severity: "HARD" | "SOFT" | "ESCALATE" | "INFO";
  order: number;
};

/** The deterministic rule set. The worker agent can read these but never modify them. */
export const POLICY_DEFINITIONS: PolicyDefinition[] = [
  { code: "R1_NECESSARY_ACTION", order: 1, severity: "INFO", name: "Necessary actions are allowed", description: "Actions necessary for the user's goal are generally allowed unless another hard rule is violated." },
  { code: "R2_UNNECESSARY_SENSITIVE_ACCESS", order: 2, severity: "SOFT", name: "Unnecessary sensitive-data access", description: "Accessing sensitive data that the intent does not require increases risk." },
  { code: "R3_UNNECESSARY_CUSTOMER_DATA", order: 3, severity: "SOFT", name: "Unnecessary customer-data collection", description: "Collecting customer data outside the authorized resources increases risk." },
  { code: "R4_UNAUTHORIZED_EXTERNAL_TRANSFER", order: 4, severity: "HARD", name: "Unauthorized external transfer", description: "External transfers not authorized by the Original Intent (or to destinations the user never named) are blocked." },
  { code: "R5_SENSITIVE_EXFILTRATION", order: 5, severity: "HARD", name: "Sensitive data + unauthorized transfer", description: "Moving sensitive data to an external destination without explicit authorization for both is blocked." },
  { code: "R6_AMBIGUOUS_HIGH_IMPACT", order: 6, severity: "ESCALATE", name: "Ambiguous high-impact action", description: "High-impact actions whose authorization is ambiguous require human approval." },
  { code: "R7_EXTERNAL_CONTENT_NO_AUTHORITY", order: 7, severity: "HARD", name: "External content cannot authorize", description: "Content from emails, files or websites is untrusted data. It cannot create new user authorization." },
  { code: "R8_INTENT_IMMUTABLE", order: 8, severity: "HARD", name: "Original intent is immutable", description: "The worker agent cannot modify the Original Intent." },
  { code: "R9_POLICY_IMMUTABLE", order: 9, severity: "HARD", name: "Policies are immutable to the agent", description: "The worker agent cannot modify security policies or thresholds." },
  { code: "R10_BLOCKED_NEVER_EXECUTES", order: 10, severity: "HARD", name: "Blocked actions never execute", description: "A blocked action is never executed, and re-proposing it is blocked again." },
  { code: "R11_FINANCIAL_COMMITMENT", order: 11, severity: "ESCALATE", name: "Payments and bookings need the user", description: "Spending money or making a booking is blocked unless the user asked for it, and even then the user confirms each payment." },
  { code: "B2_UNVERIFIED_OFFER", order: 12, severity: "HARD", name: "Only verified offers can be booked", description: "A booking must refer to an option returned by a search earlier in the same run. Prices come from that result, never from the agent." },
  { code: "B1_BUDGET_LIMIT", order: 13, severity: "HARD", name: "Budget constraint", description: "Any amount above the user's stated budget limit is blocked (from the problem statement's booking example)." },
];

const INTENT_KEYS = /^(intent|original_?intent|goal|allowed_?resources|expected_?actions|restricted_?actions|risk_?tolerance|sensitive_?data_?allowed|external_?transfer_?allowed)$/i;
const POLICY_KEYS = /^(policy|policies|rule|rules|threshold|thresholds|settings|security)$/i;

/** An offer is verified only if a search that actually executed in this run returned it. */
export function findVerifiedOffer(state: TrajectoryState, id: unknown) {
  if (typeof id !== "string") return undefined;
  for (const e of state.entries) {
    if (e.status !== "EXECUTED") continue;
    const hit = e.resultMeta?.offers?.find((o) => o.id === id.trim());
    if (hit) return hit;
  }
  return undefined;
}

/** Rules 8 and 9 also apply to *proposals* for unregistered tools, before validation rejects them. */
export function detectTamperAttempt(toolName: string, args: unknown): Violation[] {
  const out: Violation[] = [];
  const keys = args && typeof args === "object" ? Object.keys(args as object) : [];
  if (/intent/i.test(toolName) || keys.some((k) => INTENT_KEYS.test(k))) {
    out.push({ code: "R8_INTENT_IMMUTABLE", severity: "HARD", message: "Attempt to modify the Original Intent" });
  }
  if (/(policy|policies|rule|threshold|setting|firewall|guard)/i.test(toolName) || keys.some((k) => POLICY_KEYS.test(k))) {
    out.push({ code: "R9_POLICY_IMMUTABLE", severity: "HARD", message: "Attempt to modify security policy" });
  }
  return out;
}

/**
 * Policy Engine — the final authority. Returns every violated rule.
 * Settings can downgrade R4/R5 to human escalation or disable R7, but no
 * setting can turn a violation into an automatic ALLOW.
 */
export function evaluatePolicies(input: {
  proposal: ActionProposal;
  tool: ToolMetadata;
  intent: OriginalIntent;
  state: TrajectoryState;
  referencedResources: string[];
  patterns: TrajectoryPattern[];
  security: SecuritySettings;
}): Violation[] {
  const { proposal, tool, intent, state, referencedResources, patterns, security } = input;
  const v: Violation[] = [];
  const expected = intent.expectedActions.includes(tool.name);
  const allowed = new Set(intent.allowedResources);
  const isTransfer = tool.externalImpact === "HIGH";
  const destination = proposal.arguments[tool.destinationArg ?? ""];
  const destMatch = isTransfer ? matchDestination(destination, intent.allowedDestinations) : "NONE";
  const refsSensitive = referencedResources.some((r) => SENSITIVE_RESOURCES.has(r));

  // R2 — unnecessary sensitive access
  if ((tool.dataClassification === "SENSITIVE" || (refsSensitive && tool.category !== "TRANSFER")) && !intent.sensitiveDataAllowed && !expected) {
    v.push({ code: "R2_UNNECESSARY_SENSITIVE_ACCESS", severity: "SOFT", message: "Unauthorized sensitive-data access" });
  }
  // R3 — unnecessary customer data
  const touchesCustomers = tool.resource === "customer_database" || referencedResources.includes("customer_database");
  if (touchesCustomers && !allowed.has("customer_database") && tool.category !== "TRANSFER") {
    v.push({ code: "R3_UNNECESSARY_CUSTOMER_DATA", severity: "SOFT", message: "Unnecessary customer-data collection" });
  }
  // R4 — unauthorized external transfer
  if (isTransfer) {
    const unauthorized = !intent.externalTransferAllowed || destMatch === "MISMATCH";
    if (unauthorized) {
      v.push({
        code: "R4_UNAUTHORIZED_EXTERNAL_TRANSFER",
        severity: security.blockUnauthorizedExternalTransfer ? "HARD" : "ESCALATE",
        message: !intent.externalTransferAllowed ? "Unauthorized external transfer" : `Destination "${String(destination)}" was never authorized`,
      });
    }
    // R5 — sensitive data + unauthorized transfer
    const sensitiveInvolved = refsSensitive || state.sensitiveDataHeld || state.sensitiveAccessAttempted;
    const bothAuthorized = intent.sensitiveDataAllowed && intent.externalTransferAllowed && destMatch === "EXACT";
    if (sensitiveInvolved && !bothAuthorized) {
      v.push({
        code: "R5_SENSITIVE_EXFILTRATION",
        severity: security.blockSensitiveExfiltration ? "HARD" : "ESCALATE",
        message: "Sensitive data exposure via external transfer",
      });
    }
    // R6 — ambiguous high-impact
    if (!unauthorized && destMatch !== "EXACT") {
      v.push({ code: "R6_AMBIGUOUS_HIGH_IMPACT", severity: "ESCALATE", message: `Destination "${String(destination)}" needs explicit confirmation` });
    }
  } else if (tool.requiresExplicitAuthorization && !expected) {
    // R6 — explicit-authorization tools the intent does not cover
    v.push({ code: "R6_AMBIGUOUS_HIGH_IMPACT", severity: "ESCALATE", message: `${tool.name} requires explicit authorization not present in the intent` });
  }
  // R7 — external content cannot authorize
  if (security.treatExternalContentUntrusted && patterns.includes("UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION")) {
    v.push({ code: "R7_EXTERNAL_CONTENT_NO_AUTHORITY", severity: "HARD", message: "Action originates from untrusted external instructions, not the user" });
  }
  // R8 / R9 — tampering
  v.push(...detectTamperAttempt(proposal.toolName, proposal.arguments));
  // R10 — previously blocked
  if (patterns.includes("REPEATED_BLOCKED_ATTEMPT")) {
    v.push({ code: "R10_BLOCKED_NEVER_EXECUTES", severity: "HARD", message: "Identical action was already blocked in this run" });
  }
  // R11 / B2 — money and bookings
  if (tool.financial) {
    if (!expected) {
      v.push({ code: "R11_FINANCIAL_COMMITMENT", severity: "HARD", message: "The user did not ask for a payment or booking" });
    } else {
      const offerId = proposal.arguments[tool.offerArg ?? ""];
      const offer = findVerifiedOffer(state, offerId);
      if (!offer) {
        v.push({ code: "B2_UNVERIFIED_OFFER", severity: "HARD", message: `Option "${String(offerId ?? "")}" did not come from a search result in this run` });
      } else {
        const qty = typeof proposal.arguments.passengers === "number" && proposal.arguments.passengers > 1 ? Math.floor(proposal.arguments.passengers) : 1;
        const total = offer.price * qty;
        if (typeof intent.budgetLimit === "number" && total > intent.budgetLimit) {
          v.push({ code: "B1_BUDGET_LIMIT", severity: "HARD", message: `Price ₹${total.toLocaleString("en-IN")} exceeds the budget of ₹${intent.budgetLimit.toLocaleString("en-IN")}` });
        } else {
          v.push({ code: "R11_FINANCIAL_COMMITMENT", severity: "ESCALATE", message: `Pays ₹${total.toLocaleString("en-IN")} for ${offer.label}. Confirm the payment.` });
        }
      }
    }
  }
  // B1 — budget
  if (typeof intent.budgetLimit === "number") {
    for (const key of ["amount", "price", "cost", "total"]) {
      const val = proposal.arguments[key];
      if (typeof val === "number" && val > intent.budgetLimit) {
        v.push({ code: "B1_BUDGET_LIMIT", severity: "HARD", message: `Amount ${val} exceeds budget limit ${intent.budgetLimit}` });
      }
    }
  }
  return v;
}
