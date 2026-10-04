import { describe, expect, it } from "vitest";
import { httpGet } from "@/lib/tools/http";
import type { ToolContext } from "@/lib/tools/types";

const ctx: ToolContext = { runId: "t", priorResults: [] };

describe("http_get safety (SSRF and protocol guards)", () => {
  it("rejects non-https", async () => {
    const r = await httpGet({ url: "http://example.com" }, ctx);
    expect((r.output as { error?: string }).error).toMatch(/https/i);
  });
  it("blocks localhost and private ranges", async () => {
    for (const url of ["https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.1/x", "https://169.254.169.254/latest/meta-data"]) {
      const r = await httpGet({ url }, ctx);
      expect((r.output as { error?: string }).error).toMatch(/not allowed/i);
    }
  });
  it("marks any result as untrusted external content", async () => {
    const r = await httpGet({ url: "https://not-allowed.local/x" }, ctx);
    expect(r.meta.untrusted).toBe(true);
  });
});
