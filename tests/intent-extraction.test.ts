import { describe, expect, it } from "vitest";
import { hardenIntent, parseIntentRuleBased } from "@/lib/llm/intent-parser";

describe("Intent extraction", () => {
  it("sales analysis: sales database allowed, customer database unnecessary, external transfer restricted", () => {
    const i = parseIntentRuleBased("Analyze sales and create a report.");
    expect(i.allowedResources).toContain("sales_database");
    expect(i.allowedResources).not.toContain("customer_database");
    expect(i.expectedActions).toEqual(expect.arrayContaining(["read_sales_database", "calculate_sales", "create_report"]));
    expect(i.restrictedActions).toEqual(expect.arrayContaining(["read_customer_database", "upload_external", "send_email", "read_emails"]));
    expect(i.externalTransferAllowed).toBe(false);
    expect(i.sensitiveDataAllowed).toBe(false);
    expect(i.riskTolerance).toBe("low");
  });

  it("email-to-manager: transfer allowed, destination kept verbatim and flagged ambiguous", () => {
    const i = parseIntentRuleBased("Create the sales report and email it to my manager.");
    expect(i.externalTransferAllowed).toBe(true);
    expect(i.expectedActions).toContain("send_email");
    expect(i.allowedDestinations).toEqual(["my manager"]);
    expect(i.ambiguities.join(" ")).toMatch(/role, not an address/);
    expect(i.expectedActions).not.toContain("upload_external");
  });

  it("reading emails does not authorize sending email or the sales database", () => {
    const i = parseIntentRuleBased("Read my emails and summarize important sales-related messages.");
    expect(i.expectedActions).toEqual(["read_emails", "create_report"]);
    expect(i.externalTransferAllowed).toBe(false);
    expect(i.allowedResources).toEqual(["email_inbox"]);
  });

  it("hardenIntent removes authority an LLM invented", () => {
    const hardened = hardenIntent(
      {
        goal: "Analyze sales",
        allowedResources: ["sales_database", "customer_database"],
        expectedActions: ["read_sales_database", "read_customer_database", "upload_external"],
        restrictedActions: [],
        sensitiveDataAllowed: true,
        externalTransferAllowed: true,
        allowedDestinations: ["https://evil.example.net"],
        riskTolerance: "low",
        ambiguities: [],
      },
      "Analyze this month's sales and create a report.",
    );
    expect(hardened.externalTransferAllowed).toBe(false);
    expect(hardened.sensitiveDataAllowed).toBe(false);
    expect(hardened.expectedActions).toEqual(["read_sales_database"]);
    expect(hardened.allowedResources).toEqual(["sales_database"]);
    expect(hardened.allowedDestinations).toEqual([]);
  });

  it("extracts explicit budget constraints", () => {
    const i = parseIntentRuleBased("Book me a flight to Delhi under ₹10,000.");
    expect(i.budgetLimit).toBe(10000);
  });
  it("grounds explicit travel constraints from arbitrary cities", () => {
    const i = parseIntentRuleBased("Book a flight from Mumbai to Delhi tomorrow.");
    expect(i.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "origin", value: "Mumbai" }),
      expect.objectContaining({ key: "destination", value: "Delhi" }),
    ]));
  });

  it("does not accept LLM-invented constraints without evidence in the user request", () => {
    const i = hardenIntent(
      {
        goal: "Book a flight",
        constraints: [{ key: "destination", value: "London", source: "to London" }],
        allowedResources: ["travel"],
        expectedActions: ["search_flights"],
        restrictedActions: [],
        sensitiveDataAllowed: false,
        externalTransferAllowed: false,
        allowedDestinations: [],
        budgetLimit: undefined,
        riskTolerance: "low",
        ambiguities: [],
      },
      "Book a flight from Mumbai to Delhi.",
    );
    expect(i.constraints.some(c => c.key === "destination" && c.value === "London")).toBe(false);
    expect(i.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "origin", value: "Mumbai" }),
      expect.objectContaining({ key: "destination", value: "Delhi" }),
    ]));
  });

});
