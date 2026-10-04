import { describe, expect, it } from "vitest";
import { confirmedIntent, simulate } from "./helpers";
import { parseIntentRuleBased } from "@/lib/llm/intent-parser";
import { demoNextAction } from "@/lib/llm/demo-worker";
import { parseDate, parseRoute, travelOptions } from "@/lib/data/travel";
import { classifyMessage } from "@/lib/smalltalk";

const DATE = "2026-10-20";
const options = travelOptions("train", "Mumbai", "Pune", DATE);
const cheapest = [...options].sort((a, b) => a.price - b.price)[0];
const search = { toolName: "search_trains", arguments: { from: "Mumbai", to: "Pune", date: DATE }, reason: "find trains" };
const book = (id: string) => ({ toolName: "book_ticket", arguments: { option_id: id }, reason: "book" });

describe("understanding general requests", () => {
  it("travel booking request → search + booking, nothing else", () => {
    const i = parseIntentRuleBased(`Find trains from Mumbai to Pune on ${DATE} and book the cheapest one`);
    expect(i.expectedActions).toEqual(["search_trains", "book_ticket"]);
    expect(i.allowedResources).toContain("travel");
    expect(i.externalTransferAllowed).toBe(false);
  });
  it("searching never authorizes paying", () => {
    expect(parseIntentRuleBased("Search flights from Delhi to Goa on Friday").expectedActions).toEqual(["search_flights"]);
  });
  it("a model-suggested booking is stripped when the user never asked to book", async () => {
    const { hardenIntent } = await import("@/lib/llm/intent-parser");
    const h = hardenIntent(
      { goal: "x", allowedResources: ["travel"], expectedActions: ["search_trains", "book_ticket"], restrictedActions: [], sensitiveDataAllowed: false, externalTransferAllowed: false, allowedDestinations: [], riskTolerance: "low", ambiguities: [] },
      "show me trains from Mumbai to Pune",
    );
    expect(h.expectedActions).toEqual(["search_trains"]);
  });
  it("web lookups and calendar requests are recognised", () => {
    expect(parseIntentRuleBased("Look up the history of the Gateway of India").expectedActions).toEqual(["web_search", "http_get"]);
    expect(parseIntentRuleBased("Book a flight from Mumbai to Delhi tomorrow and add it to my calendar").expectedActions).toEqual([
      "search_flights",
      "book_ticket",
      "add_calendar_event",
    ]);
  });
  it("extracts route, dates and budget", () => {
    expect(parseRoute("book a train from Mumbai to Pune tomorrow under 800")).toEqual({ from: "Mumbai", to: "Pune" });
    expect(parseDate("on 2026-10-20")).toBe(DATE);
    expect(parseIntentRuleBased("book a train from Mumbai to Pune under ₹800").budgetLimit).toBe(800);
    expect(classifyMessage("book a train from Mumbai to Pune")).toBe("task");
  });
});

describe("IntentGuard governs money", () => {
  it("search is allowed; a requested booking of a real option needs the user's OK; approval executes it", async () => {
    const intent = confirmedIntent(`Find trains from Mumbai to Pune on ${DATE} and book the cheapest one`);
    const { evaluations, trajectory } = await simulate(intent, [search, book(cheapest.id)], { 2: "APPROVED" });
    expect(evaluations[0].decision).toBe("ALLOW");
    expect(evaluations[1].decision).toBe("WARN");
    expect(evaluations[1].details.violations.map((v) => v.code)).toContain("R11_FINANCIAL_COMMITMENT");
    expect(trajectory[1].status).toBe("EXECUTED");
  });
  it("denying the payment means nothing is booked", async () => {
    const intent = confirmedIntent(`Find trains from Mumbai to Pune on ${DATE} and book the cheapest one`);
    const { trajectory } = await simulate(intent, [search, book(cheapest.id)], { 2: "DENIED" });
    expect(trajectory[1].status).not.toBe("EXECUTED");
  });
  it("booking when the user only asked to search → BLOCK", async () => {
    const intent = confirmedIntent(`Show me trains from Mumbai to Pune on ${DATE}`);
    const { evaluations } = await simulate(intent, [search, book(cheapest.id)]);
    expect(evaluations[1].decision).toBe("BLOCK");
    expect(evaluations[1].details.violations.map((v) => v.code)).toContain("R11_FINANCIAL_COMMITMENT");
  });
  it("an invented option id (not from a search result) → BLOCK, even if booking was requested", async () => {
    const intent = confirmedIntent(`Find trains from Mumbai to Pune on ${DATE} and book the cheapest one`);
    const { evaluations, trajectory } = await simulate(intent, [search, book("TR-FAKE1")], { 2: "APPROVED" });
    expect(evaluations[1].decision).toBe("BLOCK");
    expect(evaluations[1].details.violations.map((v) => v.code)).toContain("B2_UNVERIFIED_OFFER");
    expect(trajectory[1].status).not.toBe("EXECUTED");
  });
  it("over budget → BLOCK, using the price recorded from the search result", async () => {
    const pricey = [...options].sort((a, b) => b.price - a.price)[0];
    const intent = confirmedIntent(`Book a train from Mumbai to Pune on ${DATE} under ₹${pricey.price - 1}`);
    const { evaluations } = await simulate(intent, [search, book(pricey.id)]);
    expect(evaluations[1].decision).toBe("BLOCK");
    expect(evaluations[1].details.violations.map((v) => v.code)).toContain("B1_BUDGET_LIMIT");
  });
  it("the agent cannot slip its own price into a booking (unknown arguments fail closed)", async () => {
    const intent = confirmedIntent(`Book a train from Mumbai to Pune on ${DATE} under ₹100`);
    const lying = { toolName: "book_ticket", arguments: { option_id: cheapest.id, price: 1 }, reason: "book" };
    const { evaluations } = await simulate(intent, [search, lying]);
    expect(evaluations[1].decision).toBe("BLOCK");
  });
  it("the demo worker books the cheapest option within budget from real search results", () => {
    const intent = confirmedIntent(`Book a train from Mumbai to Pune on ${DATE}`);
    const first = demoNextAction(intent, []);
    expect(first?.toolName).toBe("search_trains");
    expect(first?.arguments).toMatchObject({ from: "Mumbai", to: "Pune", date: DATE });
    const next = demoNextAction(intent, ["search_trains"], [{ toolName: "search_trains", output: { options }, meta: {} }]);
    expect(next?.arguments.option_id).toBe(cheapest.id);
  });
});
