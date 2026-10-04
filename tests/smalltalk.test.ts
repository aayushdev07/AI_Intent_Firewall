import { describe, expect, it } from "vitest";
import { classifyMessage, smalltalkReply } from "@/lib/smalltalk";
import { parseIntentRuleBased } from "@/lib/llm/intent-parser";

describe("conversational messages never start the agent", () => {
  it.each(["hello", "hii", "Hi!", "hey there", "Good morning", "namaste", "yo"])("greeting: %s", (m) => {
    expect(classifyMessage(m)).toBe("greeting");
  });
  it.each([
    ["thanks!", "thanks"],
    ["thank you so much", "thanks"],
    ["bye", "farewell"],
    ["what can you do?", "capabilities"],
    ["help", "capabilities"],
    ["who are you", "identity"],
    ["ok", "ack"],
  ])("%s → %s", (m, kind) => {
    expect(classifyMessage(m)).toBe(kind);
  });
  it("treats real requests as tasks", () => {
    for (const m of [
      "Analyze this month's sales and create a report.",
      "hello, can you summarize my emails?",
      "Read my emails and summarize important sales-related messages.",
      "email the report to my manager",
    ]) {
      expect(classifyMessage(m)).toBe("task");
    }
  });
  it("replies without proposing any action", () => {
    expect(smalltalkReply("greeting")).toMatch(/What would you like me to do/);
  });
  it("the rule parser finds no actions in a greeting (grounding baseline)", () => {
    expect(parseIntentRuleBased("hello").expectedActions).toEqual([]);
  });
});
