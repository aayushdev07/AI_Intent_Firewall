import type { IntentView } from "@/lib/db/mappers";
import { parseJson } from "@/lib/db/json";
import { attemptText, plainReason } from "@/lib/plain";

/**
 * Confirmation is skipped only for requests that grant no outside sharing, no sensitive data
 * and have no ambiguity. Anything that widens authority is always shown to the user first.
 */
export function requiresConfirmation(
  intent: Pick<IntentView, "externalTransferAllowed" | "sensitiveDataAllowed" | "ambiguities">,
  alwaysConfirm: boolean,
) {
  return alwaysConfirm || intent.externalTransferAllowed || intent.sensitiveDataAllowed || intent.ambiguities.length > 0;
}

export type AlertPayload = {
  kind: "approval" | "blocked" | "test";
  title: string;
  body: string;
  /** Same tag as the in-page notification, so the browser shows one alert, not two. */
  tag: string;
  url: string;
  actionId: string;
};

export type ActionForAlert = {
  id: string;
  toolName: string;
  arguments: string;
  decision: string | null;
  alignmentScore: number | null;
  violations: { code: string; message: string; severity: string }[];
  run: { intent: { conversationId: string | null } };
};

/** The plain-language alert for a paused (WARN) or blocked action. */
export function alertFor(a: ActionForAlert): AlertPayload | null {
  const args = parseJson<Record<string, unknown>>(a.arguments, {});
  const what = attemptText(a.toolName, args);
  const why = plainReason(a.decision, a.violations, a.alignmentScore);
  const url = a.run.intent.conversationId ? `/chat/${a.run.intent.conversationId}` : "/receipts";
  if (a.decision === "WARN") return { kind: "approval", title: "Approval needed", body: `The assistant wants to ${what}. ${why}`, tag: `ig-${a.id}`, url, actionId: a.id };
  if (a.decision === "BLOCK")
    return { kind: "blocked", title: "Risky action blocked", body: `The assistant tried to ${what}. IntentGuard stopped it. ${why}`, tag: `ig-${a.id}`, url, actionId: a.id };
  return null;
}
