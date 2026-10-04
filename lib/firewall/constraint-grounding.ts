import type { ActionProposal, IntentConstraint, OriginalIntent } from "@/lib/types";

export type ConstraintViolation = {
  key: string;
  expected: string;
  actual: string;
  message: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[₹$€£,\s]/g, "");
}

function findConstraint(constraints: IntentConstraint[], keys: string[]) {
  return constraints.find(c => keys.includes(c.key.toLowerCase()));
}

/** Deterministically verifies agent arguments against immutable user constraints. */
export function validateActionAgainstIntentConstraints(
  proposal: ActionProposal,
  intent: OriginalIntent,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const args = proposal.arguments ?? {};

  const origin = findConstraint(intent.constraints, ["origin", "from", "source"]);
  if (origin) {
    const actual = args.from ?? args.origin ?? args.source;
    if (actual !== undefined && normalize(actual) !== normalize(origin.value)) {
      violations.push({
        key: "origin",
        expected: String(origin.value),
        actual: String(actual),
        message: `Origin mismatch: the user explicitly requested "${origin.value}", but the agent proposed "${actual}".`,
      });
    }
  }

  const destination = findConstraint(intent.constraints, ["destination", "to", "dest"]);
  if (destination) {
    const actual = args.to ?? args.destination ?? args.dest;
    if (actual !== undefined && normalize(actual) !== normalize(destination.value)) {
      violations.push({
        key: "destination",
        expected: String(destination.value),
        actual: String(actual),
        message: `Destination mismatch: the user explicitly requested "${destination.value}", but the agent proposed "${actual}".`,
      });
    }
  }

  const recipient = findConstraint(intent.constraints, ["recipient", "email", "email_address"]);
  if (recipient) {
    const actual = args.to ?? args.recipient ?? args.email ?? args.email_address;
    if (actual !== undefined && normalize(actual) !== normalize(recipient.value)) {
      violations.push({
        key: "recipient",
        expected: String(recipient.value),
        actual: String(actual),
        message: `Recipient mismatch: the user authorized "${recipient.value}", but the agent proposed "${actual}".`,
      });
    }
  }

  const maxPrice = findConstraint(intent.constraints, ["maximum_price", "max_price", "budget"]);
  if (maxPrice && typeof maxPrice.value === "number") {
    for (const key of ["price", "amount", "cost", "total"]) {
      const actual = args[key];
      if (typeof actual === "number" && actual > maxPrice.value) {
        violations.push({
          key: "maximum_price",
          expected: String(maxPrice.value),
          actual: String(actual),
          message: `Budget constraint violated: proposed value ${actual} exceeds the user's maximum of ${maxPrice.value}.`,
        });
      }
    }
  }

  const quantity = findConstraint(intent.constraints, ["passengers", "quantity", "count"]);
  if (quantity && typeof quantity.value === "number") {
    const actual = args.passengers ?? args.quantity ?? args.count;
    if (typeof actual === "number" && actual !== quantity.value) {
      violations.push({
        key: "quantity",
        expected: String(quantity.value),
        actual: String(actual),
        message: `Quantity mismatch: the user requested ${quantity.value}, but the agent proposed ${actual}.`,
      });
    }
  }

  return violations;
}
