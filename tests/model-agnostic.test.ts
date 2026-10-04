import { describe, expect, it } from "vitest";
import { resolveModel, stripThinking, extractJsonObject } from "@/lib/llm/lmstudio";

describe("works with any local model, not just Qwen", () => {
  it("uses the exact model when it is loaded", () => {
    expect(resolveModel("qwen3-8b", ["qwen3-8b", "gemma-3-4b"])).toBe("qwen3-8b");
  });
  it("uses the only loaded model when the configured id doesn't match (Gemma loaded, config still Qwen)", () => {
    expect(resolveModel("qwen3-8b", ["google/gemma-3-4b-it"])).toBe("google/gemma-3-4b-it");
  });
  it("matches a near name when several are loaded", () => {
    expect(resolveModel("gemma-3-4b", ["qwen3-8b", "google/gemma-3-4b-it"])).toBe("google/gemma-3-4b-it");
  });
  it("strips reasoning blocks from any model", () => {
    expect(stripThinking("<think>plan</think> hello")).toBe("hello");
  });
  it("extracts JSON even when a model wraps it in prose or fences", () => {
    expect(extractJsonObject('Sure! ```json\n{"a":1}\n``` done')).toEqual({ a: 1 });
    expect(extractJsonObject('Here: {"toolName":"web_search","arguments":{"query":"x"}}')).toMatchObject({ toolName: "web_search" });
  });
});
