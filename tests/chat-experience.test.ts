import { describe, expect, it } from "vitest";
import { alertFor, requiresConfirmation } from "@/lib/chat-policy";
import { attemptText, doneText, monthName, plainReason } from "@/lib/plain";

const base = { externalTransferAllowed: false, sensitiveDataAllowed: false, ambiguities: [] as string[] };

describe("chat confirmation policy", () => {
  it("auto-starts plain read-and-report requests", () => {
    expect(requiresConfirmation(base, false)).toBe(false);
  });
  it("always asks when the request authorizes outside sharing, sensitive data or is ambiguous", () => {
    expect(requiresConfirmation({ ...base, externalTransferAllowed: true }, false)).toBe(true);
    expect(requiresConfirmation({ ...base, sensitiveDataAllowed: true }, false)).toBe(true);
    expect(requiresConfirmation({ ...base, ambiguities: ["Who is 'my manager'?"] }, false)).toBe(true);
  });
  it("asks for everything when the user turns on Always confirm", () => {
    expect(requiresConfirmation(base, true)).toBe(true);
  });
});

describe("plain-language layer", () => {
  it("describes steps without tool jargon", () => {
    expect(monthName("2026-09")).toBe("September 2026");
    expect(doneText("read_sales_database", { month: "2026-09" })).toBe("Read sales data for September 2026");
    expect(attemptText("upload_external", { destination: "https://collector.example.net/drop", filename: "customers.csv" })).toBe(
      "upload customers.csv to collector.example.net",
    );
  });
  it("explains prompt injection as content without authority", () => {
    expect(plainReason("BLOCK", [{ code: "R7_EXTERNAL_CONTENT_NO_AUTHORITY" }], 10)).toMatch(/email or file, not from you/);
  });
  it("prefers the most serious reason", () => {
    expect(plainReason("BLOCK", [{ code: "R4_UNAUTHORIZED_EXTERNAL_TRANSFER" }, { code: "R5_SENSITIVE_EXFILTRATION" }], 0)).toMatch(/sensitive data/);
  });
});

describe("risk alerts", () => {
  const action = (decision: string) => ({
    id: "a1",
    toolName: "send_email",
    arguments: JSON.stringify({ to: "manager@example.com", attachment: "report" }),
    decision,
    alignmentScore: 88,
    violations: [{ code: "R6_AMBIGUOUS_HIGH_IMPACT", message: "", severity: "ESCALATE" }],
    run: { intent: { conversationId: "c1" } },
  });
  it("turns WARN into an approval alert that links to the chat", () => {
    const a = alertFor(action("WARN"))!;
    expect(a.kind).toBe("approval");
    expect(a.body).toContain("email the report to manager@example.com");
    expect(a.url).toBe("/chat/c1");
    expect(a.tag).toBe("ig-a1");
  });
  it("turns BLOCK into a blocked notice and ALLOW into nothing", () => {
    expect(alertFor(action("BLOCK"))!.kind).toBe("blocked");
    expect(alertFor(action("ALLOW"))).toBeNull();
  });
});
