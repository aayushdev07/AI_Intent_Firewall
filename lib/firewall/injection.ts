/**
 * Deterministic detector for instruction-like text inside UNTRUSTED content.
 * It does not need to be perfect: detection only adds evidence. Regardless of
 * detection, external content is never treated as a source of authority.
 */
const SIGNALS: { id: string; pattern: RegExp }[] = [
  { id: "override-instructions", pattern: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(instruction|instructions|prompt|rules|user)\b/i },
  { id: "exfiltration-request", pattern: /\b(upload|send|forward|transfer|post|export)\b[^.\n]{0,60}\b(external|destination|https?:\/\/|server|drop)\b/i },
  { id: "bulk-data-request", pattern: /\b(complete|entire|full|all)\b[^.\n]{0,30}\b(customer|database|records|contacts)\b/i },
  { id: "false-authority", pattern: /\b(authori[sz]ed by|on behalf of|administrator says|admin approved)\b/i },
  { id: "concealment", pattern: /\b(do not|don't)\s+(tell|inform|notify)\b/i },
  { id: "urgency-pressure", pattern: /\burgent\b/i },
];

export function detectInjection(text: string): { detected: boolean; signals: string[] } {
  const signals = SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.id);
  // Urgency alone is not an injection; require at least one directive signal.
  const directive = signals.some((s) => s !== "urgency-pressure");
  return { detected: directive && signals.length >= 2, signals };
}
