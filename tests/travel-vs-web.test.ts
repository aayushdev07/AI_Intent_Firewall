import { describe, expect, it } from "vitest";
import { parseIntentRuleBased } from "@/lib/llm/intent-parser";

describe("flight/train requests don't become web searches", () => {
  it("'check the flights from delhi to US for 5th october' → flight search only, no web, no report, no booking", () => {
    const i = parseIntentRuleBased("can u check the flights from delhi to US for 5th october");
    expect(i.expectedActions).toContain("search_flights");
    expect(i.expectedActions).not.toContain("web_search");
    expect(i.expectedActions).not.toContain("http_get");
    expect(i.expectedActions).not.toContain("create_report");
    expect(i.expectedActions).not.toContain("book_ticket");
  });
  it("'find trains mumbai to pune tomorrow' → train search", () => {
    expect(parseIntentRuleBased("find trains from mumbai to pune tomorrow").expectedActions).toEqual(["search_trains"]);
  });
  it("genuine question still uses the web", () => {
    expect(parseIntentRuleBased("who is the president of India").expectedActions).toContain("web_search");
  });
  it("book is still recognised and paired with a search", () => {
    const i = parseIntentRuleBased("book a flight from delhi to mumbai tomorrow");
    expect(i.expectedActions[0]).toBe("search_flights");
    expect(i.expectedActions).toContain("book_ticket");
  });
});
