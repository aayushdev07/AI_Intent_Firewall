import { EMAIL_RECORDS, DATA_NOTICE } from "@/lib/data/fake-data";
import { detectInjection } from "@/lib/firewall/injection";
import type { ToolExecutor } from "./types";

/**
 * read_emails — returns FAKE emails.
 * Email bodies are UNTRUSTED EXTERNAL CONTENT: they are wrapped and flagged,
 * and instruction-like text is detected so the firewall can reason about it.
 */
export const readEmails: ToolExecutor = (args) => {
  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 20) : 20;
  const emails = EMAIL_RECORDS.slice(0, limit).map((e) => {
    const inj = detectInjection(`${e.subject}\n${e.body}`);
    return { ...e, trust: "UNTRUSTED_EXTERNAL_CONTENT", suspectedInjection: inj.detected, injectionSignals: inj.signals };
  });
  const flagged = emails.filter((e) => e.suspectedInjection);
  return {
    output: { notice: DATA_NOTICE, trust: "UNTRUSTED_EXTERNAL_CONTENT", count: emails.length, emails },
    meta: {
      untrusted: true,
      injectionDetected: flagged.length > 0,
      injectionSignals: Array.from(new Set(flagged.flatMap((e) => e.injectionSignals))),
    },
  };
};
